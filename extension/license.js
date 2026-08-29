/**
 * Folio licensing — Polar.sh license keys (same org as the other studio
 * products, so foreign keys from AdPilot/Mailskin/Pulsar activate fine at
 * Polar and MUST be rejected here by benefit id).
 *
 * Plans: free (default) · pro ($2) · ai_pro ($5, includes metered AI).
 * Validation uses Polar's PUBLIC customer-portal endpoints — no backend
 * secret involved. 12h cache, 72h offline grace on network errors; a
 * definitive "not granted" from Polar downgrades immediately.
 */
(function (root) {
  'use strict';

  const POLAR_API = 'https://api.polar.sh/v1/customer-portal/license-keys';
  const POLAR_ORG_ID = 'b0760693-97ab-4bd8-9367-d61530ea0f69';

  const BENEFIT_PLANS = {
    'db0d51d3-a276-4811-8e1f-01fbb39cc70d': 'pro',
    'a184a03b-6439-47d6-9a89-53da19780968': 'ai_pro',
  };

  const CACHE_MS = 12 * 60 * 60 * 1000;
  const GRACE_MS = 72 * 60 * 60 * 1000;
  const SK = 'folioLicense';

  const PLAN_FEATURES = {
    free:   { multiProfile: false, historyRestore: false, extBackup: false, deadLinks: false, sessions: false, autoRules: false, includedAI: false },
    pro:    { multiProfile: true,  historyRestore: true,  extBackup: true,  deadLinks: true,  sessions: true,  autoRules: true,  includedAI: false },
    ai_pro: { multiProfile: true,  historyRestore: true,  extBackup: true,  deadLinks: true,  sessions: true,  autoRules: true,  includedAI: true  },
  };

  async function _load() {
    const { [SK]: st } = await chrome.storage.local.get([SK]);
    return st || {};
  }
  async function _save(patch) {
    const st = await _load();
    await chrome.storage.local.set({ [SK]: { ...st, ...patch } });
  }

  async function _post(path, body) {
    const res = await fetch(`${POLAR_API}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  }

  async function activate(licenseKey) {
    const key = String(licenseKey || '').trim();
    if (!key) throw new Error('empty_key');

    const r = await _post('activate', {
      key, organization_id: POLAR_ORG_ID,
      label: 'folio-' + (new Date().toISOString().slice(0, 10)),
    });
    if (!r.ok) {
      throw new Error(r.data?.detail?.[0]?.msg || r.data?.detail || 'activation_failed');
    }
    const lk = r.data?.license_key || {};
    if (lk.status !== 'granted') throw new Error('key_not_active');

    const plan = BENEFIT_PLANS[lk.benefit_id];
    const activationId = r.data?.id || '';
    if (!plan) {
      // Another product's key from the shared org — release the slot we
      // just consumed there and refuse with a clear message.
      _post('deactivate', { key, organization_id: POLAR_ORG_ID, activation_id: activationId }).catch(() => {});
      throw new Error('not_a_folio_key');
    }

    await _save({ key, activationId, plan, checkedAt: Date.now() });
    return { plan };
  }

  async function deactivate() {
    const st = await _load();
    // Local state clears instantly; slot release at Polar is best-effort.
    await chrome.storage.local.remove([SK]);
    if (st.key && st.activationId) {
      _post('deactivate', {
        key: st.key, organization_id: POLAR_ORG_ID, activation_id: st.activationId,
      }).catch(() => {});
    }
    return { ok: true };
  }

  /** Current plan with cache + offline grace. Never throws. */
  async function getPlan({ force = false } = {}) {
    const st = await _load();
    if (!st.key) return 'free';
    const age = Date.now() - (st.checkedAt || 0);
    if (!force && age < CACHE_MS) return st.plan || 'free';

    try {
      const r = await _post('validate', {
        key: st.key, organization_id: POLAR_ORG_ID, activation_id: st.activationId,
      });
      if (r.ok && r.data?.status === 'granted') {
        const plan = BENEFIT_PLANS[r.data.benefit_id] || st.plan || 'free';
        await _save({ plan, checkedAt: Date.now() });
        return plan;
      }
      if (r.status >= 400 && r.status < 500) {
        // Polar's definitive answer: key revoked/expired — downgrade now.
        await _save({ plan: 'free', checkedAt: Date.now() });
        return 'free';
      }
    } catch (_) { /* network error → grace below */ }

    // Network trouble: keep the last known plan within the grace window.
    if (age < CACHE_MS + GRACE_MS) return st.plan || 'free';
    return 'free';
  }

  async function status() {
    const st = await _load();
    const plan = await getPlan();
    return {
      plan,
      features: PLAN_FEATURES[plan] || PLAN_FEATURES.free,
      hasKey: !!st.key,
      keyMasked: st.key ? st.key.slice(0, 9) + '…' + st.key.slice(-4) : null,
      checkedAt: st.checkedAt || null,
      aiUsage: st.aiUsage || null, // { used, limit, month } — updated by AI calls
    };
  }

  async function can(feature) {
    const plan = await getPlan();
    return !!(PLAN_FEATURES[plan] || PLAN_FEATURES.free)[feature];
  }

  async function getKey() {
    return (await _load()).key || null;
  }

  async function recordAiUsage(used, limit) {
    const month = new Date().toISOString().slice(0, 7);
    await _save({ aiUsage: { used, limit, month } });
  }

  root.FolioLicense = { activate, deactivate, getPlan, status, can, getKey, recordAiUsage, PLAN_FEATURES };
})(typeof self !== 'undefined' ? self : this);
