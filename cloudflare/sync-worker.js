export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') {
        return this._cors(new Response(null, { status: 204 }));
      }

      if (url.pathname === '/health' && request.method === 'GET') {
        return this._cors(this._json({ ok: true }, 200));
      }

      if (url.pathname.startsWith('/sync')) {
        return await this._syncRouter(url, request, env);
      }

      return this._cors(this._json({ error: 'not_found' }, 404));
    } catch (err) {
      console.error('sync-worker error:', err && err.stack || err);
      return this._cors(this._json({ error: 'server_error' }, 500));
    }
  },

  // R2 layout per account:
  //   {accountId}/meta.json            -> key material (salts + wrapped DEKs). Server cannot derive keys.
  //   {accountId}/state                -> latest envelope { version, iv, ciphertext, updatedAt }
  //   {accountId}/history/{version}    -> snapshot copies (last MAX_HISTORY kept)
  // Account id is a high-entropy capability secret supplied via `Authorization: Bearer <accountId>`.

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
    if (!env.SYNC_BUCKET) {
      return this._cors(this._json({ error: 'sync_unconfigured', message: 'R2 bucket binding SYNC_BUCKET missing' }, 500));
    }
    const accountId = this._accountId(request);
    if (!accountId) {
      return this._cors(this._json({ error: 'unauthorized', message: 'Missing or malformed Bearer account id' }, 401));
    }
    const bucket = env.SYNC_BUCKET;
    const path = url.pathname.replace(/\/+$/, '');

    if (path === '/sync/meta') {
      if (request.method === 'GET') return await this._syncGetMeta(bucket, accountId);
      if (request.method === 'PUT') return await this._syncPutMeta(bucket, accountId, request);
      return this._cors(this._json({ error: 'method_not_allowed' }, 405));
    }

    if (path === '/sync/state') {
      if (request.method === 'GET') return await this._syncGetState(bucket, accountId);
      if (request.method === 'PUT') return await this._syncPutState(bucket, accountId, request);
      return this._cors(this._json({ error: 'method_not_allowed' }, 405));
    }

    if (path === '/sync/history' && request.method === 'GET') {
      return await this._syncHistoryList(bucket, accountId);
    }
    const histMatch = path.match(/^\/sync\/history\/(\d+)$/);
    if (histMatch && request.method === 'GET') {
      return await this._syncHistoryGet(bucket, accountId, histMatch[1]);
    }

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
    // ciphertext is base64 — compare actual decoded bytes against the limit,
    // not character count (chars ≈ bytes × 4/3, the old check under-allowed).
    const approxBytes = Math.floor(body.ciphertext.length * 3 / 4);
    if (approxBytes > this._SYNC.MAX_BLOB_BYTES) {
      return this._cors(this._json({ error: 'too_large' }, 413));
    }
    const baseVersion = Number(body.baseVersion);
    if (!Number.isInteger(baseVersion) || baseVersion < 0) {
      return this._cors(this._json({ error: 'missing_field', field: 'baseVersion' }, 400));
    }

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

    // Close the check-then-put race: two devices reading the same
    // currentVersion could both pass the check above; the conditional put
    // (etag of the exact object we read) lets only the first one win —
    // the loser gets a 409 and re-merges client-side.
    const putOptions = { httpMetadata: { contentType: 'application/json' } };
    if (current) {
      // R2Conditional wants the UNQUOTED etag (R2Object.etag) — passing
      // httpEtag (quoted form) makes the put throw, not just mismatch.
      putOptions.onlyIf = { etagMatches: current.etag };
    }
    const putRes = await bucket.put(`${accountId}/state`, serialized, putOptions);
    if (current && putRes === null) {
      return this._cors(this._json({ error: 'conflict', currentVersion }, 409));
    }
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
    } catch (_) {}
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
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return new Response(res.body, { status: res.status, headers });
  }
};
