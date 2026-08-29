/**
 * folio-ai — metered AI proxy for the Folio AI Pro plan.
 *
 * The extension can't hold a model API key, so it calls this worker with the
 * customer's Folio license key; the worker verifies the key against Polar
 * (public customer-portal endpoint — must be the AI Pro benefit), enforces
 * the monthly quota + a per-minute rate limit in KV, then runs the request
 * on Workers AI and returns the text plus remaining quota.
 *
 * Quota framing (product decision): a fixed, advertised monthly operation
 * quota. When it runs out we DON'T hard-fail the feature — the client falls
 * back to the user's own BYOK provider if configured.
 */
export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return this._cors(new Response(null, { status: 204 }));
      const url = new URL(request.url);

      if (url.pathname === '/health' && request.method === 'GET') {
        return this._cors(this._json({ ok: true }, 200));
      }
      if (url.pathname === '/ai/analyze' && request.method === 'POST') {
        return this._cors(await this._analyze(request, env));
      }
      return this._cors(this._json({ error: 'not_found' }, 404));
    } catch (err) {
      console.error('folio-ai error:', err && err.stack || err);
      return this._cors(this._json({ error: 'server_error' }, 500));
    }
  },

  get _CFG() {
    return {
      ORG_ID: 'b0760693-97ab-4bd8-9367-d61530ea0f69',
      AI_BENEFIT: 'a184a03b-6439-47d6-9a89-53da19780968', // Folio AI Pro
      MONTHLY_LIMIT: 300,
      RPM_LIMIT: 10,
      LICENSE_CACHE_SEC: 15 * 60,
      MAX_PROMPT_CHARS: 60000,
      MODEL_DEFAULT: '@cf/meta/llama-3.1-8b-instruct-fp8',
    };
  },

  async _sha256(s) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async _licenseOk(key, env) {
    // Dev bypass: only when the DEV_ALLOW_KEY var is explicitly set
    // (wrangler dev --var). Never configured on the production deploy.
    if (env.DEV_ALLOW_KEY && key === env.DEV_ALLOW_KEY) return true;

    const keyHash = await this._sha256(key);
    const cacheKey = `lic:${keyHash}`;
    const cached = await env.AI_KV.get(cacheKey);
    if (cached === 'ok') return true;
    if (cached === 'no') return false;

    const res = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, organization_id: this._CFG.ORG_ID }),
    });
    let ok = false;
    if (res.ok) {
      const data = await res.json();
      ok = data?.status === 'granted' && data?.benefit_id === this._CFG.AI_BENEFIT;
    } else if (res.status >= 500) {
      // Polar hiccup: don't cache a negative, fail open for this request?
      // No — fail closed but uncached so the next request retries.
      return false;
    }
    await env.AI_KV.put(cacheKey, ok ? 'ok' : 'no', { expirationTtl: this._CFG.LICENSE_CACHE_SEC });
    return ok;
  },

  async _bumpCounter(kvKey, limit, ttlSec, env) {
    const raw = await env.AI_KV.get(kvKey);
    const n = raw ? parseInt(raw, 10) : 0;
    if (n >= limit) return { allowed: false, used: n };
    await env.AI_KV.put(kvKey, String(n + 1), { expirationTtl: ttlSec });
    return { allowed: true, used: n + 1 };
  },

  async _analyze(request, env) {
    if (!env.AI) return this._json({ error: 'ai_unconfigured' }, 500);

    let body;
    try { body = await request.json(); } catch { return this._json({ error: 'invalid_json' }, 400); }
    const key = String(body.licenseKey || '').trim();
    const prompt = String(body.prompt || '');
    if (!key) return this._json({ error: 'missing_license' }, 401);
    if (!prompt || prompt.length > this._CFG.MAX_PROMPT_CHARS) {
      return this._json({ error: 'invalid_prompt' }, 400);
    }

    if (!(await this._licenseOk(key, env))) {
      return this._json({ error: 'license_invalid' }, 403);
    }

    const keyHash = await this._sha256(key);

    // Per-minute abuse guard
    const minute = Math.floor(Date.now() / 60000);
    const rpm = await this._bumpCounter(`rpm:${keyHash}:${minute}`, this._CFG.RPM_LIMIT, 120, env);
    if (!rpm.allowed) return this._json({ error: 'rate_limited' }, 429);

    // Monthly quota — advertised number, visible to the client on every call
    const month = new Date().toISOString().slice(0, 7);
    const quotaKey = `q:${keyHash}:${month}`;
    const quota = await this._bumpCounter(quotaKey, this._CFG.MONTHLY_LIMIT, 40 * 24 * 3600, env);
    if (!quota.allowed) {
      return this._json({
        error: 'quota_exhausted',
        used: quota.used, limit: this._CFG.MONTHLY_LIMIT, month,
      }, 402);
    }

    const model = env.MODEL || this._CFG.MODEL_DEFAULT;
    const result = await env.AI.run(model, {
      messages: [
        { role: 'system', content: 'You are a precise assistant embedded in a bookmark manager. Always answer with ONLY the requested JSON — no prose, no markdown fences.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2048,
    });

    return this._json({
      text: result?.response ?? '',
      used: quota.used,
      limit: this._CFG.MONTHLY_LIMIT,
      month,
    }, 200);
  },

  _json(obj, status) {
    return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  },
  _cors(res) {
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(res.body, { status: res.status, headers });
  },
};
