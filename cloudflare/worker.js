export default {
  async fetch(request, env, ctx) {
    // Support both Module Worker (env param) and Service Worker (globals) deployments
    env = this._coerceEnv(env);
    const url = new URL(request.url);
    // Strip any path prefix (e.g. /raindrop/auth/start → /auth/start) so routes
    // work whether the worker is deployed at root or behind a path prefix.
    const knownSegments = ['/auth/', '/token/', '/sync', '/health', '/env'];
    const rawPath = url.pathname;
    const isKnown = knownSegments.some(s => rawPath === s.replace(/\/$/, '') || rawPath.startsWith(s));
    const pathname = isKnown ? rawPath : (rawPath.replace(/^\/[^/]+/, '') || '/');
    try {
      // Basic CORS for extension fetches
      if (request.method === 'OPTIONS') {
        return this._cors(new Response(null, { status: 204 }));
      }

      if (pathname === '/health' && request.method === 'GET') {
        return this._cors(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (pathname === '/env-ok' && request.method === 'GET') {
        const base = this._baseUrl(url);
        return this._cors(new Response(JSON.stringify({
          hasClientId: !!env.RAINDROP_CLIENT_ID,
          hasClientSecret: !!env.RAINDROP_CLIENT_SECRET,
          hasSessionSecret: !!env.SESSION_SECRET,
          callback: base + '/auth/callback'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (pathname === '/env-keys' && request.method === 'GET') {
        // Debug endpoint: show which env keys are visible (no values)
        const keys = Object.keys(env || {}).filter(k => !k.toLowerCase().includes('secret'));
        const globals = {
          hasGlobalClientId: this._hasGlobal('RAINDROP_CLIENT_ID'),
          hasGlobalClientSecret: this._hasGlobal('RAINDROP_CLIENT_SECRET'),
          hasGlobalSessionSecret: this._hasGlobal('SESSION_SECRET')
        };
        return this._cors(new Response(JSON.stringify({ keys, ...globals }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      if (pathname === '/auth/start' && request.method === 'GET') {
        return await this._authStart(url, env);
      }
      if (pathname === '/auth/callback' && request.method === 'GET') {
        return await this._authCallback(url, env);
      }
      if (pathname === '/auth/fetch' && request.method === 'GET') {
        return await this._authFetch(url, env);
      }
      if (pathname === '/token/refresh' && request.method === 'POST') {
        return await this._tokenRefresh(request, env);
      }

      // ---- E2E encrypted bookmark sync (R2-backed) ----
      // The server only ever stores opaque ciphertext + key material it cannot decrypt.
      if (pathname.startsWith('/sync')) {
        return await this._syncRouter(url, request, env);
      }

      return this._cors(new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    } catch (err) {
      return this._cors(new Response(JSON.stringify({ error: 'server_error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
    }
  },

  async _authStart(url, env) {
    env = this._coerceEnv(env);
    const extRedirect = url.searchParams.get('ext_redirect');
    if (!extRedirect) {
      return this._cors(new Response(JSON.stringify({ error: 'missing_param', param: 'ext_redirect' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }
    if (!env.RAINDROP_CLIENT_ID || !env.RAINDROP_CLIENT_SECRET) {
      console.log('Missing env vars', {
        hasClientId: !!env.RAINDROP_CLIENT_ID,
        hasClientSecret: !!env.RAINDROP_CLIENT_SECRET,
        hasSessionSecret: !!env.SESSION_SECRET
      });
      return this._cors(new Response(JSON.stringify({ error: 'missing_env', details: {
        RAINDROP_CLIENT_ID: !!env.RAINDROP_CLIENT_ID,
        RAINDROP_CLIENT_SECRET: !!env.RAINDROP_CLIENT_SECRET,
        SESSION_SECRET: !!env.SESSION_SECRET
      }}), { status: 500, headers: { 'Content-Type': 'application/json' } }));
    }

    const base = this._baseUrl(url);
    const statePayload = { ext_redirect: extRedirect, nonce: crypto.getRandomValues(new Uint32Array(1))[0].toString(16), t: Date.now() };
    const state = this._b64urlEncode(JSON.stringify(statePayload));

    const authorize = new URL('https://raindrop.io/oauth/authorize');
    authorize.searchParams.set('client_id', env.RAINDROP_CLIENT_ID);
    authorize.searchParams.set('redirect_uri', `${base}/auth/callback`);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('state', state);

    return Response.redirect(authorize.toString(), 302);
  },

  async _authCallback(url, env) {
    env = this._coerceEnv(env);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) {
      return new Response('Missing code/state', { status: 400 });
    }

    let statePayload;
    try {
      statePayload = JSON.parse(this._b64urlDecode(state));
    } catch {
      return new Response('Invalid state', { status: 400 });
    }
    const extRedirect = statePayload.ext_redirect;
    if (!extRedirect) {
      return new Response('Invalid state: no ext_redirect', { status: 400 });
    }

    // Exchange code for tokens
    const base = this._baseUrl(url);
    const tokenRes = await fetch('https://raindrop.io/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.RAINDROP_CLIENT_ID,
        client_secret: env.RAINDROP_CLIENT_SECRET,
        code,
        redirect_uri: `${base}/auth/callback`,
        grant_type: 'authorization_code'
      }).toString()
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return new Response(`Token exchange failed: ${tokenRes.status} ${text}`, { status: 502 });
    }
    const token = await tokenRes.json();

    // Build signed session_code (no storage)
    const payload = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: token.expires_in,
      t: Date.now()
    };
    const sessionCode = await this._signPayload(payload, env.SESSION_SECRET);

    // Redirect back to extension redirect with session_code
    const final = new URL(extRedirect);
    final.searchParams.set('session_code', sessionCode);
    return Response.redirect(final.toString(), 302);
  },

  async _authFetch(url, env) {
    const sessionCode = url.searchParams.get('session_code');
    if (!sessionCode) {
      return this._cors(new Response(JSON.stringify({ error: 'missing_param', param: 'session_code' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    console.log('_authFetch: sessionCode received:', sessionCode.substring(0, 20) + '...');

    let payload;
    try {
      payload = await this._verifySessionCode(sessionCode, env.SESSION_SECRET);
      console.log('_authFetch: payload verified:', payload);
    } catch (error) {
      console.log('_authFetch: verification error:', error.message);
      return this._cors(new Response(JSON.stringify({ error: 'invalid_session_code', details: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    if (!payload) {
      console.log('_authFetch: payload is null/undefined');
      return this._cors(new Response(JSON.stringify({ error: 'invalid_session_code' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    // Ensure we have required fields
    if (!payload.access_token) {
      console.log('_authFetch: payload missing access_token:', payload);
      return this._cors(new Response(JSON.stringify({ error: 'invalid_payload', payload }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    console.log('_authFetch: returning payload with access_token');
    return this._cors(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  },

  async _tokenRefresh(request, env) {
    env = this._coerceEnv(env);
    let body;
    try {
      body = await request.json();
    } catch {
      return this._cors(new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }
    if (!body || !body.refresh_token) {
      return this._cors(new Response(JSON.stringify({ error: 'missing_param', param: 'refresh_token' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    const tokenRes = await fetch('https://raindrop.io/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.RAINDROP_CLIENT_ID,
        client_secret: env.RAINDROP_CLIENT_SECRET,
        refresh_token: body.refresh_token,
        grant_type: 'refresh_token'
      }).toString()
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return this._cors(new Response(JSON.stringify({ error: 'refresh_failed', status: tokenRes.status, detail: text }), { status: 502, headers: { 'Content-Type': 'application/json' } }));
    }
    const json = await tokenRes.json();
    return this._cors(new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  },

  // ===================== E2E Sync =====================
  // R2 layout per account:
  //   {accountId}/meta.json            -> key material (salts + wrapped DEKs). Server cannot derive keys.
  //   {accountId}/state                -> latest envelope { version, iv, ciphertext, updatedAt }
  //   {accountId}/history/{version}    -> snapshot copies (last MAX_HISTORY kept)
  // Account id is a high-entropy capability secret supplied via `Authorization: Bearer <accountId>`.
  // We never place it in the URL so it does not leak through request logs.

  get _SYNC() {
    return { MAX_HISTORY: 20, MAX_BLOB_BYTES: 8 * 1024 * 1024, ID_RE: /^[A-Za-z0-9_-]{32,128}$/ };
  },

  _accountId(request) {
    const auth = request.headers.get('Authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const id = m ? m[1].trim() : '';
    return this._SYNC.ID_RE.test(id) ? id : null;
  },

  async _syncRouter(url, request, env) {
    env = this._coerceEnv(env);
    if (!env.SYNC_BUCKET) {
      return this._cors(this._json({ error: 'sync_unconfigured', message: 'R2 bucket binding SYNC_BUCKET missing' }, 500));
    }
    const accountId = this._accountId(request);
    if (!accountId) {
      return this._cors(this._json({ error: 'unauthorized', message: 'Missing or malformed Bearer account id' }, 401));
    }
    const bucket = env.SYNC_BUCKET;
    const path = url.pathname.replace(/\/+$/, '');

    // /sync/meta  (key material)
    if (path === '/sync/meta') {
      if (request.method === 'GET') return await this._syncGetMeta(bucket, accountId);
      if (request.method === 'PUT') return await this._syncPutMeta(bucket, accountId, request);
      return this._cors(this._json({ error: 'method_not_allowed' }, 405));
    }

    // /sync/state  (latest encrypted bookmark blob)
    if (path === '/sync/state') {
      if (request.method === 'GET') return await this._syncGetState(bucket, accountId);
      if (request.method === 'PUT') return await this._syncPutState(bucket, accountId, request);
      return this._cors(this._json({ error: 'method_not_allowed' }, 405));
    }

    // /sync/history  (list versions)
    if (path === '/sync/history' && request.method === 'GET') {
      return await this._syncHistoryList(bucket, accountId);
    }
    // /sync/history/{version}
    const histMatch = path.match(/^\/sync\/history\/(\d+)$/);
    if (histMatch && request.method === 'GET') {
      return await this._syncHistoryGet(bucket, accountId, histMatch[1]);
    }

    // /sync  DELETE -> wipe everything for this account
    if (path === '/sync' && request.method === 'DELETE') {
      return await this._syncWipe(bucket, accountId);
    }

    return this._cors(this._json({ error: 'not_found' }, 404));
  },

  async _syncGetMeta(bucket, accountId) {
    const obj = await bucket.get(`${accountId}/meta.json`);
    if (!obj) return this._cors(this._json({ error: 'no_meta' }, 404));
    const text = await obj.text();
    return this._cors(new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } }));
  },

  async _syncPutMeta(bucket, accountId, request) {
    let body;
    try { body = await request.json(); } catch { return this._cors(this._json({ error: 'invalid_json' }, 400)); }
    // Validate the shape but never inspect/trust the values beyond presence.
    const required = ['saltPass', 'saltRec', 'wrappedDEKPass', 'wrappedDEKRec'];
    for (const k of required) {
      if (typeof body[k] !== 'string' || !body[k]) {
        return this._cors(this._json({ error: 'missing_field', field: k }, 400));
      }
    }
    const meta = {
      saltPass: body.saltPass,
      saltRec: body.saltRec,
      wrappedDEKPass: body.wrappedDEKPass,
      wrappedDEKRec: body.wrappedDEKRec,
      kdf: body.kdf || { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 },
      updatedAt: Date.now()
    };
    await bucket.put(`${accountId}/meta.json`, JSON.stringify(meta), {
      httpMetadata: { contentType: 'application/json' }
    });
    return this._cors(this._json({ ok: true, updatedAt: meta.updatedAt }, 200));
  },

  async _syncGetState(bucket, accountId) {
    const obj = await bucket.get(`${accountId}/state`);
    if (!obj) return this._cors(this._json({ version: 0, empty: true }, 200));
    const text = await obj.text();
    return this._cors(new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } }));
  },

  async _syncPutState(bucket, accountId, request) {
    let body;
    try { body = await request.json(); } catch { return this._cors(this._json({ error: 'invalid_json' }, 400)); }
    if (typeof body.iv !== 'string' || typeof body.ciphertext !== 'string') {
      return this._cors(this._json({ error: 'missing_field', field: 'iv|ciphertext' }, 400));
    }
    if (body.ciphertext.length > this._SYNC.MAX_BLOB_BYTES) {
      return this._cors(this._json({ error: 'too_large' }, 413));
    }
    const baseVersion = Number(body.baseVersion);
    if (!Number.isInteger(baseVersion) || baseVersion < 0) {
      return this._cors(this._json({ error: 'missing_field', field: 'baseVersion' }, 400));
    }

    // Optimistic concurrency: current server version must match the base the client merged from.
    const current = await bucket.get(`${accountId}/state`);
    let currentVersion = 0;
    if (current) {
      try { currentVersion = Number(JSON.parse(await current.text()).version) || 0; } catch { currentVersion = 0; }
    }
    if (baseVersion !== currentVersion) {
      return this._cors(this._json({ error: 'conflict', currentVersion }, 409));
    }

    const nextVersion = currentVersion + 1;
    const envelope = {
      version: nextVersion,
      iv: body.iv,
      ciphertext: body.ciphertext,
      updatedAt: Date.now()
    };
    const serialized = JSON.stringify(envelope);
    await bucket.put(`${accountId}/state`, serialized, { httpMetadata: { contentType: 'application/json' } });
    // Snapshot history copy, then prune.
    await bucket.put(`${accountId}/history/${nextVersion}`, serialized, { httpMetadata: { contentType: 'application/json' } });
    await this._syncPruneHistory(bucket, accountId);

    return this._cors(this._json({ ok: true, version: nextVersion, updatedAt: envelope.updatedAt }, 200));
  },

  async _syncPruneHistory(bucket, accountId) {
    try {
      const listed = await bucket.list({ prefix: `${accountId}/history/` });
      const versions = (listed.objects || [])
        .map(o => ({ key: o.key, v: Number(o.key.split('/').pop()) }))
        .filter(x => Number.isInteger(x.v))
        .sort((a, b) => b.v - a.v);
      const stale = versions.slice(this._SYNC.MAX_HISTORY);
      await Promise.all(stale.map(s => bucket.delete(s.key)));
    } catch (_) { /* pruning is best-effort */ }
  },

  async _syncHistoryList(bucket, accountId) {
    const listed = await bucket.list({ prefix: `${accountId}/history/` });
    const versions = (listed.objects || [])
      .map(o => ({ version: Number(o.key.split('/').pop()), size: o.size, uploaded: o.uploaded }))
      .filter(x => Number.isInteger(x.version))
      .sort((a, b) => b.version - a.version);
    return this._cors(this._json({ versions }, 200));
  },

  async _syncHistoryGet(bucket, accountId, version) {
    const obj = await bucket.get(`${accountId}/history/${version}`);
    if (!obj) return this._cors(this._json({ error: 'not_found' }, 404));
    const text = await obj.text();
    return this._cors(new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } }));
  },

  async _syncWipe(bucket, accountId) {
    const listed = await bucket.list({ prefix: `${accountId}/` });
    await Promise.all((listed.objects || []).map(o => bucket.delete(o.key)));
    return this._cors(this._json({ ok: true, deleted: (listed.objects || []).length }, 200));
  },

  _json(obj, status) {
    return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  },

  _cors(res) {
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return new Response(res.body, { status: res.status, headers });
  },

  _coerceEnv(env) {
    try {
      // In Service Worker format, bindings are exposed as globals
      if (typeof RAINDROP_CLIENT_ID !== 'undefined' && !env.RAINDROP_CLIENT_ID) env.RAINDROP_CLIENT_ID = RAINDROP_CLIENT_ID;
      if (typeof RAINDROP_CLIENT_SECRET !== 'undefined' && !env.RAINDROP_CLIENT_SECRET) env.RAINDROP_CLIENT_SECRET = RAINDROP_CLIENT_SECRET;
      if (typeof SESSION_SECRET !== 'undefined' && !env.SESSION_SECRET) env.SESSION_SECRET = SESSION_SECRET;
    } catch (_) {}
    return env || {};
  },

  _hasGlobal(name) {
    try {
      // eslint-disable-next-line no-new-func
      return new Function(`return typeof ${name} !== 'undefined'`)();
    } catch (_) {
      return false;
    }
  },

  _baseUrl(url) {
    const authIdx = url.pathname.indexOf('/auth/');
    const prefix = authIdx > 0 ? url.pathname.slice(0, authIdx) : '';
    return `${url.protocol}//${url.host}${prefix}`;
  },

  _b64urlEncode(s) {
    return btoa(unescape(encodeURIComponent(s))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  },
  _b64urlDecode(s) {
    s = s.replaceAll('-', '+').replaceAll('_', '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  },

  async _signPayload(obj, secret) {
    const json = JSON.stringify(obj);
    const dataB64 = this._b64urlEncode(json);
    const sigB64 = await this._hmacB64(dataB64, secret);
    return `${dataB64}.${sigB64}`;
  },

  async _verifySessionCode(code, secret) {
    const parts = code.split('.');
    if (parts.length !== 2) throw new Error('bad_format');
    const [dataB64, sig] = parts;
    const expected = await this._hmacB64(dataB64, secret);
    if (sig !== expected) throw new Error('bad_sig');
    const json = this._b64urlDecode(dataB64);
    return JSON.parse(json);
  },

  async _hmacB64(data, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    const bytes = new Uint8Array(sig);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return this._b64urlEncode(bin);
  }
};
