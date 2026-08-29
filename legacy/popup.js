class PopupUI {
  constructor() {
    this.oauth = new RaindropOAuth();
    this.$ = id => document.getElementById(id);
    this.bind();
    this.load();
    this.startStatusUpdater();
  }

  bind() {
    this.$('openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
    this.$('syncNow').addEventListener('click', () => this.syncNow());
    this.$('authenticate').addEventListener('click', () => this.authenticate());
    this.$('logout').addEventListener('click', () => this.logout());
  }

  async load() {
    await this.updateStatus();
    this.loadSupportLinks();
  }

  async updateStatus() {
    const { accessToken, lastSyncTime, syncIntervalMinutes, syncEnabled } =
      await chrome.storage.sync.get(['accessToken', 'lastSyncTime', 'syncIntervalMinutes', 'syncEnabled']);

    const statusCard = this.$('statusCard');
    const statusText = this.$('statusText');
    const statusDetails = this.$('statusDetails');
    const nextSync = this.$('nextSync');
    const authBtn = this.$('authenticate');
    const logoutBtn = this.$('logout');

    const isConnected = !!accessToken;

    // Update status card appearance
    if (isConnected) {
      statusCard.classList.remove('disconnected');
      statusText.textContent = '✓ Connected';

      // Show last sync info
      if (lastSyncTime) {
        const elapsed = this.getTimeAgo(lastSyncTime);
        statusDetails.textContent = `Last sync: ${elapsed}`;
      } else {
        statusDetails.textContent = 'Ready to sync';
      }

      // Show next sync info
      if (syncEnabled && lastSyncTime && syncIntervalMinutes) {
        const nextSyncTime = lastSyncTime + (syncIntervalMinutes * 60 * 1000);
        const now = Date.now();
        if (nextSyncTime > now) {
          const minutesLeft = Math.ceil((nextSyncTime - now) / 60000);
          nextSync.textContent = `Next sync in ${minutesLeft} min`;
        } else {
          nextSync.textContent = 'Sync scheduled...';
        }
      } else if (syncEnabled) {
        nextSync.textContent = `Auto-sync: Every ${syncIntervalMinutes || 15} min`;
      } else {
        nextSync.textContent = 'Auto-sync disabled';
      }

      authBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
    } else {
      statusCard.classList.add('disconnected');
      statusText.textContent = '✗ Not Connected';
      statusDetails.textContent = 'Connect to Raindrop.io to start syncing';
      nextSync.textContent = '';

      authBtn.style.display = 'block';
      logoutBtn.style.display = 'none';
    }
  }

  getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  startStatusUpdater() {
    // Update status every 30 seconds
    setInterval(() => this.updateStatus(), 30000);
  }

  async syncNow() {
    const btn = this.$('syncNow');
    try {
      btn.disabled = true;
      btn.textContent = '⏳ Syncing...';
      this.showMsg('Syncing bookmarks...', 'info');

      const res = await chrome.runtime.sendMessage({ action: 'syncNow' });

      if (res && res.success) {
        this.showMsg('✓ Sync completed successfully!', 'success');
        await this.updateStatus();
      } else {
        this.showMsg('✗ Sync failed: ' + (res?.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      this.showMsg('✗ Sync failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>🔄</span><span>Sync Now</span>';
    }
  }

  async authenticate() {
    const btn = this.$('authenticate');
    try {
      btn.disabled = true;
      btn.textContent = '⏳ Connecting...';
      this.showMsg('Opening authentication...', 'info');

      await this.oauth.startAuthFlow();

      this.showMsg('✓ Successfully connected!', 'success');
      await this.updateStatus();
    } catch (e) {
      this.showMsg('✗ Connection failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔑 Connect';
    }
  }

  async logout() {
    const confirmed = confirm('Are you sure you want to disconnect from Raindrop.io?');
    if (!confirmed) return;

    try {
      this.showMsg('Disconnecting...', 'info');
      await this.oauth.logout();
      await this.updateStatus();
      this.showMsg('✓ Disconnected successfully', 'success');
    } catch (e) {
      this.showMsg('✗ Logout failed: ' + e.message, 'error');
    }
  }

  async loadSupportLinks() {
    try {
      // BMC
      const bmc = await this.readFirstNonEmptyUrl(['buymeacoffee.txt']);
      const fallbackBmc = 'https://buymeacoffee.com/daiquiri';
      const a1 = this.$('bmcLink');
      if (a1) a1.href = bmc || fallbackBmc;
      // Website
      const site = await this.readFirstNonEmptyUrl(['website.txt']);
      const fallbackSite = 'https://spacechild.dev';
      const s1 = this.$('siteLink');
      if (s1) s1.href = site || fallbackSite;
    } catch (e) {
      // ignore
    }
  }

  async readFirstNonEmptyUrl(files) {
    for (const name of files) {
      try {
        const res = await fetch(chrome.runtime.getURL(name));
        if (!res.ok) continue;
        const raw = await res.text();
        const line = raw.split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith('#'));
        if (!line) continue;
        return this.normalizeUrl(line);
      } catch (e) { /* ignore */ }
    }
    return '';
  }

  normalizeUrl(s) {
    try {
      if (!/^https?:\/\//i.test(s)) return 'https://' + s;
      return s;
    } catch (e) { return ''; }
  }

  showMsg(msg, type = 'info') {
    const msgEl = this.$('message');
    msgEl.textContent = msg;
    msgEl.className = `message ${type} show`;

    // Auto-hide success/info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        msgEl.classList.remove('show');
      }, 3000);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupUI());
