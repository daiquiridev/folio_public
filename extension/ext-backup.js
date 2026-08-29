// Folio extension backup — reads the user's installed Chrome extensions and
// classifies which ones can be restored on another device.
//
// Embedded into the encrypted FolioCloudSync blob under the `extensions` key,
// so the same E2E encryption applies (the server never sees raw IDs/names).
//
// Exposed as self.FolioExtBackup.

(function (root) {
  'use strict';

  // installType -> classification
  //   normal:        Chrome Web Store install — restorable via CWS link
  //   development:   Loaded unpacked (dev) — not restorable from CWS
  //   sideload:      Sideloaded by external program — not restorable from CWS
  //   admin:         Force-installed by policy — managed elsewhere
  //   other:         Unknown
  function classify(ext) {
    const cwsUrl = `https://chrome.google.com/webstore/detail/${ext.id}`;
    switch (ext.installType) {
      case 'normal':
        return { restorable: true, reason: null, cwsUrl };
      case 'development':
        return { restorable: false, reason: 'Loaded unpacked — no Chrome Web Store source', cwsUrl: null };
      case 'sideload':
        return { restorable: false, reason: 'Sideloaded by another program — not on Chrome Web Store', cwsUrl: null };
      case 'admin':
        return { restorable: false, reason: 'Installed by enterprise policy — managed by administrator', cwsUrl: null };
      default:
        return { restorable: false, reason: 'Unknown install source', cwsUrl };
    }
  }

  // List installed extensions (excluding themes and Folio itself).
  async function listInstalled() {
    if (!chrome.management || !chrome.management.getAll) {
      throw new Error('management_api_unavailable');
    }
    const all = await chrome.management.getAll();
    const selfId = chrome.runtime && chrome.runtime.id;
    const items = [];
    for (const ext of all) {
      if (ext.type === 'theme') continue;
      if (ext.id === selfId) continue;
      const cls = classify(ext);
      items.push({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        enabled: ext.enabled,
        installType: ext.installType,
        homepageUrl: ext.homepageUrl || null,
        updateUrl: ext.updateUrl || null,
        icon: pickIcon(ext.icons),
        restorable: cls.restorable,
        reason: cls.reason,
        cwsUrl: cls.cwsUrl,
      });
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }

  function pickIcon(icons) {
    if (!Array.isArray(icons) || icons.length === 0) return null;
    const sorted = [...icons].sort((a, b) => (b.size || 0) - (a.size || 0));
    for (const ic of sorted) if ((ic.size || 0) <= 64) return ic.url || null;
    return sorted[sorted.length - 1].url || null;
  }

  // Compact form embedded into the cloud blob.
  // We strip per-device URLs (icon) — the receiver will look those up itself.
  async function buildBackupPayload() {
    const items = await listInstalled();
    return {
      capturedAt: Date.now(),
      sourceBrowser: detectBrowser(),
      extensions: items.map(i => ({
        id: i.id,
        name: i.name,
        version: i.version,
        installType: i.installType,
        homepageUrl: i.homepageUrl,
        updateUrl: i.updateUrl,
        restorable: i.restorable,
        reason: i.reason,
        cwsUrl: i.cwsUrl,
      })),
    };
  }

  function detectBrowser() {
    const ua = (self.navigator && self.navigator.userAgent) || '';
    if (/Edg\//.test(ua)) return 'edge';
    if (/OPR\//.test(ua)) return 'opera';
    if (/Brave/.test(ua)) return 'brave';
    if (/Chrome\//.test(ua)) return 'chrome';
    return 'unknown';
  }

  async function getLastBackup() {
    const { extBackupLast } = await chrome.storage.local.get(['extBackupLast']);
    return extBackupLast || null;
  }
  async function setLastBackup(payload) {
    await chrome.storage.local.set({ extBackupLast: { at: payload.capturedAt, count: payload.extensions.length } });
  }

  root.FolioExtBackup = {
    listInstalled,
    buildBackupPayload,
    getLastBackup,
    setLastBackup,
  };
})(typeof self !== 'undefined' ? self : this);
