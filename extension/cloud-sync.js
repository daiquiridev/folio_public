// Folio cloud sync engine — two-way, end-to-end encrypted bookmark sync with profile support.
//
// The server (R2-backed worker) only ever stores opaque ciphertext. All merge
// logic runs here, on the device, against decrypted state.
//
// Blob format (v2):
//   { v: 2, profiles: { [id]: { id, name, items } }, settings: { ... } }
//
// Legacy (v1) blobs ({ items: {} }) are auto-migrated to v2 on first sync.
//
// Exposed as self.FolioCloudSync (importScripts in SW, <script> in options page).

(function (root) {
  'use strict';

  const FC = root.FolioCrypto;
  const EXT = root.FolioExtBackup || null;
  const DEFAULT_BASE_URL = 'https://sync.folio.daiquiri.dev';

  // Virtual GUIDs for the fixed browser roots.
  const ROOT_LOCAL_TO_GUID = { '1': 'ROOT_BAR', '2': 'ROOT_OTHER', '3': 'ROOT_MOBILE' };
  const ROOT_GUID_TO_LOCAL = { ROOT_BAR: '1', ROOT_OTHER: '2', ROOT_MOBILE: '3' };
  const ROOT_GUIDS = new Set(Object.values(ROOT_LOCAL_TO_GUID));

  const SK = 'cloudSync'; // storage key namespace

  // Raindrop settings that are safe to sync across devices (no tokens, no device-specific IDs).
  const SYNCABLE_SETTINGS = [
    'syncEnabled', 'syncIntervalMinutes', 'twoWayMode', 'collectionImportMode',
    'collectionsSort', 'bookmarksSort', 'rateLimitRpm', 'selectedCollectionIds',
  ];

  // ---------------- storage helpers ----------------
  async function loadConfig() {
    const { [SK]: cfg } = await chrome.storage.local.get([SK]);
    return cfg || {};
  }
  async function saveConfig(patch) {
    const cfg = await loadConfig();
    const next = { ...cfg, ...patch };
    await chrome.storage.local.set({ [SK]: next });
    return next;
  }

  async function getBaseUrl() {
    const cfg = await loadConfig();
    return (cfg.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  // ---------------- device id ----------------
  let _deviceIdInflight = null;
  async function _ensureDeviceId() {
    const cfg = await loadConfig();
    if (cfg.deviceId) return cfg.deviceId;
    if (_deviceIdInflight) return _deviceIdInflight;
    _deviceIdInflight = (async () => {
      // Re-read under the inflight gate to handle a concurrent call that already wrote.
      const fresh = await loadConfig();
      if (fresh.deviceId) return fresh.deviceId;
      const id = 'dev-' + ((crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36));
      await saveConfig({ deviceId: id });
      return id;
    })();
    try { return await _deviceIdInflight; } finally { _deviceIdInflight = null; }
  }

  // ---------------- DEK (in-memory + cached) ----------------
  let _dek = null;
  async function getDek() {
    if (_dek) return _dek;
    const cfg = await loadConfig();
    if (cfg.dekRaw) {
      _dek = await crypto.subtle.importKey('raw', _b64ToBuf(cfg.dekRaw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      return _dek;
    }
    return null;
  }
  function _b64ToBuf(b64) {
    const bin = atob(b64); const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function _bufToB64(buf) {
    const a = new Uint8Array(buf); let s = '';
    for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }

  // ---------------- Profile helpers ----------------
  function newProfileId() {
    return 'profile-' + ((crypto.randomUUID && crypto.randomUUID()) || FC.randomAccountId().slice(0, 36));
  }

  // Migrate v1 blob ({ items }) to v2 ({ v:2, profiles, settings }).
  function _migrateBlobIfNeeded(blob, fallbackProfileId) {
    if (blob && blob.v === 2) return blob;
    const items = (blob && blob.items) ? blob.items : {};
    const pid = fallbackProfileId || 'profile-default';
    return { v: 2, profiles: { [pid]: { id: pid, name: 'Default', items } }, settings: {} };
  }

  // Migrate old flat local config (pre-profiles) to per-profile format.
  async function _migrateConfigIfNeeded() {
    const cfg = await loadConfig();
    if (cfg.profileStates) return cfg; // already migrated

    const defaultId = 'profile-default';
    const migrated = {
      accountId: cfg.accountId,
      meta: cfg.meta,
      dekRaw: cfg.dekRaw,
      enabled: cfg.enabled,
      activeProfileId: defaultId,
      profileStates: {
        [defaultId]: {
          base: cfg.base || { items: {} },
          baseVersion: cfg.baseVersion || 0,
          guidToLocal: cfg.guidToLocal || {},
          localToGuid: cfg.localToGuid || {},
          localMeta: cfg.localMeta || {},
          lastSyncAt: cfg.lastSyncAt || null,
        },
      },
    };
    if (cfg.baseUrl) migrated.baseUrl = cfg.baseUrl;
    await chrome.storage.local.set({ [SK]: migrated });
    return migrated;
  }

  // ---------------- setup / join ----------------
  async function _persistLink(accountId, meta, dek, dekRaw) {
    const defaultId = 'profile-default';
    await chrome.storage.local.set({
      [SK]: {
        accountId, meta, dekRaw, enabled: true,
        activeProfileId: defaultId,
        profileStates: {
          [defaultId]: {
            base: { items: {} }, baseVersion: 0,
            guidToLocal: {}, localToGuid: {}, localMeta: {}, lastSyncAt: null,
          },
        },
      },
    });
    _dek = dek;
  }

  /**
   * v2 setup: ONE machine-generated sync key is the whole identity — the
   * account id is derived from it and it doubles as the KEK secret. The
   * user saves a single string; there is no separate account id, passphrase
   * or recovery key anymore.
   */
  async function setupNew() {
    const syncKey = FC.generateSyncKey();
    const accountId = await FC.deriveAccountIdFromKey(syncKey);
    const { meta } = await FC.createKeyMaterial(syncKey); // recovery wrap unused in v2, schema kept for the server
    const dek = await FC.unwrapDEK(meta, { passphrase: syncKey });
    const dekRaw = await _exportDekViaUnwrap(meta, syncKey);
    await _putMeta(accountId, meta);
    await _persistLink(accountId, meta, dek, dekRaw);
    return { syncKey };
  }

  /**
   * v2 join with the single sync key. Deliberately does NOT pick a profile:
   * the device links to the account and then the user chooses which cloud
   * profile this browser should attach to (and how — download/merge/upload)
   * via selectProfile(). Until then sync operations are held.
   */
  async function joinWithKey(rawKey) {
    const syncKey = String(rawKey || '').trim();
    if (!FC.looksLikeSyncKey(syncKey)) throw new Error('invalid_key');
    const accountId = await FC.deriveAccountIdFromKey(syncKey);
    const meta = await _getMeta(accountId);
    if (!meta) throw new Error('no_account');
    const dek = await FC.unwrapDEK(meta, { passphrase: syncKey });
    const dekRaw = await _exportDekViaUnwrap(meta, syncKey);
    await chrome.storage.local.set({
      [SK]: {
        accountId, meta, dekRaw, enabled: true,
        activeProfileId: null, needsProfilePick: true, profileStates: {},
      },
    });
    _dek = dek;
    return { ok: true, needsProfilePick: true };
  }

  /**
   * Attach this browser to a cloud profile, chosen by the user after join.
   * mode: 'download' → replace local bookmarks with the profile (snapshot +
   * rollback), 'sync' → 3-way merge both sides, 'upload' → replace the
   * cloud profile with this browser's bookmarks.
   */
  async function selectProfile(profileId, mode) {
    const cfg = await loadConfig();
    if (!cfg.accountId) throw new Error('no_account');
    const dek = await getDek();
    if (!dek) throw new Error('locked');
    if (!['download', 'sync', 'upload'].includes(mode)) throw new Error('invalid_mode');

    const remoteEnv = await _getState(cfg.accountId);
    let blob = { v: 2, profiles: {}, settings: {} };
    if (!remoteEnv.empty && remoteEnv.ciphertext) {
      blob = _migrateBlobIfNeeded(JSON.parse(await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext)), profileId);
    }
    const target = blob.profiles[profileId];
    if (!target && mode === 'download') throw new Error('profile_not_found');

    if (mode === 'download') {
      const snapshot = await _snapshotBookmarks();
      await chrome.storage.local.set({ profileSwitchSnapshot: { fromProfileId: null, snapshot, at: Date.now() } });
      let applied;
      try {
        await _clearBrowser();
        const emptyState = { base: { items: {} }, baseVersion: 0, guidToLocal: {}, localToGuid: {}, localMeta: {} };
        applied = await applyToBrowser({ items: target.items || {} }, emptyState);
      } catch (err) {
        try { await _restoreSnapshot((await chrome.storage.local.get(['profileSwitchSnapshot'])).profileSwitchSnapshot.snapshot); } catch (_) {}
        throw err;
      }
      await chrome.storage.local.remove(['profileSwitchSnapshot']);
      await saveConfig({
        activeProfileId: profileId, needsProfilePick: false,
        profileStates: {
          ...(cfg.profileStates || {}),
          [profileId]: {
            base: { items: target.items || {} }, baseVersion: remoteEnv.version || 0,
            guidToLocal: applied.guidToLocal, localToGuid: applied.localToGuid,
            localMeta: {}, lastSyncAt: Date.now(),
          },
        },
      });
      await _recordSync('success', `Downloaded profile to this browser`, Object.keys(target.items || {}).length);
      return { ok: true, mode };
    }

    // 'sync' ve 'upload': önce profili aktif yap (boş base), sonra işlemi koştur
    await saveConfig({
      activeProfileId: profileId, needsProfilePick: false,
      profileStates: {
        ...(cfg.profileStates || {}),
        [profileId]: {
          base: { items: {} }, baseVersion: 0,
          guidToLocal: {}, localToGuid: {}, localMeta: {}, lastSyncAt: null,
        },
      },
    });
    const result = mode === 'sync' ? await sync() : await uploadOnly();
    return { ok: true, mode, result };
  }

  /** Legacy join (pre-v2 accounts: random account id + user passphrase). */
  async function joinExisting(accountId, { passphrase, recoveryKey }) {
    const meta = await _getMeta(accountId);
    if (!meta) throw new Error('no_account');
    const dek = await FC.unwrapDEK(meta, { passphrase, recoveryKey });
    const dekRaw = await _exportDekViaUnwrap(meta, passphrase, recoveryKey);
    await _persistLink(accountId, meta, dek, dekRaw);
    return { accountId };
  }

  async function _exportDekViaUnwrap(meta, passphrase, recoveryKey) {
    let kek, wrapped;
    if (passphrase != null) {
      kek = await FC._internal.deriveKEK(passphrase, _b64ToBuf(meta.saltPass));
      wrapped = meta.wrappedDEKPass;
    } else {
      kek = await FC._internal.deriveKEK(FC._internal.normalizeRecoveryKey(recoveryKey), _b64ToBuf(meta.saltRec));
      wrapped = meta.wrappedDEKRec;
    }
    const raw = await FC._internal.aesGcmUnwrap(kek, wrapped);
    return _bufToB64(raw);
  }

  // ---------------- server I/O ----------------
  function _authHeaders(accountId) {
    return { 'Authorization': `Bearer ${accountId}`, 'Content-Type': 'application/json' };
  }
  async function _putMeta(accountId, meta) {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/sync/meta`, { method: 'PUT', headers: _authHeaders(accountId), body: JSON.stringify(meta) });
    if (!res.ok) throw new Error(`put_meta_failed_${res.status}`);
  }
  async function _getMeta(accountId) {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/sync/meta`, { headers: _authHeaders(accountId) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`get_meta_failed_${res.status}`);
    return res.json();
  }
  async function _getState(accountId) {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/sync/state`, { headers: _authHeaders(accountId) });
    if (!res.ok) throw new Error(`get_state_failed_${res.status}`);
    return res.json(); // { version, iv?, ciphertext? } or { version:0, empty:true }
  }
  async function _putState(accountId, baseVersion, iv, ciphertext) {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/sync/state`, {
      method: 'PUT', headers: _authHeaders(accountId),
      body: JSON.stringify({ baseVersion, iv, ciphertext })
    });
    if (res.status === 409) return { conflict: true, currentVersion: (await res.json()).currentVersion };
    if (!res.ok) throw new Error(`put_state_failed_${res.status}`);
    return res.json();
  }

  // Fetch and decrypt the current remote blob. Returns v2 blob or null if empty.
  async function _fetchRemoteBlob(cfg, dek, activeId) {
    const remoteEnv = await _getState(cfg.accountId);
    if (remoteEnv.empty || !remoteEnv.ciphertext) return { v: 2, profiles: {}, settings: {}, _version: 0 };
    const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
    const blob = _migrateBlobIfNeeded(JSON.parse(json), activeId);
    blob._version = remoteEnv.version;
    return blob;
  }

  // ---------------- settings sync ----------------
  async function _readSyncableSettings() {
    const data = await chrome.storage.sync.get(SYNCABLE_SETTINGS);
    return { ...data, updatedAt: Date.now() };
  }

  function _mergeSettings(remote, local) {
    if (!remote || !remote.updatedAt) return local || {};
    if (!local || !local.updatedAt) return remote;
    return remote.updatedAt > local.updatedAt ? remote : local;
  }

  async function _applySyncedSettings(settings) {
    if (!settings || !settings.updatedAt) return;
    const toApply = {};
    for (const k of SYNCABLE_SETTINGS) {
      if (settings[k] !== undefined) toApply[k] = settings[k];
    }
    if (Object.keys(toApply).length > 0) await chrome.storage.sync.set(toApply);
  }

  // ---------------- tree <-> logical state ----------------
  async function readBrowserTree() {
    const tree = await chrome.bookmarks.getTree();
    const nodes = [];
    function walk(node, parentLocalId) {
      const isRoot = ROOT_LOCAL_TO_GUID[node.id] != null;
      if (!isRoot && node.id !== '0') {
        nodes.push({
          localId: node.id,
          parentLocalId,
          title: node.title || '',
          url: node.url || null,
          index: node.index || 0,
          isFolder: !node.url
        });
      }
      if (node.children) {
        for (const c of node.children) walk(c, isRoot ? node.id : (node.id === '0' ? null : node.id));
      }
    }
    for (const r of tree) walk(r, null);
    return nodes;
  }

  function signature(item) {
    const p = item.parentGuid || '';
    // Title is trimmed (NOT case-folded — "Work" vs "work" may be deliberate)
    // so stray whitespace differences between devices don't fork a folder
    // into two GUIDs and duplicate its entire subtree on first adoption.
    return item.type === 'folder' ? `F|${p}|${(item.title || '').trim()}` : `B|${p}|${item.url}`;
  }

  function buildLocalState(nodes, profileState, matchPool) {
    const guidToLocal = { ...(profileState.guidToLocal || {}) };
    const localToGuid = { ...(profileState.localToGuid || {}) };
    const localMeta = profileState.localMeta || {};
    const base = (profileState.base && profileState.base.items) || {};
    const now = Date.now();

    const poolBySig = new Map();
    for (const guid in matchPool) {
      const it = matchPool[guid];
      if (it && !it.deleted) poolBySig.set(signature(it), guid);
    }
    const claimed = new Set(Object.values(localToGuid));

    const items = {};
    const seenLocalIds = new Set();

    const localIdToGuid = (localId) => {
      if (localId == null) return null;
      if (ROOT_LOCAL_TO_GUID[localId]) return ROOT_LOCAL_TO_GUID[localId];
      return localToGuid[localId] || null;
    };

    for (const n of nodes) {
      seenLocalIds.add(n.localId);
      let guid = localToGuid[n.localId];
      if (!guid) {
        const provisional = {
          type: n.isFolder ? 'folder' : 'bookmark',
          parentGuid: localIdToGuid(n.parentLocalId),
          title: n.title, url: n.url
        };
        const sig = signature(provisional);
        const adopt = poolBySig.get(sig);
        if (adopt && !claimed.has(adopt)) {
          guid = adopt;
        } else {
          guid = (crypto.randomUUID && crypto.randomUUID()) || FC.randomAccountId().slice(0, 36);
        }
        localToGuid[n.localId] = guid;
        guidToLocal[guid] = n.localId;
        claimed.add(guid);
      }
    }

    for (const n of nodes) {
      const guid = localToGuid[n.localId];
      const item = {
        guid,
        type: n.isFolder ? 'folder' : 'bookmark',
        parentGuid: localIdToGuid(n.parentLocalId),
        title: n.title,
        url: n.url || undefined,
        index: n.index,
        deleted: false,
        modifiedAt: 0
      };
      const b = base[guid];
      if (localMeta[guid] && localMeta[guid].modifiedAt) {
        item.modifiedAt = localMeta[guid].modifiedAt;
      } else if (!b || changed(b, item)) {
        item.modifiedAt = now;
      } else {
        item.modifiedAt = b.modifiedAt;
      }
      items[guid] = item;
    }

    for (const guid in base) {
      if (items[guid]) continue;
      const localId = guidToLocal[guid];
      const stillExists = localId && seenLocalIds.has(localId);
      if (stillExists) continue;
      const b = base[guid];
      if (b.deleted) { items[guid] = b; continue; }
      items[guid] = { ...b, deleted: true, modifiedAt: (localMeta[guid] && localMeta[guid].modifiedAt) || now };
    }

    return { state: { items }, guidToLocal, localToGuid };
  }

  function changed(a, b) {
    return a.type !== b.type ||
      (a.parentGuid || null) !== (b.parentGuid || null) ||
      (a.title || '') !== (b.title || '') ||
      (a.url || '') !== (b.url || '') ||
      (a.index || 0) !== (b.index || 0) ||
      !!a.deleted !== !!b.deleted;
  }

  // ---------------- 3-way merge ----------------
  function mergeStates(base, local, remote) {
    const b = base.items || {}, l = local.items || {}, r = remote.items || {};
    const guids = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
    const out = {};
    for (const guid of guids) {
      const bi = b[guid], li = l[guid], ri = r[guid];
      let winner;
      if (li && ri) {
        const lCh = !bi || changed(bi, li);
        const rCh = !bi || changed(bi, ri);
        if (lCh && rCh) winner = (li.modifiedAt > ri.modifiedAt) ? li : ri;
        else if (lCh) winner = li;
        else winner = ri;
      } else if (li) {
        winner = li;
      } else if (ri) {
        winner = ri;
      } else {
        continue;
      }
      out[guid] = winner;
    }
    return { items: out };
  }

  function statesEqual(a, b) {
    const ai = a.items || {}, bi = b.items || {};
    const ka = Object.keys(ai), kb = Object.keys(bi);
    if (ka.length !== kb.length) return false;
    for (const g of ka) {
      if (!bi[g]) return false;
      // Deliberately field-only (changed()): comparing modifiedAt here made a
      // bare timestamp re-stamp (e.g. from our own apply's onMoved events)
      // count as "state changed" and push a new version with zero real
      // difference — version churn on every sync cycle.
      if (changed(ai[g], bi[g])) return false;
    }
    return true;
  }

  // ---------------- apply merged state -> browser ----------------
  async function applyToBrowser(merged, profileState) {
    // Suppress our own bookmark-event listeners while we mutate the tree —
    // without this every apply triggered stamp() writes + a redundant
    // debounced follow-up sync. Kept true briefly after we finish because
    // Chrome delivers the events asynchronously.
    _applying = true;
    root.__folioApplying = true; // rules/trash gibi dış dinleyiciler için görünür bayrak
    try {
      return await _applyToBrowserInner(merged, profileState);
    } finally {
      setTimeout(() => { _applying = false; root.__folioApplying = false; }, 1500);
    }
  }

  async function _applyToBrowserInner(merged, profileState) {
    const guidToLocal = { ...(profileState.guidToLocal || {}) };
    const localToGuid = { ...(profileState.localToGuid || {}) };
    const items = merged.items;
    const errors = [];
    const pushErr = (op, guid, e) => errors.push({ op, guid, message: (e && e.message) || String(e) });

    const depth = (guid) => {
      let d = 0, g = guid, seen = new Set();
      while (g && !ROOT_GUIDS.has(g) && items[g] && !seen.has(g)) {
        seen.add(g); g = items[g].parentGuid; d++;
        if (d > 1000) break;
      }
      return d;
    };
    const resolveParentLocal = (parentGuid) => {
      if (!parentGuid) return '1';
      if (ROOT_GUID_TO_LOCAL[parentGuid]) return ROOT_GUID_TO_LOCAL[parentGuid];
      return guidToLocal[parentGuid] || null;
    };

    const dels = Object.values(items).filter(it => it.deleted && guidToLocal[it.guid]);
    dels.sort((a, b) => depth(b.guid) - depth(a.guid));
    for (const it of dels) {
      const localId = guidToLocal[it.guid];
      let removed = false;
      try {
        const [node] = await chrome.bookmarks.get(localId);
        if (node) {
          if (node.url) await chrome.bookmarks.remove(localId);
          else await chrome.bookmarks.removeTree(localId);
        }
        removed = true;
      } catch (e) {
        // "Can't find bookmark" means it was already gone — not an error.
        if (/Can't find/i.test(e && e.message || '')) removed = true;
        else pushErr('delete', it.guid, e);
      }
      if (removed) {
        delete localToGuid[localId];
        delete guidToLocal[it.guid];
      }
    }

    const live = Object.values(items).filter(it => !it.deleted);
    live.sort((a, b) => depth(a.guid) - depth(b.guid));
    for (const it of live) {
      const parentLocal = resolveParentLocal(it.parentGuid);
      if (!parentLocal) { pushErr('parent_unresolved', it.guid, new Error('parent missing')); continue; }
      const existingLocal = guidToLocal[it.guid];
      if (existingLocal) {
        let node;
        try { [node] = await chrome.bookmarks.get(existingLocal); } catch (_) { node = null; }
        if (!node) { delete guidToLocal[it.guid]; delete localToGuid[existingLocal]; }
        else {
          const upd = {};
          if ((node.title || '') !== (it.title || '')) upd.title = it.title || '';
          if (it.url && node.url !== it.url) upd.url = it.url;
          if (Object.keys(upd).length) {
            try { await chrome.bookmarks.update(existingLocal, upd); }
            catch (e) { pushErr('update', it.guid, e); }
          }
          if (String(node.parentId) !== String(parentLocal)) {
            try { await chrome.bookmarks.move(existingLocal, { parentId: parentLocal }); }
            catch (e) { pushErr('move', it.guid, e); }
          }
          continue;
        }
      }
      try {
        const created = await chrome.bookmarks.create({
          parentId: parentLocal,
          title: it.title || '',
          url: it.type === 'bookmark' ? it.url : undefined
        });
        guidToLocal[it.guid] = created.id;
        localToGuid[created.id] = it.guid;
      } catch (e) { pushErr('create', it.guid, e); }
    }

    const byParent = new Map();
    for (const it of live) {
      const key = it.parentGuid || 'ROOT_BAR';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(it);
    }
    for (const [parentKey, sibs] of byParent) {
      sibs.sort((a, b) => (a.index || 0) - (b.index || 0));

      // Read the parent's current child order once and only move items whose
      // position is actually wrong. The previous unconditional move-per-item
      // meant O(n) bookmarks.move calls on EVERY sync (and the onMoved storm
      // re-stamped every item), even when nothing had changed.
      const parentLocal = resolveParentLocal(parentKey === 'ROOT_BAR' ? null : parentKey);
      let order = null;
      if (parentLocal) {
        try { order = (await chrome.bookmarks.getChildren(parentLocal)).map(c => c.id); }
        catch (_) { order = null; }
      }

      let idx = 0;
      for (const it of sibs) {
        const localId = guidToLocal[it.guid];
        if (!localId) continue;
        const cur = order ? order.indexOf(localId) : -2; // -2: order unknown, always move
        if (cur !== idx) {
          try {
            await chrome.bookmarks.move(localId, { index: idx });
            if (order) {
              if (cur >= 0) order.splice(cur, 1);
              order.splice(idx, 0, localId);
            }
          } catch (e) { pushErr('reorder', it.guid, e); }
        }
        idx++;
      }
    }

    return { guidToLocal, localToGuid, errors };
  }

  // Snapshot the entire (non-root) bookmark tree so we can restore on failure.
  async function _snapshotBookmarks() {
    const tree = await chrome.bookmarks.getTree();
    const roots = (tree[0] && tree[0].children) || [];
    return roots.map(r => ({ id: r.id, children: r.children || [] }));
  }

  async function _recreateNode(node, parentId) {
    const created = await chrome.bookmarks.create({
      parentId,
      title: node.title || '',
      url: node.url || undefined,
    });
    if (node.children && node.children.length) {
      for (const child of node.children) {
        await _recreateNode(child, created.id);
      }
    }
  }

  async function _restoreSnapshot(snapshot) {
    await _clearBrowser();
    for (const root of snapshot) {
      for (const child of (root.children || [])) {
        try { await _recreateNode(child, root.id); } catch (_) {}
      }
    }
  }

  // Clear all non-root browser bookmarks (used when switching profiles).
  async function _clearBrowser() {
    const tree = await chrome.bookmarks.getTree();
    for (const root of (tree[0]?.children || [])) {
      for (const child of (root.children || [])) {
        try {
          if (child.url) await chrome.bookmarks.remove(child.id);
          else await chrome.bookmarks.removeTree(child.id);
        } catch (_) {}
      }
    }
  }

  // ---------------- top-level sync ----------------
  let _syncing = false;

  // True while applyToBrowser mutates the bookmark tree (plus a short tail
  // for async event delivery) — listeners skip stamping/rescheduling then.
  let _applying = false;

  // All config read-modify-write cycles from bookmark event handlers go
  // through this queue: rapid event bursts (e.g. deleting a folder fires one
  // onRemoved per child) otherwise race loadConfig/saveConfig and lose
  // localMeta stamps to last-write-wins.
  let _cfgWriteChain = Promise.resolve();
  function _cfgWrite(fn) {
    _cfgWriteChain = _cfgWriteChain.then(fn, fn).catch(() => {});
    return _cfgWriteChain;
  }
  async function sync() {
    if (_syncing) return { skipped: 'in_progress' };
    { const _cfg = await loadConfig(); if (_cfg.needsProfilePick) return { skipped: 'needs_profile' }; }
    _syncing = true;
    try {
      const cfg = await _migrateConfigIfNeeded();
      if (!cfg.enabled || !cfg.accountId) return { skipped: 'disabled' };
      const dek = await getDek();
      if (!dek) return { skipped: 'locked' };

      const activeId = cfg.activeProfileId || 'profile-default';

      const MAX_ATTEMPTS = 4;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 150 * Math.pow(2, attempt - 1)));
        const fresh = await loadConfig();
        const profileStates = fresh.profileStates || {};
        const activeState = profileStates[activeId] || {
          base: { items: {} }, baseVersion: 0, guidToLocal: {}, localToGuid: {}, localMeta: {}, lastSyncAt: null,
        };

        // Pull remote
        const remoteEnv = await _getState(fresh.accountId);
        let remoteVersion = remoteEnv.version || 0;
        let remoteBlob = { v: 2, profiles: {}, settings: {} };
        if (!remoteEnv.empty && remoteEnv.ciphertext) {
          const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
          remoteBlob = _migrateBlobIfNeeded(JSON.parse(json), activeId);
        }

        // Ensure active profile exists in blob (handles newly created profiles)
        if (!remoteBlob.profiles[activeId]) {
          remoteBlob.profiles[activeId] = { id: activeId, name: 'Default', items: {} };
        }
        const remoteItems = remoteBlob.profiles[activeId].items || {};

        // Read local settings to include in push
        const localSettings = await _readSyncableSettings();

        // Build local state
        const nodes = await readBrowserTree();
        const matchPool = { ...(activeState.base.items || {}), ...remoteItems };
        const { state: localState, guidToLocal, localToGuid } = buildLocalState(nodes, activeState, matchPool);

        // 3-way merge
        const base = activeState.base || { items: {} };
        const merged = mergeStates(base, localState, { items: remoteItems });

        // Apply to browser
        const applied = await applyToBrowser(merged, { ...activeState, guidToLocal, localToGuid });

        // Build new blob: preserve all other profiles, update active profile
        const winnerSettings = _mergeSettings(remoteBlob.settings, localSettings);

        // Capture this device's installed extensions (best-effort).
        const deviceId = await _ensureDeviceId();
        let extensionsBlock = remoteBlob.extensions || {};
        if (EXT) {
          try {
            const payload = await EXT.buildBackupPayload();
            extensionsBlock = { ...extensionsBlock, [deviceId]: payload };
            await EXT.setLastBackup(payload);
          } catch (_) { /* management API can fail; keep prior block */ }
        }

        const newBlob = {
          v: 2,
          profiles: {
            ...remoteBlob.profiles,
            [activeId]: {
              ...remoteBlob.profiles[activeId],
              items: merged.items,
            },
          },
          settings: winnerSettings,
          extensions: extensionsBlock,
        };

        // Push if changed
        let newVersion = remoteVersion;
        const remoteActiveState = { items: remoteItems };
        const settingsChanged = JSON.stringify(remoteBlob.settings) !== JSON.stringify(winnerSettings);
        const extensionsChanged = JSON.stringify(remoteBlob.extensions || {}) !== JSON.stringify(extensionsBlock);

        if (!statesEqual(merged, remoteActiveState) || settingsChanged || extensionsChanged) {
          const blob = await FC.encryptData(dek, JSON.stringify(newBlob));
          const put = await _putState(fresh.accountId, remoteVersion, blob.iv, blob.ciphertext);
          if (put.conflict) continue;
          newVersion = put.version;
        }

        // Apply remote settings to local storage
        await _applySyncedSettings(winnerSettings);

        // Save per-profile state
        const newProfileStates = {
          ...(fresh.profileStates || {}),
          [activeId]: {
            base: merged,
            baseVersion: newVersion,
            guidToLocal: applied.guidToLocal,
            localToGuid: applied.localToGuid,
            localMeta: {},
            lastSyncAt: Date.now(),
          },
        };
        await saveConfig({ profileStates: newProfileStates });

        const itemCount = Object.keys(merged.items || {}).length;
        if (applied.errors && applied.errors.length) {
          const first = applied.errors[0];
          await _recordSync(
            'partial',
            `Synced with ${applied.errors.length} error(s); first: ${first.op} — ${first.message}`,
            itemCount
          );
          return { ok: true, partial: true, errors: applied.errors, version: newVersion, profileId: activeId };
        }
        await _recordSync('success', 'Cloud backup synced', itemCount);
        return { ok: true, version: newVersion, profileId: activeId };
      }
      await _recordSync('error', 'Conflict retries exhausted');
      return { error: 'conflict_retries_exhausted' };
    } catch (err) {
      await _recordSync('error', err.message || 'Cloud backup failed');
      throw err;
    } finally {
      _syncing = false;
    }
  }

  async function _recordSync(status, message, count) {
    try {
      const { syncHistory = [] } = await chrome.storage.local.get(['syncHistory']);
      syncHistory.push({ timestamp: Date.now(), status, message, ...(count != null ? { count } : {}) });
      if (syncHistory.length > 50) syncHistory.splice(0, syncHistory.length - 50);
      await chrome.storage.local.set({ syncHistory });
    } catch (_) {}
  }

  // ---------------- profile management ----------------
  async function listProfiles() {
    const cfg = await _migrateConfigIfNeeded();
    const dek = await getDek();
    if (!dek) throw new Error('locked');
    const blob = await _fetchRemoteBlob(cfg, dek, cfg.activeProfileId);
    const profiles = Object.values(blob.profiles).map(p => ({ id: p.id, name: p.name }));
    if (profiles.length === 0) {
      profiles.push({ id: cfg.activeProfileId || 'profile-default', name: 'Default' });
    }
    return { profiles, activeProfileId: cfg.activeProfileId || 'profile-default' };
  }

  async function createProfile(name) {
    const cfg = await _migrateConfigIfNeeded();
    const dek = await getDek();
    if (!dek) throw new Error('locked');

    const profileId = newProfileId();
    const remoteEnv = await _getState(cfg.accountId);
    let blob = { v: 2, profiles: {}, settings: {} };
    if (!remoteEnv.empty && remoteEnv.ciphertext) {
      const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
      blob = _migrateBlobIfNeeded(JSON.parse(json), cfg.activeProfileId);
    }

    blob.profiles[profileId] = { id: profileId, name: name || 'New Profile', items: {} };

    const encrypted = await FC.encryptData(dek, JSON.stringify(blob));
    const put = await _putState(cfg.accountId, remoteEnv.version || 0, encrypted.iv, encrypted.ciphertext);
    if (put.conflict) throw new Error('conflict');

    const newProfileStates = {
      ...(cfg.profileStates || {}),
      [profileId]: {
        base: { items: {} }, baseVersion: put.version,
        guidToLocal: {}, localToGuid: {}, localMeta: {}, lastSyncAt: null,
      },
    };
    await saveConfig({ profileStates: newProfileStates });

    return { profileId, version: put.version };
  }

  async function switchProfile(profileId, { mode = 'replace' } = {}) {
    const cfg = await _migrateConfigIfNeeded();
    if (cfg.activeProfileId === profileId) return { ok: true, unchanged: true };

    const dek = await getDek();
    if (!dek) throw new Error('locked');

    // Sync current profile first to capture unsaved changes
    if (!_syncing) await sync();

    if (mode === 'merge') {
      // Merge this browser's current bookmarks INTO the target profile
      // instead of replacing them: activate with an empty base and run a
      // normal 3-way sync (union).
      const cfgNow = await loadConfig();
      await saveConfig({
        activeProfileId: profileId,
        profileStates: {
          ...(cfgNow.profileStates || {}),
          [profileId]: {
            base: { items: {} }, baseVersion: 0,
            guidToLocal: {}, localToGuid: {}, localMeta: {}, lastSyncAt: null,
          },
        },
      });
      const result = await sync();
      return { ok: true, profileId, mode, result };
    }

    const remoteEnv = await _getState(cfg.accountId);
    if (remoteEnv.empty) {
      await saveConfig({ activeProfileId: profileId });
      return { ok: true, profileId };
    }

    const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
    const blob = _migrateBlobIfNeeded(JSON.parse(json), cfg.activeProfileId);
    const targetProfile = blob.profiles[profileId];
    if (!targetProfile) throw new Error('profile_not_found');

    // Snapshot current bookmarks before destructive replace, so we can roll back.
    const snapshot = await _snapshotBookmarks();
    await chrome.storage.local.set({ profileSwitchSnapshot: { fromProfileId: cfg.activeProfileId, snapshot, at: Date.now() } });

    let applied;
    try {
      await _clearBrowser();
      const emptyState = { base: { items: {} }, baseVersion: 0, guidToLocal: {}, localToGuid: {}, localMeta: {} };
      applied = await applyToBrowser({ items: targetProfile.items }, emptyState);
      if (applied.errors && applied.errors.length) {
        const first = applied.errors[0];
        throw new Error(`apply_failed: ${first.op} — ${first.message}`);
      }
    } catch (err) {
      try { await _restoreSnapshot(snapshot); } catch (_) {}
      await chrome.storage.local.remove(['profileSwitchSnapshot']);
      await _recordSync('error', `Profile switch rolled back: ${err.message || err}`);
      throw err;
    }

    const newProfileStates = {
      ...(cfg.profileStates || {}),
      [profileId]: {
        base: { items: targetProfile.items },
        baseVersion: remoteEnv.version || 0,
        guidToLocal: applied.guidToLocal,
        localToGuid: applied.localToGuid,
        localMeta: {},
        lastSyncAt: Date.now(),
      },
    };
    await saveConfig({ activeProfileId: profileId, profileStates: newProfileStates });
    await chrome.storage.local.remove(['profileSwitchSnapshot']);

    return { ok: true, profileId };
  }

  async function renameProfile(profileId, newName) {
    if (!newName || !newName.trim()) throw new Error('name_required');
    const cfg = await _migrateConfigIfNeeded();
    const dek = await getDek();
    if (!dek) throw new Error('locked');

    const remoteEnv = await _getState(cfg.accountId);
    if (remoteEnv.empty) throw new Error('no_data');

    const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
    const blob = _migrateBlobIfNeeded(JSON.parse(json), cfg.activeProfileId);
    if (!blob.profiles[profileId]) throw new Error('profile_not_found');

    blob.profiles[profileId].name = newName.trim();
    const encrypted = await FC.encryptData(dek, JSON.stringify(blob));
    const put = await _putState(cfg.accountId, remoteEnv.version, encrypted.iv, encrypted.ciphertext);
    if (put.conflict) throw new Error('conflict');

    return { ok: true };
  }

  async function deleteProfile(profileId) {
    const cfg = await _migrateConfigIfNeeded();
    if (cfg.activeProfileId === profileId) throw new Error('cannot_delete_active');

    const dek = await getDek();
    if (!dek) throw new Error('locked');

    const remoteEnv = await _getState(cfg.accountId);
    if (remoteEnv.empty) throw new Error('no_data');

    const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
    const blob = _migrateBlobIfNeeded(JSON.parse(json), cfg.activeProfileId);
    if (!blob.profiles[profileId]) throw new Error('profile_not_found');
    if (Object.keys(blob.profiles).length <= 1) throw new Error('cannot_delete_last');

    delete blob.profiles[profileId];
    const encrypted = await FC.encryptData(dek, JSON.stringify(blob));
    const put = await _putState(cfg.accountId, remoteEnv.version, encrypted.iv, encrypted.ciphertext);
    if (put.conflict) throw new Error('conflict');

    const newProfileStates = { ...(cfg.profileStates || {}) };
    delete newProfileStates[profileId];
    await saveConfig({ profileStates: newProfileStates });

    return { ok: true };
  }

  // ---------------- local edit tracking ----------------
  function installListeners() {
    let _debounceTimer = null;
    const scheduleSync = () => {
      if (_applying) return;
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        _debounceTimer = null;
        sync().catch(() => {});
      }, 2000);
    };

    const stamp = (localId) => _cfgWrite(async () => {
      if (_applying) return;
      const cfg = await loadConfig();
      if (!cfg.enabled) return;
      const activeId = cfg.activeProfileId;
      const profileState = (cfg.profileStates || {})[activeId] || {};
      const guid = (profileState.localToGuid || {})[localId];
      if (guid) {
        const localMeta = { ...(profileState.localMeta || {}) };
        localMeta[guid] = { modifiedAt: Date.now() };
        const profileStates = { ...(cfg.profileStates || {}) };
        profileStates[activeId] = { ...profileState, localMeta };
        await saveConfig({ profileStates });
      }
    });

    chrome.bookmarks.onChanged.addListener((id) => { stamp(id); scheduleSync(); });
    chrome.bookmarks.onMoved.addListener((id) => { stamp(id); scheduleSync(); });
    chrome.bookmarks.onCreated.addListener(() => { scheduleSync(); });
    chrome.bookmarks.onRemoved.addListener((id) => _cfgWrite(async () => {
      if (_applying) return;
      const cfg = await loadConfig();
      if (!cfg.enabled) return;
      const activeId = cfg.activeProfileId;
      const profileState = (cfg.profileStates || {})[activeId] || {};
      const guid = (profileState.localToGuid || {})[id];
      if (guid) {
        const localMeta = { ...(profileState.localMeta || {}) };
        localMeta[guid] = { modifiedAt: Date.now(), removed: true };
        const profileStates = { ...(cfg.profileStates || {}) };
        profileStates[activeId] = { ...profileState, localMeta };
        await saveConfig({ profileStates });
      }
      scheduleSync();
    }));
  }

  async function status() {
    const cfg = await _migrateConfigIfNeeded();
    const activeId = cfg.activeProfileId || 'profile-default';
    const activeState = (cfg.profileStates || {})[activeId] || {};
    return {
      configured: !!cfg.accountId,
      enabled: !!cfg.enabled,
      unlocked: !!(await getDek()),
      accountId: cfg.accountId || null,
      activeProfileId: activeId,
      needsProfilePick: !!cfg.needsProfilePick,
      baseVersion: activeState.baseVersion || 0,
      lastSyncAt: activeState.lastSyncAt || null,
    };
  }

  // Fetch the extensions backup block from remote (decrypts blob; locked-check upstream).
  async function getExtensionsBackup() {
    const cfg = await _migrateConfigIfNeeded();
    const dek = await getDek();
    if (!dek) throw new Error('locked');
    const blob = await _fetchRemoteBlob(cfg, dek, cfg.activeProfileId || 'profile-default');
    return {
      deviceId: cfg.deviceId || null,
      extensions: blob.extensions || {},
    };
  }

  // Restore a specific version: fetch that version's ciphertext, decrypt, apply to browser,
  // then PUSH the restored state as a fresh new version. This avoids a permanent conflict
  // where baseVersion < server's current version after restore.
  // DESTRUCTIVE — replaces current bookmarks for the active profile.
  async function restoreVersion(version) {
    const cfg = await _migrateConfigIfNeeded();
    const dek = await getDek();
    if (!dek) throw new Error('locked');
    const base = await getBaseUrl();
    const res = await fetch(`${base}/sync/history/${encodeURIComponent(version)}`, {
      headers: _authHeaders(cfg.accountId),
    });
    if (!res.ok) throw new Error(`restore_fetch_failed_${res.status}`);
    const env = await res.json();
    if (!env.ciphertext) throw new Error('version_empty');
    const json = await FC.decryptData(dek, env.iv, env.ciphertext);
    const restoredBlob = _migrateBlobIfNeeded(JSON.parse(json), cfg.activeProfileId);
    const activeId = cfg.activeProfileId || 'profile-default';
    const restoredProfile = restoredBlob.profiles[activeId] || Object.values(restoredBlob.profiles)[0];
    if (!restoredProfile) throw new Error('no_profile_in_version');

    const snapshot = await _snapshotBookmarks();
    await chrome.storage.local.set({ versionRestoreSnapshot: { version, snapshot, at: Date.now() } });

    try {
      await _clearBrowser();
      const emptyState = { base: { items: {} }, baseVersion: 0, guidToLocal: {}, localToGuid: {}, localMeta: {} };
      const applied = await applyToBrowser({ items: restoredProfile.items }, emptyState);
      if (applied.errors && applied.errors.length) {
        const first = applied.errors[0];
        throw new Error(`apply_failed: ${first.op} — ${first.message}`);
      }

      // Push restored state as a new version on the server (preserves other profiles + settings + extensions from current head).
      const headEnv = await _getState(cfg.accountId);
      let headVersion = headEnv.version || 0;
      let headBlob = { v: 2, profiles: {}, settings: {}, extensions: {} };
      if (!headEnv.empty && headEnv.ciphertext) {
        const headJson = await FC.decryptData(dek, headEnv.iv, headEnv.ciphertext);
        headBlob = _migrateBlobIfNeeded(JSON.parse(headJson), activeId);
      }
      const newBlob = {
        ...headBlob,
        v: 2,
        profiles: {
          ...headBlob.profiles,
          [activeId]: { id: activeId, name: (headBlob.profiles[activeId] && headBlob.profiles[activeId].name) || (restoredProfile.name || 'Default'), items: restoredProfile.items },
        },
        settings: headBlob.settings || {},
        extensions: headBlob.extensions || {},
      };
      const encrypted = await FC.encryptData(dek, JSON.stringify(newBlob));
      let put = await _putState(cfg.accountId, headVersion, encrypted.iv, encrypted.ciphertext);
      // Tolerate one conflict (concurrent edit) by re-fetching head and retrying once.
      if (put.conflict) {
        const env2 = await _getState(cfg.accountId);
        headVersion = env2.version || headVersion;
        put = await _putState(cfg.accountId, headVersion, encrypted.iv, encrypted.ciphertext);
        if (put.conflict) throw new Error('restore_push_conflict');
      }
      const newVersion = put.version;

      const newProfileStates = {
        ...(cfg.profileStates || {}),
        [activeId]: {
          base: { items: restoredProfile.items },
          baseVersion: newVersion,
          guidToLocal: applied.guidToLocal,
          localToGuid: applied.localToGuid,
          localMeta: {},
          lastSyncAt: Date.now(),
        },
      };
      await saveConfig({ profileStates: newProfileStates });
      await chrome.storage.local.remove(['versionRestoreSnapshot']);
      await _recordSync('success', `Restored from v${version} → published as v${newVersion}`);
      return { ok: true, restoredFrom: version, version: newVersion, profileId: activeId };
    } catch (err) {
      try { await _restoreSnapshot(snapshot); } catch (_) {}
      await chrome.storage.local.remove(['versionRestoreSnapshot']);
      await _recordSync('error', `Restore rolled back: ${err.message || err}`);
      throw err;
    }
  }

  async function listHistory() {
    const cfg = await loadConfig();
    const base = await getBaseUrl();
    const res = await fetch(`${base}/sync/history`, { headers: _authHeaders(cfg.accountId) });
    if (!res.ok) throw new Error(`history_failed_${res.status}`);
    return (await res.json()).versions || [];
  }

  // Force-push local bookmarks to remote, overwriting the active profile slice.
  // Other profiles, settings, and extensions are preserved from the remote blob.
  async function uploadOnly() {
    if (_syncing) return { skipped: 'in_progress' };
    { const _cfg = await loadConfig(); if (_cfg.needsProfilePick) return { skipped: 'needs_profile' }; }
    _syncing = true;
    try {
      const cfg = await _migrateConfigIfNeeded();
      if (!cfg.accountId) return { skipped: 'disabled' };
      const dek = await getDek();
      if (!dek) return { skipped: 'locked' };

      const activeId = cfg.activeProfileId || 'profile-default';
      const fresh = await loadConfig();
      const profileStates = fresh.profileStates || {};
      const activeState = profileStates[activeId] || {
        base: { items: {} }, baseVersion: 0, guidToLocal: {}, localToGuid: {}, localMeta: {}, lastSyncAt: null,
      };

      // Fetch remote to get the current version and preserve other profiles/settings/extensions.
      const remoteEnv = await _getState(fresh.accountId);
      let remoteVersion = remoteEnv.version || 0;
      let remoteBlob = { v: 2, profiles: {}, settings: {}, extensions: {} };
      if (!remoteEnv.empty && remoteEnv.ciphertext) {
        const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
        remoteBlob = _migrateBlobIfNeeded(JSON.parse(json), activeId);
      }

      // Build local state from browser bookmarks (no merge with remote).
      const nodes = await readBrowserTree();
      const matchPool = { ...(activeState.base.items || {}) };
      const { state: localState, guidToLocal, localToGuid } = buildLocalState(nodes, activeState, matchPool);

      const localSettings = await _readSyncableSettings();
      const winnerSettings = _mergeSettings(remoteBlob.settings, localSettings);

      const deviceId = await _ensureDeviceId();
      let extensionsBlock = remoteBlob.extensions || {};
      if (EXT) {
        try {
          const payload = await EXT.buildBackupPayload();
          extensionsBlock = { ...extensionsBlock, [deviceId]: payload };
          await EXT.setLastBackup(payload);
        } catch (_) {}
      }

      const newBlob = {
        v: 2,
        profiles: {
          ...remoteBlob.profiles,
          [activeId]: {
            ...(remoteBlob.profiles[activeId] || { id: activeId, name: 'Default' }),
            items: localState.items,
          },
        },
        settings: winnerSettings,
        extensions: extensionsBlock,
      };

      const blob = await FC.encryptData(dek, JSON.stringify(newBlob));
      let put = await _putState(fresh.accountId, remoteVersion, blob.iv, blob.ciphertext);
      if (put.conflict) {
        const env2 = await _getState(fresh.accountId);
        put = await _putState(fresh.accountId, env2.version || 0, blob.iv, blob.ciphertext);
        if (put.conflict) {
          await _recordSync('error', 'Upload conflict — try again');
          return { error: 'conflict' };
        }
      }
      const newVersion = put.version;

      await _applySyncedSettings(winnerSettings);

      const newProfileStates = {
        ...(fresh.profileStates || {}),
        [activeId]: {
          base: localState,
          baseVersion: newVersion,
          guidToLocal,
          localToGuid,
          localMeta: {},
          lastSyncAt: Date.now(),
        },
      };
      await saveConfig({ profileStates: newProfileStates });

      const itemCount = Object.keys(localState.items || {}).length;
      await _recordSync('success', `Uploaded to cloud (v${newVersion})`, itemCount);
      return { ok: true, version: newVersion, profileId: activeId };
    } catch (err) {
      await _recordSync('error', err.message || 'Upload failed');
      throw err;
    } finally {
      _syncing = false;
    }
  }

  // Force-pull remote bookmarks to local, replacing the browser state for the active profile.
  // Takes a snapshot before clearing and rolls back on failure.
  async function downloadOnly() {
    if (_syncing) return { skipped: 'in_progress' };
    { const _cfg = await loadConfig(); if (_cfg.needsProfilePick) return { skipped: 'needs_profile' }; }
    _syncing = true;
    try {
      const cfg = await _migrateConfigIfNeeded();
      if (!cfg.accountId) return { skipped: 'disabled' };
      const dek = await getDek();
      if (!dek) return { skipped: 'locked' };

      const activeId = cfg.activeProfileId || 'profile-default';
      const fresh = await loadConfig();

      const remoteEnv = await _getState(fresh.accountId);
      if (remoteEnv.empty || !remoteEnv.ciphertext) return { skipped: 'remote_empty' };

      const json = await FC.decryptData(dek, remoteEnv.iv, remoteEnv.ciphertext);
      const remoteBlob = _migrateBlobIfNeeded(JSON.parse(json), activeId);
      const remoteProfile = remoteBlob.profiles[activeId];
      if (!remoteProfile) return { error: 'profile_not_found_on_remote' };

      const remoteItems = remoteProfile.items || {};

      const snapshot = await _snapshotBookmarks();
      let applied;
      try {
        await _clearBrowser();
        const emptyState = { base: { items: {} }, baseVersion: 0, guidToLocal: {}, localToGuid: {}, localMeta: {} };
        applied = await applyToBrowser({ items: remoteItems }, emptyState);
        if (applied.errors && applied.errors.length) {
          const first = applied.errors[0];
          throw new Error(`apply_failed: ${first.op} — ${first.message}`);
        }
      } catch (err) {
        try { await _restoreSnapshot(snapshot); } catch (_) {}
        await _recordSync('error', `Download rolled back: ${err.message || err}`);
        throw err;
      }

      if (remoteBlob.settings) await _applySyncedSettings(remoteBlob.settings);

      const newProfileStates = {
        ...(fresh.profileStates || {}),
        [activeId]: {
          base: { items: remoteItems },
          baseVersion: remoteEnv.version || 0,
          guidToLocal: applied.guidToLocal,
          localToGuid: applied.localToGuid,
          localMeta: {},
          lastSyncAt: Date.now(),
        },
      };
      await saveConfig({ profileStates: newProfileStates });

      const itemCount = Object.keys(remoteItems).length;
      await _recordSync('success', `Downloaded from cloud (v${remoteEnv.version})`, itemCount);
      return { ok: true, version: remoteEnv.version, profileId: activeId };
    } catch (err) {
      await _recordSync('error', err.message || 'Download failed');
      throw err;
    } finally {
      _syncing = false;
    }
  }

  async function disable() {
    _dek = null;
    await saveConfig({ enabled: false, dekRaw: null });
  }

  async function unlock({ key, passphrase, recoveryKey } = {}) {
    const cfg = await loadConfig();
    if (!cfg.meta) throw new Error('no_account');
    // v2: the single sync key IS the passphrase; legacy args still accepted.
    if (key != null) passphrase = String(key).trim();
    const dek = await FC.unwrapDEK(cfg.meta, { passphrase, recoveryKey });
    const dekRaw = await _exportDekViaUnwrap(cfg.meta, passphrase, recoveryKey);
    _dek = dek;
    await saveConfig({ dekRaw, enabled: true });
    return { unlocked: true };
  }

  async function changePassphrase({ newPassphrase } = {}) {
    if (!newPassphrase || newPassphrase.length < 8) throw new Error('passphrase_too_short');
    const cfg = await loadConfig();
    if (!cfg.accountId || !cfg.meta) throw new Error('no_account');
    if (!cfg.dekRaw) throw new Error('locked');
    const dekRawBytes = _b64ToBuf(cfg.dekRaw);
    const saltPass = crypto.getRandomValues(new Uint8Array(16));
    const kekPass = await FC._internal.deriveKEK(newPassphrase, saltPass);
    const wrappedDEKPass = await FC._internal.aesGcmWrap(kekPass, dekRawBytes);
    const newMeta = { ...cfg.meta, saltPass: _bufToB64(saltPass), wrappedDEKPass, updatedAt: Date.now() };
    await _putMeta(cfg.accountId, newMeta);
    await saveConfig({ meta: newMeta });
    return { ok: true };
  }

  async function startOver({ wipeServer = true } = {}) {
    const cfg = await loadConfig();
    if (wipeServer && cfg.accountId) {
      try {
        const base = await getBaseUrl();
        await fetch(`${base}/sync`, { method: 'DELETE', headers: _authHeaders(cfg.accountId) });
      } catch (_) {}
    }
    _dek = null;
    await chrome.storage.local.set({
      [SK]: {
        accountId: null, meta: null, dekRaw: null, enabled: false,
        activeProfileId: null,
        profileStates: {},
        lastSyncAt: null,
        deviceId: null,
      },
    });
    await chrome.storage.local.remove(['profileSwitchSnapshot', 'versionRestoreSnapshot', 'extBackupLast']);
    return { ok: true };
  }

  root.FolioCloudSync = {
    setupNew, joinWithKey, selectProfile, joinExisting, unlock, changePassphrase, startOver,
    sync, uploadOnly, downloadOnly, installListeners, status, listHistory, disable,
    listProfiles, createProfile, switchProfile, renameProfile, deleteProfile,
    getExtensionsBackup, restoreVersion,
    _internal: { buildLocalState, mergeStates, applyToBrowser, changed, statesEqual, readBrowserTree, signature },
  };
})(typeof self !== 'undefined' ? self : this);
