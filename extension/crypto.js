// Folio E2E crypto — envelope encryption for encrypted bookmark sync.
//
// Design (the server NEVER sees any of the keys or the passphrase):
//   DEK            random AES-256-GCM data key — the only key that encrypts bookmark data.
//   KEK(pass)      PBKDF2(passphrase, saltPass) — wraps the DEK.
//   KEK(recovery)  PBKDF2(recoveryKey, saltRec) — wraps the DEK independently.
//   meta.json (on server) = { saltPass, saltRec, wrappedDEKPass, wrappedDEKRec }
//
// Opening: derive KEK from passphrase OR recovery key -> unwrap DEK -> decrypt data.
// Changing the passphrase only re-wraps the DEK; data is never re-encrypted.
//
// Exposed as self.FolioCrypto so it works in both the service worker
// (importScripts) and the options page (<script src>).

(function (root) {
  'use strict';

  const PBKDF2_ITERATIONS = 600000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const DEK_BYTES = 32; // AES-256
  const RECOVERY_BYTES = 20; // 160-bit recovery key
  const BASE32 = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789'; // Crockford-ish, no I/L/O/U

  // ---- byte/string helpers ----
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function bufToB64url(buf) {
    return bufToB64(buf).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ---- account id (high-entropy capability secret; matches worker ID_RE) ----
  function randomAccountId() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return bufToB64url(bytes); // 43 url-safe chars
  }

  // ---- recovery key: 160 bits, grouped base32 for readability ----
  function generateRecoveryKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_BYTES));
    let bits = 0, value = 0, out = '';
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        out += BASE32[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
    // group into chunks of 4: XXXX-XXXX-...
    return out.match(/.{1,4}/g).join('-');
  }
  function normalizeRecoveryKey(str) {
    return (str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // ---- single sync key (v2 auth) ------------------------------------------
  // ONE machine-generated secret replaces accountId+passphrase+recoveryKey:
  // the account id is DERIVED from it (deterministic), and it doubles as the
  // KEK passphrase. 160 random bits, so deriving the id from it leaks
  // nothing and can't be enumerated the way a human passphrase could.
  function generateSyncKey() {
    return 'FOLIO-' + generateRecoveryKey();
  }
  function normalizeSyncKey(str) {
    // strip the FOLIO prefix + all separators; case-insensitive
    return normalizeRecoveryKey(str).replace(/^FOLIO/, '');
  }
  function looksLikeSyncKey(str) {
    const n = normalizeSyncKey(str);
    return n.length >= 26; // 160-bit base32 = 32 chars; be lenient but not silly
  }
  async function deriveAccountIdFromKey(syncKey) {
    const normalized = normalizeSyncKey(syncKey);
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(normalized), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    // Fixed context salt is fine here: the input is a 160-bit random secret,
    // not a guessable human passphrase.
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode('folio-sync-account-v2'), iterations: 100000, hash: 'SHA-256' },
      baseKey, 256
    );
    return bufToB64url(new Uint8Array(bits)); // 43 url-safe chars — matches server ID_RE
  }

  // ---- key derivation ----
  async function deriveKEK(secretStr, saltBytes) {
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(secretStr), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ---- AES-GCM wrap/unwrap of raw bytes; returns/accepts base64(iv||ct) ----
  async function aesGcmWrap(kek, rawBytes) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, rawBytes);
    const packed = new Uint8Array(iv.length + ct.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ct), iv.length);
    return bufToB64(packed);
  }
  async function aesGcmUnwrap(kek, b64packed) {
    const packed = b64ToBuf(b64packed);
    const iv = packed.slice(0, IV_BYTES);
    const ct = packed.slice(IV_BYTES);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, ct));
  }

  // ---- public: create key material at first setup ----
  // Returns { meta, dek, recoveryKey } where meta is the JSON to PUT to the server.
  async function createKeyMaterial(passphrase) {
    const recoveryKey = generateRecoveryKey();
    const dekKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const dekRaw = new Uint8Array(await crypto.subtle.exportKey('raw', dekKey));

    const saltPass = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const saltRec = crypto.getRandomValues(new Uint8Array(SALT_BYTES));

    const kekPass = await deriveKEK(passphrase, saltPass);
    const kekRec = await deriveKEK(normalizeRecoveryKey(recoveryKey), saltRec);

    const meta = {
      saltPass: bufToB64(saltPass),
      saltRec: bufToB64(saltRec),
      wrappedDEKPass: await aesGcmWrap(kekPass, dekRaw),
      wrappedDEKRec: await aesGcmWrap(kekRec, dekRaw),
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS }
    };

    // Re-import DEK as non-extractable for runtime use.
    const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    return { meta, dek, recoveryKey };
  }

  // ---- public: unwrap DEK from existing meta using passphrase OR recovery key ----
  async function unwrapDEK(meta, { passphrase, recoveryKey } = {}) {
    let kek, wrapped;
    if (passphrase != null) {
      kek = await deriveKEK(passphrase, b64ToBuf(meta.saltPass));
      wrapped = meta.wrappedDEKPass;
    } else if (recoveryKey != null) {
      kek = await deriveKEK(normalizeRecoveryKey(recoveryKey), b64ToBuf(meta.saltRec));
      wrapped = meta.wrappedDEKRec;
    } else {
      throw new Error('passphrase or recoveryKey required');
    }
    let dekRaw;
    try {
      dekRaw = await aesGcmUnwrap(kek, wrapped);
    } catch (_) {
      throw new Error('wrong_secret'); // AES-GCM auth tag failed = bad passphrase/recovery key
    }
    return crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  // ---- public: encrypt/decrypt bookmark data with the DEK ----
  async function encryptData(dek, plaintextString) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, enc.encode(plaintextString));
    return { iv: bufToB64(iv), ciphertext: bufToB64(ct) };
  }
  async function decryptData(dek, ivB64, ciphertextB64) {
    const iv = b64ToBuf(ivB64);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, b64ToBuf(ciphertextB64));
    return dec.decode(pt);
  }

  root.FolioCrypto = {
    randomAccountId,
    generateRecoveryKey,
    generateSyncKey,
    normalizeSyncKey,
    looksLikeSyncKey,
    deriveAccountIdFromKey,
    createKeyMaterial,
    unwrapDEK,
    encryptData,
    decryptData,
    _internal: { deriveKEK, aesGcmWrap, aesGcmUnwrap, normalizeRecoveryKey }
  };
})(typeof self !== 'undefined' ? self : this);
