// Options page functionality (clean rebuild)

class OptionsManager {
  constructor() {
    this.oauth = new RaindropOAuth();
    this.messageQueue = [];
    this.currentMessageTimeout = null;

    // Make accessible for inline onclick handlers
    window.optionsManager = this;
    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
    this.updateAuthStatus();
    this.loadSupportLinks();
    this.refreshLocalBackups(); // Load local backup list on startup
    this.refreshAutoBackups(); // Load auto backups on startup
    
    // Restore last active tab or default to 'api'
    const lastTab = localStorage.getItem('lastActiveTab');
    const initialTab = lastTab || document.querySelector('.tab-btn.active')?.dataset.tab || 'api';
    this.showTab(initialTab);
    
    this.startTokenHealthCheck();
    this.initSidebarCollapse(); // Initialize collapsible sidebar sections

    // Auto-check Worker status on load
    setTimeout(() => this.autoCheckWorker(), 1000);

    // Check for mandatory backup requirement (async)
    this.checkMandatoryBackup();

    // Load notification style preference
    this.loadNotificationStyle();

    // Load color theme preference
    this.loadTheme();
    // Load color mode and auto-confirm preference
    this.loadColorMode();

    // Compute initial notification offset
    this.updateNotificationOffset();
    // Keep in sync on resize
    window.addEventListener('resize', () => this.updateNotificationOffset());

    // Check for first-run welcome screen
    this.checkFirstRun();
  }

  initializeElements() {
    this.elements = {
      clientId: document.getElementById('clientId'),
      clientSecret: document.getElementById('clientSecret'),
      authMethod: document.getElementById('authMethod'),
      managedOAuthBaseUrl: document.getElementById('managedOAuthBaseUrl'),
      managedBaseEdit: document.getElementById('managedBaseEdit'),
      toggleManagedOAuth: document.getElementById('toggleManagedOAuth'),
      managedOAuthDetails: document.getElementById('managedOAuthDetails'),
      checkWorker: document.getElementById('checkWorker'),
      workerStatus: document.getElementById('workerStatus'),
      viewAuthState: document.getElementById('viewAuthState'),
      runHealthCheck: document.getElementById('runHealthCheck'),
      clearTokens: document.getElementById('clearTokens'),
      authStateOut: document.getElementById('authStateOut'),
      toggleClientId: document.getElementById('toggleClientId'),
      toggleClientSecret: document.getElementById('toggleClientSecret'),
      redirectUri: document.getElementById('redirectUri'),
      redirectReset: document.getElementById('redirectReset'),
      redirectHint: document.getElementById('redirectHint'),
      saveConfig: document.getElementById('saveConfig'),
      authenticateBtn: document.getElementById('authenticateBtn'),
      manualConfigSection: document.getElementById('manualConfigSection'),
      manualConfigDetails: document.getElementById('manualConfigDetails'),
      toggleManualConfig: document.getElementById('toggleManualConfig'),
      closeBetaNotice: document.getElementById('closeBetaNotice'),
      betaNotificationBar: document.getElementById('betaNotificationBar'),
      closeBetaNotificationBar: document.getElementById('closeBetaNotificationBar'),
      quickBackupBtn: document.getElementById('quickBackupBtn'),
      betaNotificationBarAlt: document.getElementById('betaNotificationBarAlt'),
      closeBetaNotificationBarAlt: document.getElementById('closeBetaNotificationBarAlt'),
      quickBackupBtnAlt: document.getElementById('quickBackupBtnAlt'),
      modernNotification: document.getElementById('modernNotification'),
      minimalNotification: document.getElementById('minimalNotification'),
      applyNotificationStyle: document.getElementById('applyNotificationStyle'),
      previewNotificationStyle: document.getElementById('previewNotificationStyle'),
      // Theme + general controls
      themeSelect: document.getElementById('themeSelect'),
      themePreview: document.getElementById('themePreview'),
      applyTheme: document.getElementById('applyTheme'),
      darkModeToggle: document.getElementById('darkModeToggle'),
      betaNotice: document.getElementById('betaNotice'),
      closePrivacyNotice: document.getElementById('closePrivacyNotice'),
      privacyNotice: document.getElementById('privacyNotice'),
      authStatus: document.getElementById('authStatus'),
      statusDetails: document.getElementById('statusDetails'),
      authProgress: document.getElementById('authProgress'),
      authProgressFill: document.getElementById('authProgressFill'),
      testConnection: document.getElementById('testConnection'),
      logout: document.getElementById('logout'),
      syncNow: document.getElementById('syncNow'),
      statusMessage: document.getElementById('statusMessage'),
      statusIndicator: document.getElementById('statusIndicator'),
      authStatusText: document.getElementById('authStatusText'),
      userInfo: document.getElementById('userInfo'),
      lastSyncTime: document.getElementById('lastSyncTime'),
      syncInterval: document.getElementById('syncInterval'),
      targetFolderSelect: document.getElementById('targetFolderSelect'),
      autoSyncInfo: document.getElementById('autoSyncInfo'),
      collectionsSortSelect: document.getElementById('collectionsSortSelect'),
      bookmarksSortSelect: document.getElementById('bookmarksSortSelect'),
      rateLimitRpm: document.getElementById('rateLimitRpm'),
      syncModeSelect: document.getElementById('syncModeSelect'),
      // collections chooser
      importAll: document.getElementById('importAll'),
      topLevelOnlyMode: document.getElementById('topLevelOnlyMode'),
      customSelectionMode: document.getElementById('customSelectionMode'),
      collectionModeSelect: document.getElementById('collectionModeSelect'),
      collectionModeDescription: document.getElementById('collectionModeDescription'),
      customCollectionControls: document.getElementById('customCollectionControls'),
      collectionsList: document.getElementById('collectionsList'),
      collectionsSearch: document.getElementById('collectionsSearch'),
      selectAllCollections: document.getElementById('selectAllCollections'),
      clearCollections: document.getElementById('clearCollections'),
      refreshCollections: document.getElementById('refreshCollections'),
      clearAllBookmarks: document.getElementById('clearAllBookmarks'),
      clearAllBookmarksTools: document.getElementById('clearAllBookmarksTools'),
      clearConfirmationTools: document.getElementById('clearConfirmationTools'),
      clearSyncWarningTools: document.getElementById('clearSyncWarningTools'),
      downloadBackupTools: document.getElementById('downloadBackupTools'),
      clearConfirmTextTools: document.getElementById('clearConfirmTextTools'),
      executeClearTools: document.getElementById('executeClearTools'),
      cancelClearTools: document.getElementById('cancelClearTools'),
      lastBackupTime: document.getElementById('lastBackupTime'),
      createBackup: document.getElementById('createBackup'),
      restoreFromFile: document.getElementById('restoreFromFile'),
      restoreFile: document.getElementById('restoreFile'),
      emergencyRestore: document.getElementById('emergencyRestore'),
      scanDuplicates: document.getElementById('scanDuplicates'),
      cleanUrlParameters: document.getElementById('cleanUrlParameters'),
      cleanEmptyFolders: document.getElementById('cleanEmptyFolders'),
      duplicatePreview: document.getElementById('duplicatePreview'),
      duplicateResults: document.getElementById('duplicateResults'),
      autoCleanupSelected: document.getElementById('autoCleanupSelected'),
      manualMergeSelected: document.getElementById('manualMergeSelected'),
      cancelScan: document.getElementById('cancelScan'),
      localBackupsList: document.getElementById('localBackupsList'),
      refreshBackups: document.getElementById('refreshBackups'),
      clearOldBackups: document.getElementById('clearOldBackups'),
      // Backup tab elements
      autoBackupsList: document.getElementById('autoBackupsList'),
      refreshAutoBackups: document.getElementById('refreshAutoBackups'),
      clearOldAutoBackups: document.getElementById('clearOldAutoBackups'),
      createBackup: document.getElementById('createBackup'),
      downloadBackupFile: document.getElementById('downloadBackupFile'),
      restoreFromBackup: document.getElementById('restoreFromBackup'),
      restoreBackupFile: document.getElementById('restoreBackupFile'),
      restoreLastBackup: document.getElementById('restoreLastBackup'),
      duplicateStatus: document.getElementById('duplicateStatus'),
      duplicateStatusText: document.getElementById('duplicateStatusText'),
      includeSubfolders: document.getElementById('includeSubfolders'),
      exactTitleMatch: document.getElementById('exactTitleMatch'),
      createBackupBeforeRemoval: document.getElementById('createBackupBeforeRemoval'),
      confirmationModal: document.getElementById('confirmationModal'),
      confirmationTitle: document.getElementById('confirmationTitle'),
      confirmationMessage: document.getElementById('confirmationMessage'),
      confirmationConfirm: document.getElementById('confirmationConfirm'),
      confirmationCancel: document.getElementById('confirmationCancel'),
      confirmationClose: document.getElementById('confirmationClose')
    };
  }

  bindEvents() {
    const E = this.elements;
    E.saveConfig && E.saveConfig.addEventListener('click', () => this.saveConfiguration());
    E.authenticateBtn && E.authenticateBtn.addEventListener('click', () => this.authenticate());
    E.testConnection && E.testConnection.addEventListener('click', () => this.testConnection());
    E.logout && E.logout.addEventListener('click', () => this.logout());
    E.syncNow && E.syncNow.addEventListener('click', () => this.syncNow());

    // Auto-save on input change
    [E.clientId, E.clientSecret, E.managedOAuthBaseUrl].forEach(input => { input && input.addEventListener('input', () => this.saveConfiguration()); });
    E.authMethod && E.authMethod.addEventListener('change', () => this.onAuthMethodChange());
    E.managedBaseEdit && E.managedBaseEdit.addEventListener('click', () => this.toggleManagedBaseEdit());
    E.toggleManagedOAuth && E.toggleManagedOAuth.addEventListener('click', () => this.toggleManagedOAuth());
    E.toggleManualConfig && E.toggleManualConfig.addEventListener('click', () => this.toggleManualConfig());
    E.closeBetaNotice && E.closeBetaNotice.addEventListener('click', () => this.closeBetaNotice());
    E.closeBetaNotificationBar && E.closeBetaNotificationBar.addEventListener('click', () => this.closeBetaNotificationBar());
    E.quickBackupBtn && E.quickBackupBtn.addEventListener('click', () => this.quickBackup());
    E.closeBetaNotificationBarAlt && E.closeBetaNotificationBarAlt.addEventListener('click', () => this.closeBetaNotificationBar());
    E.quickBackupBtnAlt && E.quickBackupBtnAlt.addEventListener('click', () => this.quickBackup());
    E.applyNotificationStyle && E.applyNotificationStyle.addEventListener('click', () => this.applyNotificationStyle());
    E.previewNotificationStyle && E.previewNotificationStyle.addEventListener('click', () => this.previewNotificationStyle());
    // General settings events
    this.elements.applyTheme && this.elements.applyTheme.addEventListener('click', () => this.applyTheme());
    this.elements.themeSelect && this.elements.themeSelect.addEventListener('change', () => this.updateThemePreview());
    this.elements.darkModeToggle && this.elements.darkModeToggle.addEventListener('change', () => this.toggleColorMode());
    E.resetToDefaults && E.resetToDefaults.addEventListener('click', () => this.resetToDefaults());
    E.closePrivacyNotice && E.closePrivacyNotice.addEventListener('click', () => this.closePrivacyNotice());
    E.redirectReset && E.redirectReset.addEventListener('click', () => this.resetRedirectUri());
    E.redirectUri && E.redirectUri.addEventListener('input', () => this.validateRedirectUri());
    E.viewAuthState && E.viewAuthState.addEventListener('click', () => this.viewAuthState());
    E.runHealthCheck && E.runHealthCheck.addEventListener('click', () => this.runHealthCheckUI());
    E.clearTokens && E.clearTokens.addEventListener('click', () => this.clearTokens());

    E.toggleClientId && E.toggleClientId.addEventListener('click', () => this.toggleSecret(E.clientId, E.toggleClientId));
    E.toggleClientSecret && E.toggleClientSecret.addEventListener('click', () => this.toggleSecret(E.clientSecret, E.toggleClientSecret));

    E.syncInterval && E.syncInterval.addEventListener('change', () => this.saveSyncOptions());
    E.syncInterval && E.syncInterval.addEventListener('input', () => this.previewSyncInterval());

    E.targetFolderSelect && E.targetFolderSelect.addEventListener('change', () => this.saveTargetFolder());
    E.collectionsSortSelect && E.collectionsSortSelect.addEventListener('change', () => this.saveSorting());
    E.bookmarksSortSelect && E.bookmarksSortSelect.addEventListener('change', () => this.saveSorting());

    E.rateLimitRpm && E.rateLimitRpm.addEventListener('change', () => this.saveRateLimit());
    E.rateLimitRpm && E.rateLimitRpm.addEventListener('input', () => this.saveRateLimitDebounced());

    E.syncModeSelect && E.syncModeSelect.addEventListener('change', () => this.saveSyncMode());

    // Sync enable/disable
    const syncEnabled = document.getElementById('syncEnabled');
    syncEnabled && syncEnabled.addEventListener('change', () => this.onSyncEnabledToggle());

    // Import/Export
    const exportBookmarks = document.getElementById('exportBookmarks');
    const importBookmarks = document.getElementById('importBookmarks');
    const importFile = document.getElementById('importFile');

    exportBookmarks && exportBookmarks.addEventListener('click', () => this.exportBookmarks());
    importBookmarks && importBookmarks.addEventListener('click', () => this.importBookmarks());
    importFile && importFile.addEventListener('change', () => this.onImportFileSelected());

    // Collections chooser
    // Collection mode radio buttons (legacy)
    E.topLevelOnlyMode && E.topLevelOnlyMode.addEventListener('change', () => this.onCollectionModeChange());
    E.customSelectionMode && E.customSelectionMode.addEventListener('change', () => this.onCollectionModeChange());
    // Collection mode dropdown (new)
    E.collectionModeSelect && E.collectionModeSelect.addEventListener('change', () => this.onCollectionModeSelectChange());

    E.collectionsSearch && E.collectionsSearch.addEventListener('input', () => this.filterCollections());
    E.selectAllCollections && E.selectAllCollections.addEventListener('click', () => this.setAllCollections(true));
    E.clearCollections && E.clearCollections.addEventListener('click', () => this.setAllCollections(false));
    E.refreshCollections && E.refreshCollections.addEventListener('click', () => this.refreshAll());
    E.clearAllBookmarks && E.clearAllBookmarks.addEventListener('click', () => this.clearAllBookmarks());
    E.clearAllBookmarksTools && E.clearAllBookmarksTools.addEventListener('click', () => this.clearAllBookmarksTools());

    // Backup and restore functions
    E.createBackup && E.createBackup.addEventListener('click', () => this.createBackupNow());
    E.restoreFromFile && E.restoreFromFile.addEventListener('click', () => this.triggerRestoreFile());
    E.restoreFile && E.restoreFile.addEventListener('change', (e) => this.handleRestoreFile(e));
    E.emergencyRestore && E.emergencyRestore.addEventListener('click', () => this.emergencyRestore());
    // Local backup management
    E.refreshBackups && E.refreshBackups.addEventListener('click', () => this.refreshLocalBackups());
    E.clearOldBackups && E.clearOldBackups.addEventListener('click', () => this.clearOldBackups());
    // Backup tab management
    E.refreshAutoBackups && E.refreshAutoBackups.addEventListener('click', () => this.refreshAutoBackups());
    E.clearOldAutoBackups && E.clearOldAutoBackups.addEventListener('click', () => this.clearOldAutoBackups());
    E.downloadBackupFile && E.downloadBackupFile.addEventListener('click', () => this.downloadManualBackup());
    E.restoreFromBackup && E.restoreFromBackup.addEventListener('click', () => this.triggerRestoreBackup());
    E.restoreBackupFile && E.restoreBackupFile.addEventListener('change', (e) => this.handleRestoreBackupFile(e));
    E.restoreLastBackup && E.restoreLastBackup.addEventListener('click', () => this.restoreLastAutoBackup());


    // Smart cleanup functions
    E.scanDuplicates && E.scanDuplicates.addEventListener('click', () => this.scanForDuplicates());
    E.cleanUrlParameters && E.cleanUrlParameters.addEventListener('click', () => this.cleanUrlParameters());
    E.cleanEmptyFolders && E.cleanEmptyFolders.addEventListener('click', () => this.cleanEmptyFolders());
    E.autoCleanupSelected && E.autoCleanupSelected.addEventListener('click', () => this.autoCleanupSelected());
    E.manualMergeSelected && E.manualMergeSelected.addEventListener('click', () => this.showManualMergeOptions());
    E.cancelScan && E.cancelScan.addEventListener('click', () => this.cancelDuplicateScan());

    // Clear confirmation form elements
    const clearConfirmText = document.getElementById('clearConfirmText');
    const executeClear = document.getElementById('executeClear');
    const cancelClear = document.getElementById('cancelClear');
    const downloadBackup = document.getElementById('downloadBackup');

    clearConfirmText && clearConfirmText.addEventListener('input', () => this.onClearConfirmTextChange());
    executeClear && executeClear.addEventListener('click', () => this.executeClear());
    cancelClear && cancelClear.addEventListener('click', () => this.cancelClear());
    downloadBackup && downloadBackup.addEventListener('click', (e) => {
      e.preventDefault();
      this.downloadBackup();
    });

    // Tools Danger Zone event listeners
    const clearConfirmTextTools = document.getElementById('clearConfirmTextTools');
    const executeClearTools = document.getElementById('executeClearTools');
    const cancelClearTools = document.getElementById('cancelClearTools');
    const downloadBackupTools = document.getElementById('downloadBackupTools');

    clearConfirmTextTools && clearConfirmTextTools.addEventListener('input', () => this.onClearConfirmTextChangeTools());
    executeClearTools && executeClearTools.addEventListener('click', () => this.executeClearTools());
    cancelClearTools && cancelClearTools.addEventListener('click', () => this.cancelClearTools());
    downloadBackupTools && downloadBackupTools.addEventListener('click', (e) => {
      e.preventDefault();
      this.downloadBackupTools();
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
    });

    // Sidebar nav
    document.querySelectorAll('.side-link').forEach(btn => {
      btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
    });
  }

  async checkWorker() {
    const base = (this.elements.managedOAuthBaseUrl?.value || '').replace(/\/$/, '');
    const status = this.elements.workerStatus;
    if (!base) {
      if (status) status.textContent = 'Enter base URL first.';
      return { healthy: false, error: 'No base URL provided' };
    }

    try {
      if (status) status.textContent = 'Checking…';

      const healthCheck = {
        envCheck: false,
        responseTime: 0,
        version: null,
        lastError: null
      };

      const startTime = Date.now();
      const res = await fetch(base + '/env-ok', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      healthCheck.responseTime = Date.now() - startTime;

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('HTTP ' + res.status);

      console.log('Worker /env-ok response:', json);

      healthCheck.envCheck = !!(json.hasClientId && json.hasClientSecret && json.hasSessionSecret);
      healthCheck.version = json.version || 'unknown';

      // Additional checks for response format
      if (json.responseFormat) {
        healthCheck.responseFormat = json.responseFormat;
      }

      const isHealthy = healthCheck.envCheck && healthCheck.responseTime < 5000;
      const dot = document.getElementById('workerStatusDot');

      if (status) {
        status.textContent = isHealthy
          ? `Worker Online (${healthCheck.responseTime}ms)`
          : 'Worker Offline or Misconfigured';
        status.style.color = isHealthy ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-red-7)';
      }
      
      if (dot) {
        dot.style.backgroundColor = isHealthy ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)';
        dot.style.boxShadow = isHealthy ? '0 0 0 2px var(--mantine-color-green-1)' : '0 0 0 2px var(--mantine-color-red-1)';
      }

      if (!healthCheck.envCheck) {
        const suggestions = [
          'Check RAINDROP_CLIENT_ID is set in your Cloudflare Worker',
          'Check RAINDROP_CLIENT_SECRET is set in your Cloudflare Worker',
          'Check SESSION_SECRET is set in your Cloudflare Worker',
          'Redeploy your Cloudflare Worker with the correct environment variables'
        ];
        this.showDetailedError('Worker Configuration Issue', 'Worker is missing required environment variables', suggestions);
      } else if (healthCheck.responseTime > 3000) {
        this.showMessage(`Worker is slow (${healthCheck.responseTime}ms). This may affect authentication performance.`, 'info');
      }

      return { healthy: isHealthy, ...healthCheck };

    } catch (e) {
      const dot = document.getElementById('workerStatusDot');
      if (status) {
        status.textContent = 'Worker Unreachable';
        status.style.color = 'var(--mantine-color-red-7)';
      }
      if (dot) {
        dot.style.backgroundColor = 'var(--mantine-color-red-6)';
        dot.style.boxShadow = '0 0 0 2px var(--mantine-color-red-1)';
      }

      const suggestions = [
        'Check if the Cloudflare Worker URL is correct',
        'Verify the Worker is deployed and running',
        'Check your internet connection',
        'Try the Worker URL directly in your browser'
      ];
      this.showDetailedError('Worker Connection Failed', e?.message || 'Unknown error', suggestions);

      return { healthy: false, error: e?.message || e };
    }
  }

  toggleSecret(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    const show = inputEl.type === 'password';
    inputEl.type = show ? 'text' : 'password';
    btnEl.textContent = show ? 'Hide' : 'Show';
  }

  async loadSettings() {
    try {
      const config = await chrome.storage.sync.get([
        'clientId','clientSecret','managedOAuth','managedOAuthBaseUrl','redirectUri','lastSyncTime','syncIntervalMinutes','targetFolderId',
        'collectionsSort','bookmarksSort','rateLimitRpm','twoWayMode',
        'selectedCollectionIds','syncEnabled','topLevelOnly','collectionImportMode'
      ]);

      const E = this.elements;
      if (config.clientId) E.clientId.value = config.clientId;
      if (config.clientSecret) E.clientSecret.value = config.clientSecret;

      // Set auth method dropdown - default to managed for new installations
      const authMethod = config.managedOAuth !== false ? 'managed' : 'manual';
      if (E.authMethod) {
        E.authMethod.value = authMethod;
        // Trigger change event to ensure proper initialization
        E.authMethod.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (E.managedOAuthBaseUrl) {

  // Default values
  const defaultBase = 'https://rdoauth.daiquiri.dev';
        E.managedOAuthBaseUrl.value = config.managedOAuthBaseUrl || defaultBase;
        // Lock by default; can unlock via Edit button
        E.managedOAuthBaseUrl.disabled = true;
        if (E.managedBaseEdit) E.managedBaseEdit.textContent = 'Edit';
      }

      this.updateAuthMethodDisplay(authMethod);

      // Ensure proper initial storage of auth method if not set
      if (config.managedOAuth === undefined) {
        await chrome.storage.sync.set({ managedOAuth: true });
      }

      // Load backup time
      if (E.lastBackupTime && config.lastBackupTime) {
        E.lastBackupTime.textContent = new Date(config.lastBackupTime).toLocaleString();
      }

      if (E.redirectUri) {
        if (config.redirectUri) {
          E.redirectUri.value = config.redirectUri;
        } else if (chrome.identity && chrome.identity.getRedirectURL) {
          E.redirectUri.value = chrome.identity.getRedirectURL();
        }
        this.validateRedirectUri();
      }

      if (config.lastSyncTime && E.lastSyncTime) {
        const lastSync = new Date(config.lastSyncTime);
        E.lastSyncTime.textContent = `Last sync: ${lastSync.toLocaleString()}`;
      }

      const minutes = Math.max(1, Number(config.syncIntervalMinutes) || 5);
      if (E.syncInterval) E.syncInterval.value = String(minutes);
      this.updateAutoSyncInfo(minutes);

      await this.populateFolderSelect(String(config.targetFolderId || '1'));

      E.collectionsSortSelect && (E.collectionsSortSelect.value = config.collectionsSort || 'alpha_asc');
      E.bookmarksSortSelect && (E.bookmarksSortSelect.value = config.bookmarksSort || 'created_desc');
      E.rateLimitRpm && (E.rateLimitRpm.value = String(config.rateLimitRpm || 60));
      E.syncModeSelect && (E.syncModeSelect.value = config.twoWayMode || 'additions_only');

      const topLevelOnly = (config.topLevelOnly ?? true); // Default to true now
      const topLevelCheckbox = document.getElementById('topLevelOnly');
      if (topLevelCheckbox) {
        topLevelCheckbox.checked = topLevelOnly;
      }

      this.toggleCollectionsDisabled();
      await this.loadCollectionsList(config.selectedCollectionIds || []);

      // Sync enabled/disabled
      const syncEnabled = (config.syncEnabled ?? true);
      const syncEnabledCheckbox = document.getElementById('syncEnabled');
      if (syncEnabledCheckbox) {
        syncEnabledCheckbox.checked = syncEnabled;
        this.updateSyncSettingsVisibility(syncEnabled);
      }

      // Set collection import mode dropdown
      const collectionMode = config.collectionImportMode || (config.topLevelOnly === false ? 'custom' : 'topLevel');
      if (E.collectionModeSelect) {
        E.collectionModeSelect.value = collectionMode;
        this.onCollectionModeSelectChange(); // Update UI accordingly
      }

      // Force sidebar layout
      this.applyLayout('sidebar');
    } catch (error) {
      this.showMessage('Failed to load settings', 'error');
    }
  }

  resetRedirectUri() {
    if (chrome.identity && chrome.identity.getRedirectURL) {
      const url = chrome.identity.getRedirectURL();
      if (this.elements.redirectUri) this.elements.redirectUri.value = url;
      chrome.storage.sync.set({ redirectUri: url }).catch(() => {});
      this.validateRedirectUri();
      this.showMessage('Redirect URI reset to default', 'success');
    } else {
      this.showMessage('Unable to get default Redirect URI', 'error');
    }
  }

  validateRedirectUri() {
    const el = this.elements.redirectUri;
    const hint = this.elements.redirectHint;
    if (!el || !hint) return;
    const v = (el.value || '').trim();
    const isChromiumApp = /\.chromiumapp\.org\/?$/.test(v) || v.includes('.chromiumapp.org/');
    const managedOn = !!this.elements.managedOAuth?.checked;
    if (managedOn && !isChromiumApp) {
      hint.textContent = 'Managed mode: Redirect URI should be your extension identity URL (…chromiumapp.org).';
      hint.style.color = '#b54708'; // amber
    } else {
      hint.textContent = '';
    }
  }

  async viewAuthState() {
    try {
      const keys = ['managedOAuth','managedOAuthBaseUrl','redirectUri','clientId','accessToken','refreshToken','tokenExpiresAt'];
      const data = await chrome.storage.sync.get(keys);
      const out = Object.fromEntries(Object.entries(data).map(([k,v]) => [k, k.includes('Token') ? (v ? `(present${typeof v === 'string' ? `:${v.slice(0,6)}…` : ''})` : '(missing)') : v]));
      if (this.elements.authStateOut) this.elements.authStateOut.textContent = JSON.stringify(out, null, 2);
    } catch (e) {
      if (this.elements.authStateOut) this.elements.authStateOut.textContent = 'Failed to read auth state: ' + (e?.message || e);
    }
  }

  async clearTokens() {
    try {
      await chrome.storage.sync.remove(['accessToken','refreshToken','tokenExpiresAt']);
      if (this.elements.authStateOut) this.elements.authStateOut.textContent = 'Tokens cleared.';
      await this.updateAuthStatus();
    } catch (e) {
      this.showMessage('Failed to clear tokens: ' + (e?.message || e), 'error');
    }
  }

  onManagedToggle() {
    this.updateManagedUi();
    this.saveConfiguration();
  }

  updateManagedUi() {
    const E = this.elements;
    const managed = !!this.elements.managedOAuth?.checked;

    // Always show managed base URL when managed is on
    const baseGroup = document.getElementById('managedBaseGroup');
    if (baseGroup) baseGroup.style.display = managed ? 'block' : 'none';
  }

  toggleManagedOAuth() {
    const isHidden = this.elements.managedOAuthDetails?.classList.contains('hidden');

    if (this.elements.managedOAuthDetails) {
      this.elements.managedOAuthDetails.classList.toggle('hidden');
    }

    if (this.elements.toggleManagedOAuth) {
      this.elements.toggleManagedOAuth.textContent = isHidden
        ? 'Hide'
        : 'Show';
    }
  }

  toggleManualConfig() {
    const isHidden = this.elements.manualConfigDetails?.classList.contains('hidden');

    if (this.elements.manualConfigDetails) {
      this.elements.manualConfigDetails.classList.toggle('hidden');
    }

    if (this.elements.toggleManualConfig) {
      this.elements.toggleManualConfig.textContent = isHidden
        ? 'Hide'
        : 'Show';
    }
  }

  onAuthMethodChange() {
    const authMethod = this.elements.authMethod?.value || 'managed';
    this.updateAuthMethodDisplay(authMethod);
    this.saveConfiguration();
  }

  updateAuthMethodDisplay(authMethod) {
    const managedSection = document.getElementById('managedOAuthSection');
    const manualSection = document.getElementById('manualConfigSection');
    const managedDetails = document.getElementById('managedOAuthDetails');
    const manualDetails = document.getElementById('manualConfigDetails');

    if (managedSection) {
      managedSection.style.display = authMethod === 'managed' ? 'block' : 'none';
    }
    if (manualSection) {
      manualSection.style.display = authMethod === 'manual' ? 'block' : 'none';
    }

    // Auto-show details when manual is selected
    if (authMethod === 'manual' && manualDetails) {
      manualDetails.classList.remove('hidden');
      // Update toggle button text
      const toggleBtn = document.getElementById('toggleManualConfig');
      if (toggleBtn) toggleBtn.textContent = 'Hide';
    }

    // Auto-hide managed details when manual is selected
    if (authMethod === 'manual' && managedDetails) {
      managedDetails.classList.add('hidden');
      const toggleBtn = document.getElementById('toggleManagedOAuth');
      if (toggleBtn) toggleBtn.textContent = 'Show';
    }

    // Auto-show managed details when managed is selected
    if (authMethod === 'managed' && managedDetails) {
      managedDetails.classList.remove('hidden');
      const toggleBtn = document.getElementById('toggleManagedOAuth');
      if (toggleBtn) toggleBtn.textContent = 'Hide';
    }

    // Auto-hide manual details when managed is selected
    if (authMethod === 'managed' && manualDetails) {
      manualDetails.classList.add('hidden');
      const toggleBtn = document.getElementById('toggleManualConfig');
      if (toggleBtn) toggleBtn.textContent = 'Show';
    }
  }

  async authenticate() {
    const authMethod = this.elements.authMethod?.value || 'managed';
    if (authMethod === 'managed') {
      await this.authenticateManaged();
    } else {
      await this.authenticateManual();
    }
  }

  closeBetaNotice() {
    if (this.elements.betaNotice) {
      this.elements.betaNotice.style.display = 'none';
    }
  }

  onCollectionModeSelectChange() {
    const mode = this.elements.collectionModeSelect?.value || 'topLevel';

    // Update description text
    const descriptions = {
      'topLevel': 'Import only parent collections, excluding sub-collections. Safer and faster.',
      'custom': 'Manually choose specific collections to import. Advanced users only.',
      'all': 'Import all collections including sub-collections. Use with caution as this may create many folders.'
    };

    if (this.elements.collectionModeDescription) {
      this.elements.collectionModeDescription.textContent = descriptions[mode] || descriptions['topLevel'];
    }

    // Show/hide custom collection controls
    if (this.elements.customCollectionControls) {
      this.elements.customCollectionControls.style.display = mode === 'custom' ? 'block' : 'none';
    }

    // Save the setting
    this.saveCollectionMode();
  }

  async saveCollectionMode() {
    try {
      const mode = this.elements.collectionModeSelect?.value || 'topLevel';
      // Convert to the format expected by the sync logic
      const topLevelOnly = (mode === 'topLevel');
      const selectedCollectionIds = mode === 'all' ? [] : (mode === 'custom' ? this.getSelectedCollectionIds() : []);

      await chrome.storage.sync.set({
        topLevelOnly,
        selectedCollectionIds,
        collectionImportMode: mode
      });
    } catch (error) {
      console.error('Failed to save collection mode:', error);
    }
  }

  getSelectedCollectionIds() {
    const selectedIds = [];
    const checkboxes = this.elements.collectionsList?.querySelectorAll('input[type="checkbox"]:checked') || [];
    for (const checkbox of checkboxes) {
      if (checkbox.dataset.collectionId) {
        selectedIds.push(checkbox.dataset.collectionId);
      }
    }
    return selectedIds;
  }

  closeBetaNotificationBar() {
    // Hide both notification bars
    if (this.elements.betaNotificationBar) {
      this.elements.betaNotificationBar.style.display = 'none';
    }
    if (this.elements.betaNotificationBarAlt) {
      this.elements.betaNotificationBarAlt.style.display = 'none';
    }

    // Adjust page layout when notification is closed
    document.body.classList.add('notification-hidden');

    // Reset notification offset
    this.setNotificationHeight(0);
  }

  async quickBackup() {
    try {
      const btn = this.elements.quickBackupBtn;
      const btnAlt = this.elements.quickBackupBtnAlt;

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creating...';
      }
      if (btnAlt) {
        btnAlt.disabled = true;
        btnAlt.textContent = 'Creating...';
      }

      // Download backup files (JSON + HTML)
      await this.backupBookmarks();

      // Also create internal auto-backup
      await this.createAutoBackup();
    } catch (error) {
      this.showMessage('Failed to create quick backup: ' + error.message, 'error');
    } finally {
      const btn = this.elements.quickBackupBtn;
      const btnAlt = this.elements.quickBackupBtnAlt;

      if (btn) {
        btn.disabled = false;
        btn.textContent = '📥 Backup Now';
      }
      if (btnAlt) {
        btnAlt.disabled = false;
        btnAlt.textContent = 'Backup';
      }
    }
  }

  closePrivacyNotice() {
    if (this.elements.privacyNotice) {
      this.elements.privacyNotice.style.display = 'none';
    }
  }

  async autoCheckWorker() {
    // Only check if managed OAuth is enabled and we have a base URL
    const { managedOAuth } = await chrome.storage.sync.get(['managedOAuth']);
    if (!managedOAuth) return;

    const baseUrl = this.elements.managedOAuthBaseUrl?.value;
    if (!baseUrl) return;

    try {
      await this.checkWorker();
    } catch (error) {
      console.log('Auto Worker check failed:', error);
    }
  }

  toggleManagedBaseEdit() {
    const input = this.elements.managedOAuthBaseUrl;
    if (!input) return;
    input.disabled = !input.disabled; // toggle
    if (this.elements.managedBaseEdit) {
      this.elements.managedBaseEdit.textContent = input.disabled ? 'Edit' : 'Lock';
    }
  }

  updateAutoSyncInfo(minutes) {
    this.elements.autoSyncInfo && (this.elements.autoSyncInfo.textContent = `Automatic sync: Every ${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  previewSyncInterval() {
    const minutes = Math.max(1, Number(this.elements.syncInterval?.value) || 5);
    this.updateAutoSyncInfo(minutes);
  }

  async saveSyncOptions() {
    try {
      const minutes = Math.max(1, Number(this.elements.syncInterval?.value) || 5);
      await chrome.storage.sync.set({ syncIntervalMinutes: minutes });
      this.updateAutoSyncInfo(minutes);
      this.showMessage('Sync interval saved', 'success');
    } catch (_) {
      this.showMessage('Failed to save sync interval', 'error');
    }
  }

  async saveTargetFolder() {
    try {
      const targetId = this.elements.targetFolderSelect?.value;
      await chrome.storage.sync.set({ targetFolderId: targetId });

      // Auto-enable sync if both target and collections are configured
      const { selectedCollectionIds, syncEnabled } = await chrome.storage.sync.get(['selectedCollectionIds', 'syncEnabled']);
      if (!syncEnabled && selectedCollectionIds && selectedCollectionIds.length > 0) {
        await chrome.storage.sync.set({ syncEnabled: true });
        const syncCheckbox = document.getElementById('syncEnabled');
        if (syncCheckbox) syncCheckbox.checked = true;
        this.showMessage('Target folder saved and sync enabled!', 'success');
      } else if (!syncEnabled) {
        this.showMessage('Target folder saved. Select collections to enable sync.', 'success');
      } else {
        this.showMessage('Target folder saved', 'success');
      }
    } catch (_) {
      this.showMessage('Failed to save target folder', 'error');
    }
  }

  async populateFolderSelect(selectedId) {
    try {
      if (!this.elements.targetFolderSelect) return;
      const tree = await chrome.bookmarks.getTree();
      const folders = [];
      const pushNode = (node, pathParts) => {
        if (!node.url) {
          const path = [...pathParts, node.title || ''].filter(Boolean).join(' > ');
          if (node.id !== '0') folders.push({ id: node.id, path: path || '(root)' });
          if (node.children) for (const child of node.children) pushNode(child, [...pathParts, node.title || '']);
        }
      };
      for (const root of tree) pushNode(root, []);
      folders.sort((a,b) => a.path.localeCompare(b.path));
      this.elements.targetFolderSelect.innerHTML = '';
      for (const f of folders) {
        const opt = document.createElement('option'); opt.value = f.id; opt.textContent = f.path || f.id;
        this.elements.targetFolderSelect.appendChild(opt);
      }
      if (selectedId) this.elements.targetFolderSelect.value = String(selectedId);
    } catch (_) {
      this.showMessage('Failed to load bookmarks folders', 'error');
    }
  }

  async saveSorting() {
    try {
      const collectionsSort = this.elements.collectionsSortSelect?.value || 'alpha_asc';
      const bookmarksSort = this.elements.bookmarksSortSelect?.value || 'created_desc';
      await chrome.storage.sync.set({ collectionsSort, bookmarksSort });
      this.showMessage('Sorting preferences saved', 'success');
    } catch (_) {
      this.showMessage('Failed to save sorting', 'error');
    }
  }

  async saveRateLimit() {
    try {
      const rpm = Math.max(1, Number(this.elements.rateLimitRpm?.value) || 60);
      await chrome.storage.sync.set({ rateLimitRpm: rpm });
      this.showMessage('Rate limit saved', 'success');
    } catch (_) {
      this.showMessage('Failed to save rate limit', 'error');
    }
  }

  saveRateLimitDebounced() {
    clearTimeout(this._saveRateLimitTimer);
    this._saveRateLimitTimer = setTimeout(() => this.saveRateLimit(), 400);
  }

  async saveSyncMode() {
    try {
      const mode = this.elements.syncModeSelect?.value || 'additions_only';
      await chrome.storage.sync.set({ twoWayMode: mode });
      this.showMessage('Sync mode saved', 'success');
    } catch (_) {
      this.showMessage('Failed to save sync mode', 'error');
    }
  }

  async loadSupportLinks() {
    try {
      const bmc = await this.readFirstNonEmptyUrl(['buymeacoffee.txt']);
      const fallbackBmc = 'https://buymeacoffee.com/daiquiri';
      const aTopBmc = document.getElementById('bmcLink');
      if (aTopBmc) aTopBmc.href = bmc || fallbackBmc;
      const aPanelBmc = document.getElementById('bmcPanelLink');
      if (aPanelBmc) aPanelBmc.href = bmc || fallbackBmc;

      const site = await this.readFirstNonEmptyUrl(['website.txt']);

  // Constants
  const fallbackSite = 'https://spacechild.dev';
      const aTopSite = document.getElementById('siteLink');
      const aPanelSite = document.getElementById('supportPanelSite');
      if (aTopSite) aTopSite.href = site || fallbackSite;
      if (aPanelSite) aPanelSite.href = site || fallbackSite;

      // BMC button is now loaded directly in HTML
    } catch (_) {}
  }

  loadBMCButton() {
    try {
      const container = document.getElementById('bmcButtonContainer');
      if (!container) return;

      // Create simple link button (no external scripts - Chrome Web Store compliant)
      container.innerHTML = `
        <a href="https://buymeacoffee.com/daiquiri"
           target="_blank"
           rel="noopener noreferrer"
           style="background: #FFDD00; color: #000; padding: 8px 16px; border-radius: 6px;
                  text-decoration: none; font-weight: 600; font-size: 14px;
                  display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box;">
          ☕ Buy me a coffee
        </a>
      `;
      container.style.display = 'block';
    } catch (e) {
      console.error('Failed to load BMC button:', e);
    }
  }

  openRoadmapLink() {
    try {
      const a = document.getElementById('openRoadmapRepo');
      if (!a) return;
      // If the repo URL is known, set it; else hide link
      const repoUrl = 'https://github.com/spacechild-dev/folio-bookmark-manager';
      a.href = repoUrl ? (repoUrl + '/blob/main/ROADMAP.md') : '#';
      if (!repoUrl) a.style.display = 'none';
    } catch (_) {}
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
      } catch (e) {
        // Silently continue if file doesn't exist
        console.debug(`Optional file ${name} not found, using fallback`);
      }
    }
    return '';
  }

  normalizeUrl(s) { try { return /^https?:\/\//i.test(s) ? s : ('https://' + s); } catch (_) { return ''; } }

  showTab(key) {
    if (!key) return;
    console.log('Navigation: Switching to tab', key);

    // Update tab buttons (top nav if exists)
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.tab === key) b.classList.add('active');
      else b.classList.remove('active');
    });

    // Update panels visibility
    document.querySelectorAll('.tab-panel').forEach(p => {
      if (p.dataset.tab === key) {
        p.classList.add('active');
        p.style.display = 'block'; // Ensure visibility
      } else {
        p.classList.remove('active');
        p.style.display = 'none';
      }
    });

    // Update sidebar links
    document.querySelectorAll('.side-link').forEach(b => {
      if (b.dataset.tab === key) b.classList.add('active');
      else b.classList.remove('active');
    });

    // Update page title
    const titleMap = {
      'api': 'Connect',
      'sync': 'Sync Settings',
      'ai': 'AI Organizer',
      'tools': 'Tools',
      'about': 'Guide & Support',
      'general': 'General Settings',
      'help': 'Help'
    };
    const titleEl = document.getElementById('active-tab-title');
    if (titleEl && titleMap[key]) {
      titleEl.textContent = titleMap[key];
    }

    // Save state
    localStorage.setItem('lastActiveTab', key);
  }

  applyLayout(mode) {
    const isSidebar = mode === 'sidebar';
    document.body.classList.toggle('layout-sidebar', isSidebar);
  }

  // Collections chooser helpers
  toggleCollectionsDisabled() {
    const topLevelCheckbox = document.getElementById('topLevelOnly');
    const disabled = !!topLevelCheckbox?.checked; // Disabled when top-level only is ON

    if (this.elements.collectionsList) {
      this.elements.collectionsList.style.pointerEvents = disabled ? 'none' : '';
      this.elements.collectionsList.style.opacity = disabled ? '0.5' : '';
    }
    if (this.elements.collectionsSearch) this.elements.collectionsSearch.disabled = disabled;
    if (this.elements.selectAllCollections) this.elements.selectAllCollections.disabled = disabled;
    if (this.elements.clearCollections) this.elements.clearCollections.disabled = disabled;
  }

  async refreshAll() {
    try {
      // Show loading state
      if (this.elements.refreshCollections) {
        this.elements.refreshCollections.disabled = true;
        this.elements.refreshCollections.textContent = 'Refreshing...';
      }

      await Promise.all([
        this.populateFolderSelect(),
        this.loadCollectionsList()
      ]);

      this.showMessage('Collections and folders refreshed', 'success');
    } catch (error) {
      this.showMessage('Failed to refresh', 'error');
    } finally {
      // Restore button state
      if (this.elements.refreshCollections) {
        this.elements.refreshCollections.disabled = false;
        this.elements.refreshCollections.textContent = 'Refresh Collections & Folders';
      }
    }
  }


  async onTopLevelOnlyToggle() {
    try {
      const topLevelCheckbox = document.getElementById('topLevelOnly');
      const val = !!topLevelCheckbox?.checked;
      await chrome.storage.sync.set({ topLevelOnly: val });

      // Update UI state
      this.toggleCollectionsDisabled();

      if (val) {
        this.showMessage('Only top-level collections will be imported', 'info');
      } else {
        this.showMessage('You can now select specific collections to import', 'info');
      }
    } catch (_) {}
  }


  async saveSelectedCollections() {
    try {
      const ids = new Set();
      if (this.elements.collectionsList) {
        this.elements.collectionsList.querySelectorAll('.collection-checkbox').forEach(cb => {
          // Include all checked collections, regardless of indeterminate state
          // Indeterminate is only a visual state for parent collections
          if (cb.checked) ids.add(cb.value);
        });
      }
      await chrome.storage.sync.set({ selectedCollectionIds: Array.from(ids) });

      // Auto-enable sync if both target and collections are configured
      const { targetFolderId, syncEnabled } = await chrome.storage.sync.get(['targetFolderId', 'syncEnabled']);
      if (!syncEnabled && targetFolderId && ids.size > 0) {
        await chrome.storage.sync.set({ syncEnabled: true });
        const syncCheckbox = document.getElementById('syncEnabled');
        if (syncCheckbox) syncCheckbox.checked = true;
        this.showMessage('Collections saved and sync enabled!', 'success');
      }
    } catch (_) {}
  }

  async loadCollectionsList(preselected = []) {
    try {
      const list = this.elements.collectionsList;
      const { accessToken } = await chrome.storage.sync.get(['accessToken']);
      if (!accessToken) {
        if (list) this.setHelpText(list, 'Authenticate to load collections');
        return;
      }

      // Show loading state without clearing content immediately
      if (list && list.children.length === 0) {
        this.setHelpText(list, 'Loading collections...');
      }

      // Fetch root collections
      const resp = await fetch('https://api.raindrop.io/rest/v1/collections', { headers: { 'Authorization': `Bearer ${accessToken}` }});
      if (!resp.ok) throw new Error('Failed to load collections');
      let items = (await resp.json()).items || [];
      items = items.filter(c => c._id >= 0);

      console.log('Root collections from API:', items);

      // Fetch child collections
      const childResp = await fetch('https://api.raindrop.io/rest/v1/collections/childrens', { headers: { 'Authorization': `Bearer ${accessToken}` }});
      if (childResp.ok) {
        const childItems = (await childResp.json()).items || [];
        const filteredChildItems = childItems.filter(c => c._id >= 0);
        console.log('Child collections from API:', filteredChildItems);

        // Merge root and child collections
        items = [...items, ...filteredChildItems];
      } else {
        console.warn('Failed to load child collections:', childResp.status);
      }

      console.log('All collections (root + children):', items);

      // Build hierarchy
      const hierarchy = this.buildCollectionHierarchy(items);

      // Create content in memory first, then replace all at once
      const fragment = document.createDocumentFragment();
      const tempContainer = document.createElement('div');
      this.renderCollectionHierarchy(hierarchy, tempContainer, preselected);

      // Move all children from temp container to fragment
      while (tempContainer.firstChild) {
        fragment.appendChild(tempContainer.firstChild);
      }

      // Replace content in one operation
      if (list) {
        list.innerHTML = '';
        list.appendChild(fragment);
      }
    } catch (_) {
      const list = this.elements.collectionsList;
      if (list) this.setHelpText(list, 'Failed to load collections');
    }
  }

  buildCollectionHierarchy(collections) {
    const itemsById = new Map();
    const roots = [];

    console.log('=== Building Collection Hierarchy ===');
    console.log('Total collections:', collections.length);

    // First pass: create items map
    for (const c of collections) {
      itemsById.set(c._id, { ...c, children: [] });
    }

    // Second pass: build hierarchy
    let childCount = 0;
    for (const c of collections) {
      const item = itemsById.get(c._id);
      const parentId = this.getParentId(c);

      console.log(`Collection "${c.title}" (ID: ${c._id}), Parent ID: ${parentId}`);

      if (parentId && itemsById.has(parentId)) {
        itemsById.get(parentId).children.push(item);
        childCount++;
        console.log(`  -> Added as child to "${itemsById.get(parentId).title}"`);
      } else {
        roots.push(item);
        console.log(`  -> Added as root (parent ${parentId} not found or null)`);
      }
    }

    console.log(`Hierarchy complete: ${roots.length} root collections, ${childCount} child collections`);
    console.log('Root collections:', roots.map(r => r.title));

    // Show hierarchy tree structure
    const showTree = (items, indent = '') => {
      for (const item of items) {
        console.log(`${indent}${item.title} (ID: ${item._id})`);
        if (item.children.length > 0) {
          showTree(item.children, indent + '  ');
        }
      }
    };
    console.log('=== Hierarchy Tree ===');
    showTree(roots);

    return roots;
  }

  getParentId(c) {
    try {
      // Check various possible parent field formats
      let parentId = null;

      // Check all possible parent field variations
      const possibleFields = [
        c.parent?.$id,
        c.parent?.id,
        c.parent?._id,
        c.parentId,
        c.parent_id,
        c.parent
      ];

      for (const field of possibleFields) {
        if (field && (typeof field === 'number' || typeof field === 'string')) {
          parentId = field;
          break;
        }
      }

      // Convert to number if it's a string number
      if (parentId && typeof parentId === 'string' && !isNaN(parentId)) {
        parentId = parseInt(parentId);
      }

      console.log(`Getting parent for "${c.title}" (ID: ${c._id}):`, {
        rawCollection: c,
        foundParentId: parentId,
        parentField: c?.parent,
        parentIdField: c?.parentId
      });

      return parentId;
    } catch (e) {
      console.error('Error getting parent ID:', e);
      return null;
    }
  }

  renderCollectionHierarchy(items, container, preselected, level = 0) {
    for (const item of items) {
      const id = String(item._id);
      const hasChildren = item.children && item.children.length > 0;

      // Create collection item
      const row = document.createElement('div');
      row.className = `collection-item ${level === 1 ? 'child' : level >= 2 ? 'grandchild' : ''}`;
      row.dataset.collectionId = id;

      // Add expand/collapse button for parents
      if (hasChildren) {
        const expandBtn = document.createElement('span');
        expandBtn.className = 'expand-button collapsed';
        expandBtn.textContent = '+';
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleCollectionExpansion(id, expandBtn);
        });
        row.appendChild(expandBtn);
      } else {
        // Add spacer for alignment
        const spacer = document.createElement('span');
        spacer.className = 'expand-spacer';
        row.appendChild(spacer);
      }

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      cb.className = 'collection-checkbox';
      cb.checked = preselected.includes(id);
      cb.addEventListener('change', () => this.onCollectionCheckboxChange(cb));

      const label = document.createElement('span');
      label.className = 'collection-label';
      label.textContent = item.title || id;
      label.addEventListener('click', () => {
        cb.checked = !cb.checked;
        this.onCollectionCheckboxChange(cb);
      });

      row.appendChild(cb);
      row.appendChild(label);
      container.appendChild(row);

      // Render children in a collapsible container
      if (hasChildren) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'collection-children';
        childrenContainer.dataset.parentId = id;
        childrenContainer.style.display = 'none'; // Default collapsed
        this.renderCollectionHierarchy(item.children, childrenContainer, preselected, level + 1);
        container.appendChild(childrenContainer);
      }
    }
  }

  onCollectionCheckboxChange(checkbox) {
    const container = this.elements.collectionsList;
    const collectionId = checkbox.value;
    const isChecked = checkbox.checked;

    // Update children
    this.updateChildCollections(container, collectionId, isChecked);

    // Update parent
    this.updateParentCollection(container, collectionId);

    // Save selection and mode
    this.saveSelectedCollections();
    this.saveCollectionMode();
  }

  updateChildCollections(container, parentId, checked) {
    const items = container.querySelectorAll('.collection-item');
    let foundParent = false;
    let parentLevel = 0;

    for (const item of items) {
      if (item.dataset.collectionId === parentId) {
        foundParent = true;
        parentLevel = item.classList.contains('child') ? 1 : item.classList.contains('grandchild') ? 2 : 0;
        continue;
      }

      if (foundParent) {
        const currentLevel = item.classList.contains('child') ? 1 : item.classList.contains('grandchild') ? 2 : 0;

        // If we've moved to same or higher level, we're done with children
        if (currentLevel <= parentLevel) break;

        // This is a child, update it
        const cb = item.querySelector('.collection-checkbox');
        if (cb) {
          cb.checked = checked;
          cb.indeterminate = false;
        }
      }
    }
  }

  updateParentCollection(container, childId) {
    const items = Array.from(container.querySelectorAll('.collection-item'));
    const childItem = items.find(item => item.dataset.collectionId === childId);
    if (!childItem) return;

    const childLevel = childItem.classList.contains('child') ? 1 : childItem.classList.contains('grandchild') ? 2 : 0;
    if (childLevel === 0) return; // This is a root item

    // Find parent
    const childIndex = items.indexOf(childItem);
    let parentItem = null;

    for (let i = childIndex - 1; i >= 0; i--) {
      const item = items[i];
      const itemLevel = item.classList.contains('child') ? 1 : item.classList.contains('grandchild') ? 2 : 0;
      if (itemLevel < childLevel) {
        parentItem = item;
        break;
      }
    }

    if (!parentItem) return;

    // Find all siblings (children of the same parent)
    const parentLevel = parentItem.classList.contains('child') ? 1 : parentItem.classList.contains('grandchild') ? 2 : 0;
    const siblings = [];

    for (let i = items.indexOf(parentItem) + 1; i < items.length; i++) {
      const item = items[i];
      const itemLevel = item.classList.contains('child') ? 1 : item.classList.contains('grandchild') ? 2 : 0;

      if (itemLevel <= parentLevel) break; // No more children
      if (itemLevel === childLevel) siblings.push(item);
    }

    // Check parent state
    const parentCb = parentItem.querySelector('.collection-checkbox');
    if (!parentCb) return;

    const checkedSiblings = siblings.filter(s => s.querySelector('.collection-checkbox')?.checked);

    if (checkedSiblings.length === 0) {
      parentCb.checked = false;
      parentCb.indeterminate = false;
    } else if (checkedSiblings.length === siblings.length) {
      parentCb.checked = true;
      parentCb.indeterminate = false;
    } else {
      parentCb.checked = false;
      parentCb.indeterminate = true;
    }

    // Recursively update grandparent
    this.updateParentCollection(container, parentItem.dataset.collectionId);
  }

  hasParent(c) { try { return !!(c?.parentId || c?.parent?.$id || c?.parent?.id); } catch (_) { return false; } }

  async clearAllBookmarks() {
    // Show the inline confirmation form with backup and confirmation steps
    const confirmationDiv = document.getElementById('clearConfirmation');
    const confirmText = document.getElementById('clearConfirmText');
    const executeBtn = document.getElementById('executeClear');
    const downloadBtn = document.getElementById('downloadBackup');
    const syncWarn = document.getElementById('clearSyncWarning');

    if (confirmationDiv) {
      confirmationDiv.style.display = 'block';
      confirmText.value = '';
      executeBtn.disabled = true;

      // Reset download button to initial state
      if (downloadBtn) {
        downloadBtn.textContent = 'Download Bookmarks Backup';
        downloadBtn.style.backgroundColor = '';
        downloadBtn.style.color = '';
        downloadBtn.style.pointerEvents = '';
        downloadBtn.className = 'button secondary';
      }

      // Show warning if sync is enabled
      try {
        const { syncEnabled } = await chrome.storage.sync.get(['syncEnabled']);
        if (syncWarn) syncWarn.style.display = syncEnabled ? 'block' : 'none';
      } catch (_) { if (syncWarn) syncWarn.style.display = 'none'; }
    }
  }

  cancelClear() {
    const confirmationDiv = document.getElementById('clearConfirmation');
    if (confirmationDiv) {
      confirmationDiv.style.display = 'none';
    }
  }

  onClearConfirmTextChange() {
    const confirmText = document.getElementById('clearConfirmText');
    const executeBtn = document.getElementById('executeClear');

    if (confirmText && executeBtn) {
      const value = (confirmText.value || '').trim().toUpperCase();
      executeBtn.disabled = value !== 'CLEAR ALL';
    }
  }

  async executeClear() {
    // Execute the clearing (backup should already be downloaded)
    try {
      const executeBtn = document.getElementById('executeClear');
      if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = 'Deleting...';
      }

      console.log('Options: Sending clearAllBookmarks message...');
      const response = await chrome.runtime.sendMessage({ action: 'clearAllBookmarks' });
      console.log('Options: Received response:', response);

      if (response?.success) {
        this.showMessage(`Successfully deleted ${response.bookmarksDeleted} bookmarks`, 'success');
        this.cancelClear();
      } else {
        this.showMessage(`Clear failed: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      this.showMessage(`Clear failed: ${error.message}`, 'error');
    } finally {
      const executeBtn = document.getElementById('executeClear');
      if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.textContent = 'Execute Clear';
      }
    }
  }

  // Tools Danger Zone functions (duplicate functionality for Tools tab)
  async clearAllBookmarksTools() {
    const confirmationDiv = document.getElementById('clearConfirmationTools');
    const confirmText = document.getElementById('clearConfirmTextTools');
    const executeBtn = document.getElementById('executeClearTools');
    const downloadBtn = document.getElementById('downloadBackupTools');
    const syncWarn = document.getElementById('clearSyncWarningTools');

    if (confirmationDiv) {
      confirmationDiv.style.display = 'block';
      confirmText.value = '';
      executeBtn.disabled = true;

      if (downloadBtn) {
        downloadBtn.textContent = 'Download Bookmarks Backup (JSON + HTML)';
        downloadBtn.style.backgroundColor = '';
        downloadBtn.style.color = '';
        downloadBtn.style.pointerEvents = '';
        downloadBtn.className = 'button secondary';
      }

      try {
        const { syncEnabled } = await chrome.storage.sync.get(['syncEnabled']);
        if (syncWarn) syncWarn.style.display = syncEnabled ? 'block' : 'none';
      } catch (_) { if (syncWarn) syncWarn.style.display = 'none'; }
    }
  }

  cancelClearTools() {
    const confirmationDiv = document.getElementById('clearConfirmationTools');
    if (confirmationDiv) {
      confirmationDiv.style.display = 'none';
    }
  }

  onClearConfirmTextChangeTools() {
    const confirmText = document.getElementById('clearConfirmTextTools');
    const executeBtn = document.getElementById('executeClearTools');

    if (confirmText && executeBtn) {
      const value = (confirmText.value || '').trim().toUpperCase();
      executeBtn.disabled = value !== 'CLEAR ALL';
    }
  }

  async executeClearTools() {
    try {
      const executeBtn = document.getElementById('executeClearTools');
      if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = 'Deleting...';
      }

      console.log('Options: Sending clearAllBookmarks message...');
      const response = await chrome.runtime.sendMessage({ action: 'clearAllBookmarks' });
      console.log('Options: Received response:', response);

      if (response?.success) {
        this.showMessage(`Successfully deleted ${response.bookmarksDeleted} bookmarks`, 'success');
        this.cancelClearTools();
      } else {
        this.showMessage(`Clear failed: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      this.showMessage(`Clear failed: ${error.message}`, 'error');
    } finally {
      const executeBtn = document.getElementById('executeClearTools');
      if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.textContent = 'Execute Clear All';
      }
    }
  }

  async downloadBackupTools() {
    try {
      const downloadBtn = document.getElementById('downloadBackupTools');
      if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';
      }

      await this.backupBookmarks();

      if (downloadBtn) {
        downloadBtn.textContent = '✓ Downloaded';
        downloadBtn.style.backgroundColor = '#28a745';
        downloadBtn.style.color = 'white';
        downloadBtn.style.pointerEvents = 'none';
      }
    } catch (error) {
      this.showMessage(`Backup failed: ${error.message}`, 'error');
      const downloadBtn = document.getElementById('downloadBackupTools');
      if (downloadBtn) {
        downloadBtn.textContent = 'Download Bookmarks Backup (JSON + HTML)';
        downloadBtn.disabled = false;
      }
    }
  }

  async downloadBackup() {
    try {
      const downloadBtn = document.getElementById('downloadBackup');
      if (downloadBtn) {
        downloadBtn.textContent = 'Generating...';
        downloadBtn.style.pointerEvents = 'none';
      }

      await this.backupBookmarks();

      if (downloadBtn) {
        downloadBtn.textContent = '✓ Downloaded';
        downloadBtn.style.backgroundColor = '#28a745';
        downloadBtn.style.color = 'white';
      }
    } catch (error) {
      this.showMessage(`Backup failed: ${error.message}`, 'error');
      const downloadBtn = document.getElementById('downloadBackup');
      if (downloadBtn) {
        downloadBtn.textContent = 'Download Failed';
        downloadBtn.style.backgroundColor = '#dc3545';
        downloadBtn.style.color = 'white';
      }
    }
  }

  async backupBookmarks() {
    try {
      // Get all bookmarks
      const bookmarks = await chrome.bookmarks.getTree();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

      // Create JSON backup
      const backupData = {
        timestamp: new Date().toISOString(),
        bookmarks: bookmarks,
        extensionVersion: chrome.runtime.getManifest().version
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const jsonBlob = new Blob([jsonString], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonFilename = `bookmarks-backup-${timestamp}.json`;

      // Create HTML backup (Netscape Bookmark Format)
      const htmlContent = this.generateNetscapeBookmarkHTML(bookmarks);
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const htmlUrl = URL.createObjectURL(htmlBlob);
      const htmlFilename = `bookmarks-backup-${timestamp}.html`;

      // Download JSON
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = jsonFilename;
      jsonLink.style.display = 'none';
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);

      // Download HTML (with small delay)
      setTimeout(() => {
        const htmlLink = document.createElement('a');
        htmlLink.href = htmlUrl;
        htmlLink.download = htmlFilename;
        htmlLink.style.display = 'none';
        document.body.appendChild(htmlLink);
        htmlLink.click();
        document.body.removeChild(htmlLink);
        URL.revokeObjectURL(htmlUrl);
      }, 500);

      this.showMessage(`Backup saved (JSON + HTML)`, 'success');
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  generateNetscapeBookmarkHTML(bookmarkTree) {
    const timestamp = Math.floor(Date.now() / 1000);
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    const processNode = (node, indent = '    ') => {
      let output = '';

      if (node.url) {
        // It's a bookmark
        const addDate = node.dateAdded ? Math.floor(node.dateAdded / 1000) : timestamp;
        const title = this.escapeHTML(node.title || '');
        const url = this.escapeHTML(node.url);
        output += `${indent}<DT><A HREF="${url}" ADD_DATE="${addDate}">${title}</A>\n`;
      } else if (node.children) {
        // It's a folder
        if (node.title) {
          const addDate = node.dateAdded ? Math.floor(node.dateAdded / 1000) : timestamp;
          const modDate = node.dateGroupModified ? Math.floor(node.dateGroupModified / 1000) : timestamp;
          const title = this.escapeHTML(node.title);
          output += `${indent}<DT><H3 ADD_DATE="${addDate}" LAST_MODIFIED="${modDate}">${title}</H3>\n`;
          output += `${indent}<DL><p>\n`;

          for (const child of node.children) {
            output += processNode(child, indent + '    ');
          }

          output += `${indent}</DL><p>\n`;
        } else {
          // Root node without title
          for (const child of node.children) {
            output += processNode(child, indent);
          }
        }
      }

      return output;
    };

    for (const rootNode of bookmarkTree) {
      html += processNode(rootNode);
    }

    html += `</DL><p>\n`;
    return html;
  }

  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  onSyncEnabledToggle() {
    const syncEnabledCheckbox = document.getElementById('syncEnabled');
    if (syncEnabledCheckbox) {
      const enabled = syncEnabledCheckbox.checked;
      chrome.storage.sync.set({ syncEnabled: enabled });
      this.updateSyncSettingsVisibility(enabled);

      if (enabled) {
        this.showMessage('Raindrop sync enabled', 'success');
      } else {
        this.showMessage('Raindrop sync disabled', 'info');
      }
    }
  }

  updateSyncSettingsVisibility(enabled) {
    const syncSettings = document.getElementById('syncSettings');
    if (syncSettings) {
      if (enabled) {
        syncSettings.classList.remove('disabled');
      } else {
        syncSettings.classList.add('disabled');
      }
    }
  }

  async exportBookmarks() {
    try {
      const exportBtn = document.getElementById('exportBookmarks');
      if (exportBtn) {
        exportBtn.textContent = 'Exporting...';
        exportBtn.disabled = true;
      }

      await this.backupBookmarks();

      if (exportBtn) {
        exportBtn.textContent = '✓ Exported';
        exportBtn.style.backgroundColor = '#28a745';
        exportBtn.style.color = 'white';

        setTimeout(() => {
          exportBtn.textContent = 'Export All Bookmarks (JSON)';
          exportBtn.style.backgroundColor = '';
          exportBtn.style.color = '';
          exportBtn.disabled = false;
        }, 2000);
      }
    } catch (error) {
      this.showMessage(`Export failed: ${error.message}`, 'error');
      const exportBtn = document.getElementById('exportBookmarks');
      if (exportBtn) {
        exportBtn.textContent = 'Export All Bookmarks (JSON)';
        exportBtn.disabled = false;
      }
    }
  }

  async createBackupNow() {
    try {
      const btn = this.elements.createBackup;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creating backup...';
      }

      // Create internal auto-backup first
      await this.createAutoBackup();

      // Update button text
      if (btn) {
        btn.textContent = 'Downloading files...';
      }

      // Download backup files (JSON + HTML)
      await this.backupBookmarks();

      // Refresh the backup list to show the new backup
      await this.refreshAutoBackups();
    } catch (error) {
      this.showMessage('Backup creation failed: ' + error.message, 'error');
    } finally {
      const btn = this.elements.createBackup;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create Backup Now';
      }
    }
  }

  async createAutoBackup() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const timestamp = new Date().toISOString();
      const backupData = {
        version: '1.2.0',
        timestamp: timestamp,
        type: 'auto-backup',
        bookmarks: bookmarkTree
      };

      // Save backup timestamp
      await chrome.storage.sync.set({ lastBackupTime: timestamp });

      // Update UI
      if (this.elements.lastBackupTime) {
        this.elements.lastBackupTime.textContent = new Date(timestamp).toLocaleString();
      }

      // Store backup in local storage with timestamp key
      const backupKey = this.getAutoBackupKey(timestamp);
      await chrome.storage.local.set({ [backupKey]: backupData });

      // Maintain list of backup keys for management
      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);
      backupKeys.push(backupKey);

      // Keep only last 10 backups to prevent storage overflow
      const MAX_AUTO_BACKUPS = 10;
      if (backupKeys.length > MAX_AUTO_BACKUPS) {
        const oldKey = backupKeys.shift();
        await chrome.storage.local.remove(oldKey);
      }

      await chrome.storage.sync.set({ backupKeys });

      return backupData;
    } catch (error) {
      console.error('Auto backup failed:', error);
      throw error;
    }
  }

  async refreshAutoBackups() {
    try {
      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);
      const autoBackupsList = this.elements.autoBackupsList;

      if (!autoBackupsList) return;

      if (backupKeys.length === 0) {
        this.setHelpText(autoBackupsList, 'No automatic backups found. Backups are created automatically during operations.');
        return;
      }

      // Load backup metadata
      const backupDataPromises = backupKeys.map(async (key) => {
        try {
          const data = await chrome.storage.local.get([key]);
          return data[key] || null;
        } catch (error) {
          console.warn('Failed to load backup:', key, error);
          return null;
        }
      });

      const backupDataList = await Promise.all(backupDataPromises);
      const validBackups = backupDataList.filter(backup => backup && backup.timestamp);

      // Sort by timestamp (newest first)
      validBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (validBackups.length === 0) {
        this.setHelpText(autoBackupsList, 'No valid backups found.');
        return;
      }

      autoBackupsList.innerHTML = '';
      const fragment = document.createDocumentFragment();

      validBackups.forEach((backup) => {
        const backupDate = this.getBackupDate(backup.timestamp);
        const dateLabel = backupDate ? backupDate.toLocaleString() : 'Unknown backup date';
        const timeAgo = backupDate ? this.timeAgo(backupDate) + ' • ' : '';
        const bookmarkCount = this.countBookmarks(backup.bookmarks);

        const item = document.createElement('div');
        item.className = 'backup-item';
        item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 4px; margin-bottom: 6px; background: #f8f9fa;';

        const details = document.createElement('div');

        const dateLine = document.createElement('div');
        dateLine.style.cssText = 'font-weight: 600; font-size: 13px;';
        dateLine.textContent = dateLabel;
        details.appendChild(dateLine);

        const metaLine = document.createElement('div');
        metaLine.style.cssText = 'font-size: 11px; color: #666;';
        metaLine.textContent = `${timeAgo}${bookmarkCount} bookmarks`;
        details.appendChild(metaLine);

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 4px;';

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'button small';
        restoreBtn.style.cssText = 'font-size: 11px; padding: 4px 8px;';
        restoreBtn.textContent = 'Restore';
        restoreBtn.addEventListener('click', () => {
          this.restoreBackup(backup.timestamp);
        });

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'button secondary small';
        downloadBtn.style.cssText = 'font-size: 11px; padding: 4px 8px;';
        downloadBtn.textContent = 'Download';
        downloadBtn.addEventListener('click', () => {
          this.downloadBackup(backup.timestamp);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'button danger small';
        deleteBtn.style.cssText = 'font-size: 11px; padding: 4px 8px;';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
          this.deleteAutoBackup(backup.timestamp);
        });

        actions.appendChild(restoreBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(details);
        item.appendChild(actions);

        fragment.appendChild(item);
      });

      autoBackupsList.appendChild(fragment);

    } catch (error) {
      console.error('Failed to refresh auto backups:', error);
      if (this.elements.autoBackupsList) {
        this.elements.autoBackupsList.innerHTML = '<div class="help-text" style="color: #dc3545;">Failed to load backups</div>';
      }
    }
  }

  timeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  countBookmarks(bookmarkTree) {
    let count = 0;
    function traverse(nodes) {
      for (const node of nodes || []) {
        if (node.url) count++;
        if (node.children) traverse(node.children);
      }
    }
    traverse(bookmarkTree);
    return count;
  }

  normalizeBackupTimestamp(timestamp) {
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }

    if (typeof timestamp === 'number') {
      return String(timestamp);
    }

    if (typeof timestamp === 'string') {
      return timestamp.trim();
    }

    if (timestamp && typeof timestamp.toString === 'function') {
      return timestamp.toString();
    }

    throw new Error('Invalid backup timestamp');
  }

  getAutoBackupKey(timestamp) {
    const normalized = this.normalizeBackupTimestamp(timestamp);
    if (!normalized) {
      throw new Error('Backup timestamp missing');
    }
    return `backup_${normalized.replace(/[:.]/g, '-')}`;
  }

  getAutoBackupFilename(timestamp) {
    const normalized = this.normalizeBackupTimestamp(timestamp);
    if (!normalized) {
      throw new Error('Backup timestamp missing');
    }
    return `bookmark-backup-${normalized.replace(/[:.]/g, '-')}.json`;
  }

  getBackupDate(timestamp) {
    if (timestamp instanceof Date) {
      return Number.isNaN(timestamp.getTime()) ? null : timestamp;
    }

    if (typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof timestamp === 'string') {
      const trimmed = timestamp.trim();
      if (!trimmed) {
        return null;
      }

      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        const numericDate = new Date(numeric);
        if (!Number.isNaN(numericDate.getTime())) {
          return numericDate;
        }
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  applyButtonVariant(button, variant = 'primary') {
    if (!button) return;
    const allowed = new Set(['primary', 'secondary', 'danger']);
    const resolved = allowed.has(variant) ? variant : 'primary';
    button.className = `button ${resolved}`;
  }

  async showConfirmation({
    title = 'Please Confirm',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'primary',
    cancelVariant = 'secondary'
  } = {}) {
    const modal = this.elements.confirmationModal;
    const titleEl = this.elements.confirmationTitle;
    const messageEl = this.elements.confirmationMessage;
    const confirmBtn = this.elements.confirmationConfirm;
    const cancelBtn = this.elements.confirmationCancel;
    const closeBtn = this.elements.confirmationClose;

    if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
      const fallbackText = [title, message].filter(Boolean).join('\n\n');
      return window.confirm(fallbackText || 'Are you sure?');
    }

    titleEl.textContent = title;
    // Safely set text content with preserved line breaks
    messageEl.textContent = '';
    if (message) {
      const lines = message.split('\n');
      lines.forEach((line, index) => {
        messageEl.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
          messageEl.appendChild(document.createElement('br'));
        }
      });
    }

    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    this.applyButtonVariant(confirmBtn, confirmVariant);
    this.applyButtonVariant(cancelBtn, cancelVariant);

    const backdrop = modal.querySelector('.inline-modal-backdrop');

    modal.classList.remove('hidden');
    modal.classList.add('visible');
    document.body?.classList.add('modal-open');

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        modal.classList.remove('visible');
        modal.classList.add('hidden');
        document.body?.classList.remove('modal-open');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn?.removeEventListener('click', onCancel);
        backdrop?.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKeyDown);
      };

      const settle = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const onConfirm = () => settle(true);
      const onCancel = () => settle(false);
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          settle(false);
        }
      };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      closeBtn?.addEventListener('click', onCancel);
      backdrop?.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKeyDown);

      setTimeout(() => { try { confirmBtn.focus(); } catch (_) {} }, 0);
    });
  }

  async confirmWithText(rawText, options = {}) {
    const text = typeof rawText === 'string' ? rawText : '';
    const segments = text.split(/\n{2,}/);
    const segmentTitle = segments.shift()?.trim();
    const segmentMessage = segments.join('\n\n').trim();

    const title = options.title || segmentTitle || 'Please Confirm';
    const message = options.message !== undefined ? options.message : segmentMessage;

    return this.showConfirmation({
      ...options,
      title,
      message
    });
  }

  async restoreBackup(timestamp) {
    try {
      const confirmed = await this.confirmWithText('⚠️ RESTORE FROM AUTO BACKUP\n\nThis will restore bookmarks from the selected automatic backup. Current bookmarks will be merged with backup contents.\n\nProceed with restore?', {
        confirmText: 'Restore',
        confirmVariant: 'primary'
      });
      if (!confirmed) return;

      const backupKey = this.getAutoBackupKey(timestamp);
      const backupData = await chrome.storage.local.get([backupKey]);
      const backup = backupData[backupKey];

      if (!backup) {
        throw new Error('Backup data not found');
      }

      if (!backup.bookmarks) {
        throw new Error('Invalid backup format - no bookmark data found');
      }

      // Restore using the backup data
      await this.restoreFromBackup(backup);
      this.showMessage('Auto backup restored successfully!', 'success');

      // Refresh UI after restore
      await this.refreshAutoBackups();
    } catch (error) {
      console.error('Auto backup restore failed:', error);
      this.showMessage('Auto backup restore failed: ' + error.message, 'error');
    }
  }

  async downloadBackup(timestamp) {
    try {
      const backupKey = this.getAutoBackupKey(timestamp);
      const backupData = await chrome.storage.local.get([backupKey]);
      const backup = backupData[backupKey];

      if (!backup) {
        throw new Error('Backup data not found');
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.getAutoBackupFilename(timestamp);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showMessage('Backup downloaded successfully', 'success');
    } catch (error) {
      console.error('Backup download failed:', error);
      this.showMessage('Backup download failed: ' + error.message, 'error');
    }
  }

  async deleteAutoBackup(timestamp) {
    try {
      const confirmed = await this.confirmWithText('🗑️ DELETE AUTO BACKUP\n\nThis will permanently delete the selected backup and remove it from the list.\n\nContinue?', {
        confirmText: 'Delete',
        confirmVariant: 'danger'
      });
      if (!confirmed) return;

      const backupKey = this.getAutoBackupKey(timestamp);

      // Remove backup payload
      await chrome.storage.local.remove([backupKey]);

      // Update backup keys list
      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);
      const updatedKeys = backupKeys.filter(key => key !== backupKey);
      await chrome.storage.sync.set({ backupKeys: updatedKeys });

      this.showMessage('Auto backup deleted', 'success');
      await this.refreshAutoBackups();
    } catch (error) {
      console.error('Auto backup delete failed:', error);
      this.showMessage('Failed to delete backup: ' + error.message, 'error');
    }
  }

  async clearOldAutoBackups() {
    try {
      const confirmed = await this.confirmWithText('⚠️ CLEAR OLD BACKUPS\n\nThis will remove all automatic backups except the most recent 3.\n\nContinue?', {
        confirmText: 'Clear',
        confirmVariant: 'danger'
      });
      if (!confirmed) return;

      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);

      if (backupKeys.length <= 3) {
        this.showMessage('No old backups to clear (keeping minimum of 3)', 'info');
        return;
      }

      // Keep only the 3 most recent backups
      const keysToRemove = backupKeys.slice(0, -3);

      // Remove old backup data
      await chrome.storage.local.remove(keysToRemove);

      // Update backup keys list
      const remainingKeys = backupKeys.slice(-3);
      await chrome.storage.sync.set({ backupKeys: remainingKeys });

      this.showMessage(`Cleared ${keysToRemove.length} old backup(s)`, 'success');
      await this.refreshAutoBackups();
    } catch (error) {
      console.error('Failed to clear old backups:', error);
      this.showMessage('Failed to clear old backups: ' + error.message, 'error');
    }
  }

  async restoreLastAutoBackup() {
    try {
      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);

      if (backupKeys.length === 0) {
        this.showMessage('No automatic backups available', 'error');
        return;
      }

      // Get the most recent backup
      const latestBackupKey = backupKeys[backupKeys.length - 1];
      const backupData = await chrome.storage.local.get([latestBackupKey]);
      const backup = backupData[latestBackupKey];

      if (!backup || !backup.timestamp) {
        this.showMessage('Latest backup is invalid or corrupted', 'error');
        return;
      }

      // Confirm before restore
      const confirmed = await this.confirmWithText('⚠️ RESTORE FROM AUTO BACKUP\n\nThis will restore bookmarks from the latest automatic backup. Current bookmarks will be merged with backup contents.\n\nProceed with restore?', {
        confirmText: 'Restore',
        confirmVariant: 'primary'
      });
      if (!confirmed) return;

      // Restore using the backup data
      await this.restoreFromBackup(backup);
      this.showMessage('Latest backup restored successfully!', 'success');

      // Refresh UI after restore
      await this.refreshAutoBackups();
    } catch (error) {
      console.error('Failed to restore latest backup:', error);
      this.showMessage('Failed to restore latest backup: ' + error.message, 'error');
    }
  }

  showManualMergeOptions() {
    if (!this.duplicateAnalysis) {
      this.showMessage('No scan results available. Please scan first.', 'error');
      return;
    }

    // Show manual merge interface
    const duplicateResults = this.elements.duplicateResults;
    if (!duplicateResults) return;

    let mergeOptionsHTML = '<div style="margin: 12px 0;"><h4>Manual Merge Options</h4>';
    mergeOptionsHTML += '<div class="help-text" style="margin-bottom: 12px;">Choose which duplicates to merge manually. For each group, select the target (which one to keep) and source items (which ones to merge into the target).</div>';

    // Process duplicate folders
    if (this.duplicateAnalysis.folders && this.duplicateAnalysis.folders.length > 0) {
      mergeOptionsHTML += '<div style="margin-bottom: 16px;"><strong>Duplicate Folders:</strong></div>';

      this.duplicateAnalysis.folders.forEach((group, groupIndex) => {
        mergeOptionsHTML += `
          <div class="merge-group" style="border: 1px solid #e9ecef; border-radius: 4px; padding: 8px; margin-bottom: 8px; background: #f8f9fa;">
            <div style="font-weight: 600; margin-bottom: 8px;">${group.name} (${group.folders.length} duplicates)</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Select target folder to keep, then select sources to merge into it:</div>
        `;

        group.folders.forEach((folder, folderIndex) => {
          mergeOptionsHTML += `
            <div style="margin: 4px 0; display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="target_folder_${groupIndex}" value="${folder.id}" id="target_folder_${groupIndex}_${folderIndex}">
              <label for="target_folder_${groupIndex}_${folderIndex}" style="font-weight: 600;">Keep:</label>
              <input type="checkbox" name="source_folder_${groupIndex}" value="${folder.id}" id="source_folder_${groupIndex}_${folderIndex}">
              <label for="source_folder_${groupIndex}_${folderIndex}">${folder.title} (${folder.path})</label>
            </div>
          `;
        });

        mergeOptionsHTML += '</div>';
      });
    }

    // Process duplicate bookmarks
    if (this.duplicateAnalysis.bookmarks && this.duplicateAnalysis.bookmarks.length > 0) {
      mergeOptionsHTML += '<div style="margin-bottom: 16px;"><strong>Duplicate Bookmarks:</strong></div>';

      this.duplicateAnalysis.bookmarks.forEach((group, groupIndex) => {
        mergeOptionsHTML += `
          <div class="merge-group" style="border: 1px solid #e9ecef; border-radius: 4px; padding: 8px; margin-bottom: 8px; background: #f8f9fa;">
            <div style="font-weight: 600; margin-bottom: 8px;">${group.url} (${group.bookmarks.length} duplicates)</div>
        `;

        group.bookmarks.forEach((bookmark, bookmarkIndex) => {
          mergeOptionsHTML += `
            <div style="margin: 4px 0; display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="target_bookmark_${groupIndex}" value="${bookmark.id}" id="target_bookmark_${groupIndex}_${bookmarkIndex}">
              <label for="target_bookmark_${groupIndex}_${bookmarkIndex}" style="font-weight: 600;">Keep:</label>
              <input type="checkbox" name="source_bookmark_${groupIndex}" value="${bookmark.id}" id="source_bookmark_${groupIndex}_${bookmarkIndex}">
              <label for="source_bookmark_${groupIndex}_${bookmarkIndex}">${bookmark.title} (${bookmark.parentTitle || 'Root'})</label>
            </div>
          `;
        });

        mergeOptionsHTML += '</div>';
      });
    }

    mergeOptionsHTML += `
      <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="executeMerge" class="button" type="button">Execute Manual Merge</button>
        <button id="cancelMerge" class="button secondary" type="button">Cancel</button>
      </div>
    </div>`;

    duplicateResults.innerHTML = mergeOptionsHTML;

    // Add event listeners for new buttons
    document.getElementById('executeMerge')?.addEventListener('click', () => this.executeManualMerge());
    document.getElementById('cancelMerge')?.addEventListener('click', () => this.cancelDuplicateScan());

    // Add auto-selection logic - when a target is selected, auto-check all others as sources
    const radioButtons = duplicateResults.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          const groupName = e.target.name;
          const groupIndex = groupName.split('_')[2];
          const type = groupName.includes('folder') ? 'folder' : 'bookmark';

          // Auto-check all other items in this group as sources
          const checkboxes = duplicateResults.querySelectorAll(`input[name="source_${type}_${groupIndex}"]`);
          checkboxes.forEach(checkbox => {
            if (checkbox.value !== e.target.value) {
              checkbox.checked = true;
            } else {
              checkbox.checked = false; // Can't merge target into itself
            }
          });
        }
      });
    });
  }

  async executeManualMerge() {
    try {
      const confirmed = await this.confirmWithText('⚠️ MANUAL MERGE CONFIRMATION\n\nThis will merge selected duplicates according to your choices.\n\nA backup will be created automatically. Continue?', {
        confirmText: 'Merge',
        confirmVariant: 'danger'
      });
      if (!confirmed) return;

      // Create backup first
      await this.createAutoBackup();

      let mergedCount = 0;
      let removedCount = 0;

      // Process folder merges
      if (this.duplicateAnalysis.folders) {
        for (let groupIndex = 0; groupIndex < this.duplicateAnalysis.folders.length; groupIndex++) {
          const targetRadio = document.querySelector(`input[name="target_folder_${groupIndex}"]:checked`);
          const sourceCheckboxes = document.querySelectorAll(`input[name="source_folder_${groupIndex}"]:checked`);

          if (targetRadio && sourceCheckboxes.length > 0) {
            const targetId = targetRadio.value;

            for (const sourceCheckbox of sourceCheckboxes) {
              if (sourceCheckbox.value !== targetId) {
                try {
                  // Move all bookmarks from source to target
                  const sourceChildren = await chrome.bookmarks.getChildren(sourceCheckbox.value);
                  for (const child of sourceChildren) {
                    await chrome.bookmarks.move(child.id, { parentId: targetId });
                  }

                  // Remove empty source folder
                  await chrome.bookmarks.removeTree(sourceCheckbox.value);
                  mergedCount++;
                } catch (error) {
                  console.warn('Failed to merge folder:', sourceCheckbox.value, error);
                }
              }
            }
          }
        }
      }

      // Process bookmark merges (removal of duplicates)
      if (this.duplicateAnalysis.bookmarks) {
        for (let groupIndex = 0; groupIndex < this.duplicateAnalysis.bookmarks.length; groupIndex++) {
          const targetRadio = document.querySelector(`input[name="target_bookmark_${groupIndex}"]:checked`);
          const sourceCheckboxes = document.querySelectorAll(`input[name="source_bookmark_${groupIndex}"]:checked`);

          if (targetRadio && sourceCheckboxes.length > 0) {
            const targetId = targetRadio.value;

            for (const sourceCheckbox of sourceCheckboxes) {
              if (sourceCheckbox.value !== targetId) {
                try {
                  await chrome.bookmarks.remove(sourceCheckbox.value);
                  removedCount++;
                } catch (error) {
                  console.warn('Failed to remove duplicate bookmark:', sourceCheckbox.value, error);
                }
              }
            }
          }
        }
      }

      this.showMessage(`Manual merge completed! Merged ${mergedCount} folders, removed ${removedCount} duplicate bookmarks.`, 'success');
      this.cancelDuplicateScan();

    } catch (error) {
      console.error('Manual merge failed:', error);
      this.showMessage('Manual merge failed: ' + error.message, 'error');
    }
  }

  async getAllBookmarksRecursively() {
    const bookmarks = [];

    // Get bookmark tree
    const bookmarkTree = await chrome.bookmarks.getTree();

    // Recursively find all bookmarks
    const findBookmarks = (nodes) => {
      for (const node of nodes) {
        if (node.url) { // It's a bookmark
          bookmarks.push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId
          });
        } else if (node.children) { // It's a folder with children
          findBookmarks(node.children);
        }
      }
    };

    findBookmarks(bookmarkTree);
    return bookmarks;
  }

  async cleanUrlParameters() {
    try {
      const confirmed = await this.confirmWithText('🧹 CLEAN URL PARAMETERS\n\nThis will remove tracking parameters (UTM, fbclid, etc.) from all bookmark URLs.\n\nExample:\n"site.com/page?utm_source=google&fbclid=123"\n→ "site.com/page"\n\nA backup will be created automatically. Continue?', {
        confirmText: 'Clean URLs',
        confirmVariant: 'danger'
      });
      if (!confirmed) return;

      // Create backup first
      await this.createAutoBackup();

      this.showMessage('Scanning bookmarks for URL parameters...', 'info');

      // Get all bookmarks
      const allBookmarks = await this.getAllBookmarksRecursively();
      let cleanedCount = 0;
      let modifiedBookmarks = [];

      for (const bookmark of allBookmarks) {
        const originalUrl = bookmark.url;
        const cleanedUrl = this.cleanUrl(originalUrl);

        if (originalUrl !== cleanedUrl) {
          modifiedBookmarks.push({
            id: bookmark.id,
            title: bookmark.title,
            originalUrl: originalUrl,
            cleanedUrl: cleanedUrl
          });
        }
      }

      if (modifiedBookmarks.length === 0) {
        this.showMessage('No URL parameters found to clean!', 'info');
        return;
      }

      // Show preview of changes
      this.showUrlCleaningPreview(modifiedBookmarks);

    } catch (error) {
      console.error('URL cleaning failed:', error);
      this.showMessage('URL cleaning failed: ' + error.message, 'error');
    }
  }

  cleanUrl(url) {
    try {
      const urlObj = new URL(url);

      // List of tracking parameters to remove
      const trackingParams = [
        // Google Analytics & Ads
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'gclsrc', 'dclid', 'wbraid', 'gbraid',

        // Facebook
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',

        // Twitter
        's', 't', 'twclid',

        // Instagram
        'igshid', 'igsh',

        // LinkedIn
        'trk', 'trkCampaign', 'li_fat_id',

        // Amazon
        'tag', 'linkCode', 'creativeASIN', 'linkId', 'ref_', 'ref', 'pf_rd_r', 'pf_rd_p',

        // YouTube
        'feature', 'kw', 'si',

        // Email tracking
        'email_source', 'email_campaign',

        // General tracking
        'source', 'medium', 'campaign', 'content', 'term',
        'mc_cid', 'mc_eid', // MailChimp
        '_hsenc', '_hsmi', 'hsCtaTracking', // HubSpot
        'vero_conv', 'vero_id', // Vero
        'wickedid', 'wickedsource', // Wicked Reports
        'yclid', // Yandex
        'msclkid', // Microsoft Ads
        'zanpid', // Zanox
        'ranMID', 'ranEAID', 'ranSiteID', // Commission Junction
        'cjevent', // Commission Junction
        'irclickid', 'irgwc', // Impact Radius
        'clickid', // Various affiliate networks

        // Social media tracking
        'share', 'shared', 'sharecnt',

        // Analytics
        '_ga', '_gl', '_ke', // Google Analytics enhanced
        'pk_source', 'pk_medium', 'pk_campaign', // Matomo/Piwik

        // Session & user tracking
        'sessionid', 'session_id', 'PHPSESSID', 'JSESSIONID',
        '_branch_match_id', '_branch_referrer',

        // Reddit
        'rdt_cid',

        // TikTok
        'tt_medium', 'tt_content',

        // Snapchat
        'sc_click_id', 'sc_eh',

        // Pinterest
        'epik',

        // Various
        'aff_sub', 'affiliate_id', 'partner_id',
        'src', 'source_campaign', 'promo_code',
      ];

      // Remove tracking parameters
      for (const param of trackingParams) {
        urlObj.searchParams.delete(param);
      }

      // Also remove parameters that start with common tracking prefixes
      const trackingPrefixes = ['utm_', 'fb_', 'ga_', 'gclid', '_hs', 'pk_', 'mc_', 'vero_'];
      for (const [key] of urlObj.searchParams) {
        for (const prefix of trackingPrefixes) {
          if (key.startsWith(prefix)) {
            urlObj.searchParams.delete(key);
            break;
          }
        }
      }

      // Rebuild URL
      let cleanedUrl = urlObj.origin + urlObj.pathname;

      // Add search params only if they exist
      if (urlObj.searchParams.toString()) {
        cleanedUrl += '?' + urlObj.searchParams.toString();
      }

      // Add hash if it exists
      if (urlObj.hash) {
        cleanedUrl += urlObj.hash;
      }

      return cleanedUrl;
    } catch (error) {
      // If URL parsing fails, return original URL
      console.warn('Failed to parse URL:', url, error);
      return url;
    }
  }

  showUrlCleaningPreview(modifiedBookmarks) {
    const duplicateResults = this.elements.duplicateResults;
    if (!duplicateResults) return;

    let previewHTML = `
      <div style="margin: 12px 0;">
        <h4>🧹 URL Cleaning Preview</h4>
        <div class="help-text" style="margin-bottom: 12px;">
          Found ${modifiedBookmarks.length} bookmark(s) with tracking parameters to clean.
        </div>
      </div>
    `;

    // Show first 10 examples
    const examples = modifiedBookmarks.slice(0, 10);
    previewHTML += '<div style="max-height: 300px; overflow-y: auto; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px; background: #f8f9fa; margin-bottom: 12px;">';

    examples.forEach((bookmark, index) => {
      previewHTML += `
        <div style="margin: 8px 0; padding: 8px; background: white; border-radius: 4px; border: 1px solid #dee2e6;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 13px;">${bookmark.title}</div>
          <div style="font-size: 11px; color: #dc3545; margin-bottom: 2px; word-break: break-all;">❌ ${bookmark.originalUrl}</div>
          <div style="font-size: 11px; color: #28a745; word-break: break-all;">✅ ${bookmark.cleanedUrl}</div>
        </div>
      `;
    });

    previewHTML += '</div>';

    if (modifiedBookmarks.length > 10) {
      previewHTML += `<div class="help-text" style="margin-bottom: 12px;">...and ${modifiedBookmarks.length - 10} more bookmarks</div>`;
    }

    previewHTML += `
      <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="executeUrlCleaning" class="button" type="button">Clean All URLs (${modifiedBookmarks.length})</button>
        <button id="cancelUrlCleaning" class="button secondary" type="button">Cancel</button>
      </div>
    `;

    duplicateResults.innerHTML = previewHTML;
    this.elements.duplicatePreview.classList.remove('hidden');

    // Store modified bookmarks for execution
    this._modifiedBookmarks = modifiedBookmarks;

    // Add event listeners
    document.getElementById('executeUrlCleaning')?.addEventListener('click', () => this.executeUrlCleaning());
    document.getElementById('cancelUrlCleaning')?.addEventListener('click', () => this.cancelDuplicateScan());
  }

  async executeUrlCleaning() {
    try {
      if (!this._modifiedBookmarks || this._modifiedBookmarks.length === 0) {
        this.showMessage('No URLs to clean', 'error');
        return;
      }

      this.showMessage(`Cleaning ${this._modifiedBookmarks.length} URLs...`, 'info');

      let successCount = 0;
      let errorCount = 0;

      for (const bookmark of this._modifiedBookmarks) {
        try {
          await chrome.bookmarks.update(bookmark.id, {
            url: bookmark.cleanedUrl
          });
          successCount++;
        } catch (error) {
          console.warn('Failed to update bookmark:', bookmark.id, error);
          errorCount++;
        }
      }

      // Clear the stored data
      delete this._modifiedBookmarks;

      // Show detailed results
      this.showCleanupResults('URL Parameter Cleaning', {
        total: this._modifiedBookmarks.length,
        success: successCount,
        failed: errorCount,
        message: 'Tracking parameters removed from bookmark URLs'
      });

      this.cancelDuplicateScan();

    } catch (error) {
      console.error('URL cleaning execution failed:', error);
      this.showMessage('URL cleaning failed: ' + error.message, 'error');
    }
  }

  async cleanEmptyFolders() {
    try {
      const confirmed = await this.confirmWithText('🗂️ CLEAN EMPTY FOLDERS\n\nThis will remove all empty bookmark folders from your browser.\n\nEmpty folders are folders that contain no bookmarks or other folders.\n\nA backup will be created automatically. Continue?', {
        confirmText: 'Remove Folders',
        confirmVariant: 'danger'
      });
      if (!confirmed) return;

      // Create backup first
      await this.createAutoBackup();

      this.showMessage('Scanning for empty folders...', 'info');

      // Get all empty folders
      const emptyFolders = await this.findEmptyFolders();

      if (emptyFolders.length === 0) {
        this.showMessage('No empty folders found! Your bookmark organization is already clean.', 'info');
        return;
      }

      // Show preview of folders to be removed
      this.showEmptyFoldersPreview(emptyFolders);

    } catch (error) {
      console.error('Empty folder cleanup failed:', error);
      this.showMessage('Empty folder cleanup failed: ' + error.message, 'error');
    }
  }

  async findEmptyFolders() {
    const emptyFolders = [];

    // Function to recursively check folders
    async function checkFolder(folderId, folderTitle = '', path = '') {
      try {
        const children = await chrome.bookmarks.getChildren(folderId);

        // Filter out bookmarks (items with URL) and count only folders
        const subfolders = children.filter(child => !child.url);
        const bookmarks = children.filter(child => child.url);

        // If this folder has no bookmarks and no subfolders, it's empty
        if (bookmarks.length === 0 && subfolders.length === 0) {
          // Don't remove root folders (Bookmarks Bar, Other Bookmarks, Mobile)
          if (!['1', '2', '3'].includes(folderId)) {
            emptyFolders.push({
              id: folderId,
              title: folderTitle,
              path: path
            });
          }
          return;
        }

        // Recursively check subfolders
        for (const subfolder of subfolders) {
          const currentPath = path ? `${path} > ${subfolder.title}` : subfolder.title;
          await checkFolder(subfolder.id, subfolder.title, currentPath);
        }

        // After checking subfolders, check if this folder became empty
        // (in case all its subfolders were removed)
        const updatedChildren = await chrome.bookmarks.getChildren(folderId);
        const updatedSubfolders = updatedChildren.filter(child => !child.url);
        const updatedBookmarks = updatedChildren.filter(child => child.url);

        if (updatedBookmarks.length === 0 && updatedSubfolders.length === 0) {
          if (!['1', '2', '3'].includes(folderId)) {
            // Check if already added to avoid duplicates
            if (!emptyFolders.some(folder => folder.id === folderId)) {
              emptyFolders.push({
                id: folderId,
                title: folderTitle,
                path: path
              });
            }
          }
        }

      } catch (error) {
        console.warn('Failed to check folder:', folderId, error);
      }
    }

    // Start from root folders
    const rootFolders = ['1', '2', '3']; // Bookmarks Bar, Other Bookmarks, Mobile
    for (const rootId of rootFolders) {
      try {
        const rootChildren = await chrome.bookmarks.getChildren(rootId);
        for (const child of rootChildren) {
          if (!child.url) { // It's a folder
            await checkFolder(child.id, child.title, child.title);
          }
        }
      } catch (error) {
        console.warn('Failed to scan root folder:', rootId, error);
      }
    }

    return emptyFolders;
  }

  showEmptyFoldersPreview(emptyFolders) {
    const duplicateResults = this.elements.duplicateResults;
    if (!duplicateResults) return;

    let previewHTML = `
      <div style="margin: 12px 0;">
        <h4>🗂️ Empty Folders Cleanup Preview</h4>
        <div class="help-text" style="margin-bottom: 12px;">
          Found ${emptyFolders.length} empty folder(s) to remove.
        </div>
      </div>
    `;

    // Show folders to be removed
    previewHTML += '<div style="max-height: 300px; overflow-y: auto; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px; background: #f8f9fa; margin-bottom: 12px;">';

    emptyFolders.forEach((folder, index) => {
      previewHTML += `
        <div style="margin: 6px 0; padding: 8px; background: white; border-radius: 4px; border: 1px solid #dee2e6; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">📁</span>
          <div>
            <div style="font-weight: 600; font-size: 13px;">${folder.title}</div>
            <div style="font-size: 11px; color: #666;">${folder.path}</div>
          </div>
        </div>
      `;
    });

    previewHTML += '</div>';

    previewHTML += `
      <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="executeEmptyFolderCleaning" class="button" type="button">Remove All Empty Folders (${emptyFolders.length})</button>
        <button id="cancelEmptyFolderCleaning" class="button secondary" type="button">Cancel</button>
      </div>
    `;

    duplicateResults.innerHTML = previewHTML;
    this.elements.duplicatePreview.classList.remove('hidden');

    // Store empty folders for execution
    this._emptyFolders = emptyFolders;

    // Add event listeners
    document.getElementById('executeEmptyFolderCleaning')?.addEventListener('click', () => this.executeEmptyFolderCleaning());
    document.getElementById('cancelEmptyFolderCleaning')?.addEventListener('click', () => this.cancelDuplicateScan());
  }

  async executeEmptyFolderCleaning() {
    try {
      if (!this._emptyFolders || this._emptyFolders.length === 0) {
        this.showMessage('No empty folders to remove', 'error');
        return;
      }

      this.showMessage(`Removing ${this._emptyFolders.length} empty folders...`, 'info');

      let successCount = 0;
      let errorCount = 0;

      // Sort by path depth (deepest first) to avoid removing parent before child
      const sortedFolders = [...this._emptyFolders].sort((a, b) => {
        const depthA = (a.path.match(/>/g) || []).length;
        const depthB = (b.path.match(/>/g) || []).length;
        return depthB - depthA; // Reverse order (deepest first)
      });

      for (const folder of sortedFolders) {
        try {
          // Double-check that folder is still empty before removing
          const children = await chrome.bookmarks.getChildren(folder.id);
          if (children.length === 0) {
            await chrome.bookmarks.removeTree(folder.id);
            successCount++;
          }
        } catch (error) {
          console.warn('Failed to remove folder:', folder.id, error);
          errorCount++;
        }
      }

      // Clear the stored data
      delete this._emptyFolders;

      // Show detailed results
      this.showCleanupResults('Empty Folders Cleanup', {
        total: sortedFolders.length,
        success: successCount,
        failed: errorCount,
        message: 'Empty bookmark folders removed'
      });

      this.cancelDuplicateScan();

    } catch (error) {
      console.error('Empty folder cleanup execution failed:', error);
      this.showMessage('Empty folder cleanup failed: ' + error.message, 'error');
    }
  }

  triggerRestoreFile() {
    if (this.elements.restoreFile) {
      this.elements.restoreFile.click();
    }
  }

  async handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const confirmed = await this.confirmWithText('⚠️ RESTORE WARNING\n\nThis will restore bookmarks from the backup file. Current bookmarks will be merged with backup contents.\n\nProceed with restore?', {
      confirmText: 'Restore',
      confirmVariant: 'danger'
    });
    if (!confirmed) {
      event.target.value = ''; // Clear file selection
      return;
    }

    try {
      const btn = this.elements.restoreFromFile;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Restoring...';
      }

      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.bookmarks) {
        throw new Error('Invalid backup file format');
      }

      await this.restoreFromBackup(backupData);
      this.showMessage('Backup restored successfully', 'success');
    } catch (error) {
      this.showMessage('Restore failed: ' + error.message, 'error');
    } finally {
      const btn = this.elements.restoreFromFile;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Restore from Backup';
      }
      event.target.value = ''; // Clear file selection
    }
  }

  async emergencyRestore() {
    const confirmed = await this.confirmWithText('🚨 EMERGENCY RESTORE WARNING\n\nThis will DELETE ALL current bookmarks and restore from a backup file.\n\nThis is a destructive operation that cannot be undone.\n\nOnly proceed if your current bookmarks are corrupted.\n\nClick OK to select backup file.', {
      confirmText: 'Select Backup',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    // Trigger file selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const finalConfirm = await this.confirmWithText('FINAL WARNING: All current bookmarks will be deleted and replaced with backup contents.\n\nThis action cannot be undone!\n\nProceed?', {
        confirmText: 'Restore',
        confirmVariant: 'danger'
      });
      if (!finalConfirm) return;

      try {
        const btn = this.elements.emergencyRestore;
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Emergency Restoring...';
        }

        // Clear all bookmarks first
        await this.clearAllBookmarksForRestore();

        // Restore from backup
        const text = await file.text();
        const backupData = JSON.parse(text);

        if (!backupData.bookmarks) {
          throw new Error('Invalid backup file format');
        }

        await this.restoreFromBackup(backupData);
        this.showMessage('Emergency restore completed successfully', 'success');
      } catch (error) {
        this.showMessage('Emergency restore failed: ' + error.message, 'error');
      } finally {
        const btn = this.elements.emergencyRestore;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Emergency Restore (Clear All + Restore)';
        }
      }
    };
    input.click();
  }

  triggerRestoreBackup() {
    if (this.elements.restoreBackupFile) {
      this.elements.restoreBackupFile.click();
    }
  }

  async handleRestoreBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const confirmed = await this.confirmWithText('⚠️ RESTORE WARNING\n\nThis will restore bookmarks from the selected backup file. Current bookmarks will be merged with backup contents.\n\nProceed with restore?', {
      confirmText: 'Restore',
      confirmVariant: 'danger'
    });
    if (!confirmed) {
      event.target.value = ''; // Clear file selection
      return;
    }

    try {
      const btn = this.elements.restoreFromBackup;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Restoring...';
      }

      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData || !backupData.bookmarks) {
        throw new Error('Invalid backup file format - missing bookmarks data');
      }

      await this.restoreFromBackup(backupData);
      this.showMessage('Backup restored successfully', 'success');

      // Refresh UI after restore
      await this.refreshAutoBackups();
    } catch (error) {
      this.showMessage('Restore failed: ' + error.message, 'error');
    } finally {
      const btn = this.elements.restoreFromBackup;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Restore from Backup File';
      }
      event.target.value = ''; // Clear file selection
    }
  }

  async downloadManualBackup() {
    try {
      const btn = this.elements.downloadBackupFile;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creating...';
      }

      await this.backupBookmarks();

      if (btn) {
        btn.textContent = '✓ Downloaded';
        btn.style.backgroundColor = '#28a745';
        btn.style.color = 'white';

        setTimeout(() => {
          btn.textContent = 'Download Backup';
          btn.style.backgroundColor = '';
          btn.style.color = '';
          btn.disabled = false;
        }, 2000);
      }
    } catch (error) {
      console.error('Manual backup download failed:', error);
      this.showMessage('Manual backup failed: ' + error.message, 'error');

      const btn = this.elements.downloadBackupFile;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Download Backup';
        btn.style.backgroundColor = '';
        btn.style.color = '';
      }
    }
  }

  async downloadLatestBackup() {
    try {
      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);

      if (backupKeys.length === 0) {
        this.showMessage('No automatic backups available to download', 'error');
        return;
      }

      // Get the most recent backup
      const latestBackupKey = backupKeys[backupKeys.length - 1];
      const backupData = await chrome.storage.local.get([latestBackupKey]);
      const backup = backupData[latestBackupKey];

      if (!backup) {
        this.showMessage('Latest backup data not found', 'error');
        return;
      }

      // Create and download the file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `latest-auto-backup-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showMessage('Latest backup downloaded successfully', 'success');
    } catch (error) {
      console.error('Download latest backup failed:', error);
      this.showMessage('Download failed: ' + error.message, 'error');
    }
  }

  async restoreFromBackup(backupData) {
    try {
      // Validate backup data
      if (!backupData || !backupData.bookmarks) {
        throw new Error('Invalid backup data: missing bookmarks');
      }

      if (!Array.isArray(backupData.bookmarks)) {
        throw new Error('Invalid backup data: bookmarks is not an array');
      }

      if (backupData.bookmarks.length === 0) {
        throw new Error('Invalid backup data: bookmarks array is empty');
      }

      // Get current bookmark tree structure to map folders correctly
      const currentTree = await chrome.bookmarks.getTree();

      if (!currentTree || !currentTree[0] || !currentTree[0].children) {
        throw new Error('Failed to read current bookmark tree structure');
      }

      const bookmarkBarId = currentTree[0].children[0]?.id || '1'; // Usually '1'
      const otherBookmarksId = currentTree[0].children[1]?.id || '2'; // Usually '2'

      let restoredCount = 0;

      // Create bookmarks from backup preserving original locations
      for (const rootNode of backupData.bookmarks) {
        if (!rootNode || !rootNode.children) {
          continue; // Skip invalid nodes
        }

        for (const topLevelNode of rootNode.children) {
          if (!topLevelNode) {
            continue; // Skip invalid nodes
          }

          // Map original Chrome bookmark folders to current structure
          let targetParentId;

          if (topLevelNode.title === 'Bookmarks bar' || topLevelNode.id === '1') {
            targetParentId = bookmarkBarId;
          } else if (topLevelNode.title === 'Other bookmarks' || topLevelNode.id === '2') {
            targetParentId = otherBookmarksId;
          } else {
            // For other folders, restore to Other Bookmarks
            targetParentId = otherBookmarksId;
          }

          if (topLevelNode.children && Array.isArray(topLevelNode.children)) {
            await this.createBookmarksFromTree(topLevelNode.children, targetParentId);
            restoredCount += topLevelNode.children.length;
          }
        }
      }

      console.log(`Restore completed: ${restoredCount} items restored`);

      if (restoredCount === 0) {
        console.warn('Warning: No bookmarks were restored from backup');
      }
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  async clearAllBookmarksForRestore() {
    try {
      // This is specifically for emergency restore - clears everything
      const bookmarkTree = await chrome.bookmarks.getTree();

      for (const rootNode of bookmarkTree) {
        if (rootNode.children) {
          for (const topLevelNode of rootNode.children) {
            if (topLevelNode.children) {
              // Clear all children but keep the folder structure
              for (const child of topLevelNode.children) {
                try {
                  await chrome.bookmarks.removeTree(child.id);
                } catch (error) {
                  console.warn('Failed to remove bookmark tree:', child, error);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Clear all bookmarks failed:', error);
      throw error;
    }
  }

  async scanForDuplicates() {
    try {
      const btn = this.elements.scanDuplicates;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Scanning...';
      }

      // Get all bookmarks to analyze
      const bookmarkTree = await chrome.bookmarks.getTree();

      // Find duplicate bookmarks and folders
      const duplicateBookmarks = this.findDuplicateBookmarks(bookmarkTree);
      const duplicateFolders = this.findDuplicateFolders(bookmarkTree);

      // Store results for later use
      this.duplicateAnalysis = {
        bookmarks: duplicateBookmarks,
        folders: duplicateFolders,
        selectedBookmarks: new Set(),
        selectedFolders: new Set()
      };

      // Show results
      this.displayDuplicateResults(duplicateBookmarks, duplicateFolders);

      // Show preview section
      if (this.elements.duplicatePreview) {
        this.elements.duplicatePreview.classList.remove('hidden');
      }

    } catch (error) {
      this.showMessage('Duplicate scan failed: ' + error.message, 'error');
    } finally {
      const btn = this.elements.scanDuplicates;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Scan for Duplicates';
      }
    }
  }

  findDuplicateBookmarks(bookmarkTree) {
    const bookmarkMap = new Map();
    const duplicates = [];

    // Recursively find all bookmarks
    const findBookmarks = (nodes) => {
      for (const node of nodes) {
        if (node.url) { // It's a bookmark
          const url = node.url.toLowerCase();

          if (!bookmarkMap.has(url)) {
            bookmarkMap.set(url, []);
          }

          bookmarkMap.get(url).push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId
          });
        } else if (node.children) {
          findBookmarks(node.children);
        }
      }
    };

    findBookmarks(bookmarkTree);

    // Find URLs with multiple bookmarks
    for (const [url, bookmarks] of bookmarkMap.entries()) {
      if (bookmarks.length > 1) {
        duplicates.push({
          url: url,
          bookmarks: bookmarks,
          count: bookmarks.length
        });
      }
    }

    return duplicates;
  }

  displayDuplicateResults(duplicateBookmarks, duplicateFolders) {
    const resultsContainer = this.elements.duplicateResults;
    if (!resultsContainer) return;

    let html = '';

    // Summary
    html += `<div style="margin-bottom: 16px; padding: 8px; background: #e3f2fd; border-radius: 4px;">`;
    html += `<strong>Scan Results:</strong> `;
    html += `${duplicateBookmarks.length} duplicate bookmark groups, `;
    html += `${duplicateFolders.length} duplicate folder groups found.`;
    html += `</div>`;

    if (duplicateBookmarks.length === 0 && duplicateFolders.length === 0) {
      html += `<div style="color: #28a745; font-weight: 500;">✅ No duplicates found! Your bookmarks are clean.</div>`;
      resultsContainer.innerHTML = html;
      return;
    }

    // Duplicate bookmarks
    if (duplicateBookmarks.length > 0) {
      html += `<h5 style="color: #dc3545; margin: 12px 0 8px 0;">📚 Duplicate Bookmarks</h5>`;

      for (let i = 0; i < Math.min(duplicateBookmarks.length, 5); i++) {
        const group = duplicateBookmarks[i];
        html += `<div style="margin: 8px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: white;">`;
        html += `<div style="font-weight: 500; margin-bottom: 4px;">${group.bookmarks[0].title}</div>`;
        html += `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">${group.url}</div>`;
        html += `<div style="font-size: 12px; color: #dc3545;">Found ${group.count} copies</div>`;
        html += `</div>`;
      }

      if (duplicateBookmarks.length > 5) {
        html += `<div style="color: #666; font-style: italic;">... and ${duplicateBookmarks.length - 5} more groups</div>`;
      }
    }

    // Duplicate folders
    if (duplicateFolders.length > 0) {
      html += `<h5 style="color: #dc3545; margin: 12px 0 8px 0;">📁 Duplicate Folders</h5>`;

      for (let i = 0; i < Math.min(duplicateFolders.length, 5); i++) {
        const group = duplicateFolders[i];
        html += `<div style="margin: 8px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: white;">`;
        html += `<div style="font-weight: 500; margin-bottom: 4px;">📁 ${group.folders[0].title}</div>`;
        html += `<div style="font-size: 12px; color: #dc3545;">Found ${group.folders.length} folders with this name</div>`;
        html += `</div>`;
      }

      if (duplicateFolders.length > 5) {
        html += `<div style="color: #666; font-style: italic;">... and ${duplicateFolders.length - 5} more groups</div>`;
      }
    }

    resultsContainer.innerHTML = html;
  }

  async autoCleanupSelected() {
    if (!this.duplicateAnalysis) {
      this.showMessage('No scan results available. Please scan first.', 'error');
      return;
    }

    const confirmed = await this.confirmWithText('⚠️ AUTO CLEANUP CONFIRMATION\n\nThis will automatically clean all found duplicates:\n\n• Remove duplicate bookmarks (keep first occurrence)\n• Merge duplicate folders (merge into first folder)\n\nProceed with auto cleanup?', {
      confirmText: 'Clean Duplicates',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      // Create backup first
      await this.createAutoBackup();

      // Wait a moment for backup
      await new Promise(resolve => setTimeout(resolve, 1000));

      let removedBookmarks = 0;
      let mergedFolders = 0;

      // Clean duplicate bookmarks
      for (const group of this.duplicateAnalysis.bookmarks) {
        // Keep first bookmark, remove others
        const toRemove = group.bookmarks.slice(1);
        for (const bookmark of toRemove) {
          try {
            await chrome.bookmarks.remove(bookmark.id);
            removedBookmarks++;
          } catch (error) {
            console.warn('Failed to remove duplicate bookmark:', bookmark, error);
          }
        }
      }

      // Merge duplicate folders
      for (const group of this.duplicateAnalysis.folders) {
        try {
          await this.mergeFolderGroup(group);
          mergedFolders++;
        } catch (error) {
          console.warn('Failed to merge folder group:', group, error);
        }
      }

      // Show detailed results
      const totalDuplicates = this.duplicateAnalysis.bookmarks.reduce((sum, g) => sum + g.bookmarks.length - 1, 0) +
                              this.duplicateAnalysis.folders.length;
      this.showCleanupResults('Duplicate Cleanup', {
        total: totalDuplicates,
        success: removedBookmarks + mergedFolders,
        failed: 0,
        details: `${removedBookmarks} duplicate bookmarks removed, ${mergedFolders} folder groups merged`
      });

      // Hide preview and clear results
      this.cancelDuplicateScan();

    } catch (error) {
      this.showMessage('Auto cleanup failed: ' + error.message, 'error');
    }
  }

  showAdvancedSelection() {
    this.showMessage('Advanced selection interface is coming in future version. For now, use Auto Cleanup for safe automated cleaning.', 'info');
  }

  cancelDuplicateScan() {
    if (this.elements.duplicatePreview) {
      this.elements.duplicatePreview.classList.add('hidden');
    }
    if (this.elements.duplicateResults) {
      this.elements.duplicateResults.innerHTML = '';
    }
    this.duplicateAnalysis = null;
  }

  onImportFileSelected() {
    const importFile = document.getElementById('importFile');
    const importBtn = document.getElementById('importBookmarks');

    if (importFile && importBtn) {
      importBtn.disabled = !importFile.files.length;
    }
  }

  async importBookmarks() {
    const importFile = document.getElementById('importFile');
    if (!importFile || !importFile.files.length) {
      this.showMessage('Please select a file first', 'error');
      return;
    }

    const file = importFile.files[0];
    const importBtn = document.getElementById('importBookmarks');

    try {
      if (importBtn) {
        importBtn.textContent = 'Importing...';
        importBtn.disabled = true;
      }

      const content = await this.readFileContent(file);

      if (file.name.toLowerCase().endsWith('.json')) {
        await this.importFromJSON(content);
      } else if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
        await this.importFromHTML(content);
      } else {
        throw new Error('Unsupported file format');
      }

      this.showMessage('Bookmarks imported successfully', 'success');
    } catch (error) {
      this.showMessage(`Import failed: ${error.message}`, 'error');
    } finally {
      if (importBtn) {
        importBtn.textContent = 'Import Bookmarks';
        importBtn.disabled = false;
      }
      importFile.value = '';
      this.onImportFileSelected();
    }
  }

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async importFromJSON(content) {
    try {
      const data = JSON.parse(content);

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON: not an object');
      }

      let imported = false;

      // Handle our backup format
      if (data.bookmarks && Array.isArray(data.bookmarks)) {
        // Our backup format contains full tree structure
        for (const rootNode of data.bookmarks) {
          if (rootNode && rootNode.children) {
            for (const topLevelNode of rootNode.children) {
              if (topLevelNode && topLevelNode.children) {
                // Determine target folder
                let targetId = '2'; // Default to Other Bookmarks
                if (topLevelNode.title === 'Bookmarks bar' || topLevelNode.id === '1') {
                  targetId = '1';
                }
                await this.createBookmarksFromTree(topLevelNode.children, targetId);
                imported = true;
              }
            }
          }
        }
      }
      // Handle Chrome bookmark export format
      else if (data.roots && typeof data.roots === 'object') {
        for (const [key, folder] of Object.entries(data.roots)) {
          if (folder && folder.children && Array.isArray(folder.children)) {
            const targetId = key === 'bookmark_bar' ? '1' : '2';
            await this.createBookmarksFromTree(folder.children, targetId);
            imported = true;
          }
        }
      }
      // Handle simple bookmark array format
      else if (Array.isArray(data)) {
        await this.createBookmarksFromTree(data, '1');
        imported = true;
      }
      else {
        throw new Error('Unrecognized JSON format. Expected backup format or Chrome export format.');
      }

      if (!imported) {
        throw new Error('No bookmarks found in the file');
      }
    } catch (error) {
      if (error.name === 'SyntaxError') {
        throw new Error('Invalid JSON file: ' + error.message);
      }
      throw error;
    }
  }

  async importFromHTML(content) {
    // Basic HTML bookmark import - parse DT/A tags
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const links = doc.querySelectorAll('a[href]');

    let imported = 0;
    for (const link of links) {
      try {
        await chrome.bookmarks.create({
          parentId: '1', // Bookmarks Bar
          title: link.textContent || link.href,
          url: link.href
        });
        imported++;
      } catch (error) {
        console.warn('Failed to import bookmark:', link.href, error);
      }
    }

    if (imported === 0) {
      throw new Error('No valid bookmarks found in HTML file');
    }
  }

  async createBookmarksFromTree(nodes, parentId) {
    if (!nodes || !Array.isArray(nodes)) {
      console.warn('createBookmarksFromTree: Invalid nodes parameter', nodes);
      return;
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      try {
        if (!node) {
          continue; // Skip null/undefined nodes
        }

        if (node.url) {
          // It's a bookmark - validate URL
          if (!node.url.startsWith('http://') && !node.url.startsWith('https://') && !node.url.startsWith('chrome://') && !node.url.startsWith('about:')) {
            console.warn('Skipping invalid URL:', node.url);
            continue;
          }

          // Preserve empty titles (for favicon-only bookmarks)
          // Use title/name if exists, otherwise empty string (NOT url)
          const bookmarkTitle = node.title !== undefined ? node.title : (node.name !== undefined ? node.name : '');

          // Preserve original index/order
          const createOptions = {
            parentId: parentId,
            title: bookmarkTitle,
            url: node.url
          };

          // Use stored index if available, otherwise use loop index
          if (node.index !== undefined) {
            createOptions.index = node.index;
          } else {
            createOptions.index = i;
          }

          await chrome.bookmarks.create(createOptions);
        } else if (node.children && Array.isArray(node.children)) {
          // It's a folder
          const folderTitle = node.title !== undefined ? node.title : (node.name !== undefined ? node.name : 'Imported Folder');

          const createOptions = {
            parentId: parentId,
            title: folderTitle
          };

          // Preserve folder index
          if (node.index !== undefined) {
            createOptions.index = node.index;
          } else {
            createOptions.index = i;
          }

          const folder = await chrome.bookmarks.create(createOptions);
          await this.createBookmarksFromTree(node.children, folder.id);
        }
      } catch (error) {
        console.warn('Failed to import item:', node?.title || node?.url || 'unknown', error.message);
      }
    }
  }

  async cleanupDuplicatesWithBackup() {
    const confirmed = await this.confirmWithText('⚠️ BACKUP REQUIRED\n\nThis operation will remove duplicate bookmarks permanently. A backup is required before proceeding.\n\nClick OK to download backup first, then proceed with cleanup.', {
      confirmText: 'Download Backup',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;

    try {
      // Force backup download first
      await this.exportBookmarks();

      // Wait a moment for download to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Confirm again after backup
      const proceedConfirmed = await this.confirmWithText('Backup downloaded. Proceed with removing duplicate bookmarks?\n\nThis action cannot be undone.', {
        confirmText: 'Remove Duplicates',
        confirmVariant: 'danger'
      });
      if (!proceedConfirmed) return;

      await this.cleanupDuplicates();
    } catch (error) {
      this.showMessage('Backup or cleanup failed: ' + error.message, 'error');
    }
  }

  async mergeDuplicateFoldersWithBackup() {
    const confirmed = await this.confirmWithText('⚠️ BACKUP REQUIRED\n\nThis operation will merge folders with identical names and remove duplicates permanently. A backup is required before proceeding.\n\nClick OK to download backup first, then proceed with folder merge.', {
      confirmText: 'Download Backup',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;

    try {
      // Force backup download first
      await this.exportBookmarks();

      // Wait a moment for download to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Confirm again after backup
      const proceedConfirmed = await this.confirmWithText('Backup downloaded. Proceed with merging duplicate folders?\n\nThis action cannot be undone.', {
        confirmText: 'Merge Folders',
        confirmVariant: 'danger'
      });
      if (!proceedConfirmed) return;

      await this.mergeDuplicateFolders();
    } catch (error) {
      this.showMessage('Backup or folder merge failed: ' + error.message, 'error');
    }
  }

  async cleanupDuplicates() {
    try {
      if (this.elements.cleanupDuplicates) {
        this.elements.cleanupDuplicates.disabled = true;
        this.elements.cleanupDuplicates.textContent = 'Cleaning...';
      }

      console.log('Options: Sending cleanupDuplicates message...');
      const response = await chrome.runtime.sendMessage({ action: 'cleanupDuplicates' });
      console.log('Options: Received response:', response);

      if (response?.success) {
        this.showMessage(`Removed ${response.duplicatesRemoved} duplicate bookmarks`, 'success');
      } else {
        this.showMessage(`Cleanup failed: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      this.showMessage(`Cleanup failed: ${error.message}`, 'error');
    } finally {
      if (this.elements.cleanupDuplicates) {
        this.elements.cleanupDuplicates.disabled = false;
        this.elements.cleanupDuplicates.textContent = 'Remove Duplicate Bookmarks';
      }
    }
  }

  async mergeDuplicateFolders() {
    try {
      if (this.elements.mergeDuplicateFolders) {
        this.elements.mergeDuplicateFolders.disabled = true;
        this.elements.mergeDuplicateFolders.textContent = 'Merging...';
      }

      console.log('Options: Starting merge duplicate folders...');

      // Get all bookmarks to find duplicate folders
      const bookmarkTree = await chrome.bookmarks.getTree();
      const duplicateFolders = this.findDuplicateFolders(bookmarkTree);

      if (duplicateFolders.length === 0) {
        this.showMessage('No duplicate folders found', 'info');
        return;
      }

      let mergedCount = 0;
      let mergedBookmarks = 0;

      for (const duplicateGroup of duplicateFolders) {
        const mergeResult = await this.mergeFolderGroup(duplicateGroup);
        mergedCount++;
        mergedBookmarks += mergeResult.bookmarksMerged;
      }

      this.showMessage(`Merged ${mergedCount} duplicate folder groups, ${mergedBookmarks} bookmarks consolidated`, 'success');
    } catch (error) {
      this.showMessage(`Folder merge failed: ${error.message}`, 'error');
    } finally {
      if (this.elements.mergeDuplicateFolders) {
        this.elements.mergeDuplicateFolders.disabled = false;
        this.elements.mergeDuplicateFolders.textContent = 'Merge Duplicate Folders';
      }
    }
  }

  async cleanupAndMergeWithBackup() {
    const confirmed = await this.confirmWithText('⚠️ BACKUP REQUIRED\n\nThis operation will remove duplicate bookmarks AND merge duplicate folders permanently. A backup is required before proceeding.\n\nClick OK to download backup first, then proceed with complete cleanup.', {
      confirmText: 'Download Backup',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;

    try {
      // Force backup download first
      await this.exportBookmarks();

      // Wait a moment for download to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Confirm again after backup
      const proceedConfirmed = await this.confirmWithText('Backup downloaded. Proceed with complete cleanup (remove duplicates + merge folders)?\n\nThis action cannot be undone.', {
        confirmText: 'Run Cleanup',
        confirmVariant: 'danger'
      });
      if (!proceedConfirmed) return;

      await this.cleanupAndMerge();
    } catch (error) {
      this.showMessage('Backup or cleanup failed: ' + error.message, 'error');
    }
  }

  async cleanupAndMerge() {
    try {
      if (this.elements.cleanupAndMerge) {
        this.elements.cleanupAndMerge.disabled = true;
        this.elements.cleanupAndMerge.textContent = 'Processing...';
      }

      // First merge duplicate folders
      this.showMessage('Step 1: Merging duplicate folders...', 'info');
      await this.mergeDuplicateFolders();

      // Then cleanup duplicate bookmarks
      this.showMessage('Step 2: Removing duplicate bookmarks...', 'info');
      await this.cleanupDuplicates();

      this.showMessage('Complete cleanup finished successfully', 'success');
    } catch (error) {
      this.showMessage(`Complete cleanup failed: ${error.message}`, 'error');
    } finally {
      if (this.elements.cleanupAndMerge) {
        this.elements.cleanupAndMerge.disabled = false;
        this.elements.cleanupAndMerge.textContent = 'Remove Duplicates and Merge';
      }
    }
  }

  findDuplicateFolders(bookmarkTree) {
    const folderMap = new Map();
    const duplicates = [];

    // Recursively find all folders
    const findFolders = (nodes, parentPath = '') => {
      for (const node of nodes) {
        if (node.children) { // It's a folder
          const folderName = node.title.toLowerCase().trim();
          const folderPath = parentPath + '/' + folderName;

          if (!folderMap.has(folderName)) {
            folderMap.set(folderName, []);
          }

          folderMap.get(folderName).push({
            id: node.id,
            title: node.title,
            parentId: node.parentId,
            path: folderPath,
            node: node
          });

          // Recursively check children
          if (node.children.length > 0) {
            findFolders(node.children, folderPath);
          }
        }
      }
    };

    findFolders(bookmarkTree);

    // Find folders with duplicate names (more than 1 occurrence)
    for (const [folderName, folders] of folderMap.entries()) {
      if (folders.length > 1) {
        duplicates.push({
          name: folderName,
          folders: folders
        });
      }
    }

    return duplicates;
  }

  async mergeFolderGroup(duplicateGroup) {
    const { name, folders } = duplicateGroup;
    let bookmarksMerged = 0;

    // Keep the first folder as the target, merge others into it
    const targetFolder = folders[0];
    const foldersToMerge = folders.slice(1);

    for (const sourceFolder of foldersToMerge) {
      // Get all bookmarks/subfolders from source folder
      const [sourceNode] = await chrome.bookmarks.getSubTree(sourceFolder.id);

      if (sourceNode.children) {
        // Move all children to target folder
        for (const child of sourceNode.children) {
          try {
            await chrome.bookmarks.move(child.id, { parentId: targetFolder.id });
            if (!child.children) { // It's a bookmark
              bookmarksMerged++;
            }
          } catch (error) {
            console.warn('Failed to move bookmark:', child, error);
          }
        }
      }

      // Remove the now-empty source folder
      try {
        await chrome.bookmarks.remove(sourceFolder.id);
      } catch (error) {
        console.warn('Failed to remove empty folder:', sourceFolder, error);
      }
    }

    return { bookmarksMerged };
  }

  toggleCollectionExpansion(collectionId, expandButton) {
    const childrenContainer = document.querySelector(`[data-parent-id="${collectionId}"]`);
    if (!childrenContainer) return;

    const isExpanded = expandButton.classList.contains('expanded');

    if (isExpanded) {
      // Collapse
      expandButton.classList.remove('expanded');
      expandButton.classList.add('collapsed');
      expandButton.textContent = '+';
      childrenContainer.style.display = 'none';
    } else {
      // Expand
      expandButton.classList.remove('collapsed');
      expandButton.classList.add('expanded');
      expandButton.textContent = '−';
      childrenContainer.style.display = 'block';
    }
  }

  filterCollections() {
    const q = (this.elements.collectionsSearch?.value || '').toLowerCase();
    if (!this.elements.collectionsList) return;
    this.elements.collectionsList.querySelectorAll('.collection-item').forEach(item => {
      const t = (item.textContent || '').toLowerCase();
      item.style.display = t.includes(q) ? 'flex' : 'none';
    });
  }

  setAllCollections(check) {
    if (!this.elements.collectionsList) return;
    this.elements.collectionsList.querySelectorAll('.collection-checkbox').forEach(cb => {
      cb.checked = !!check;
      cb.indeterminate = false;
    });
    this.saveSelectedCollections();
  }

  // ---------- Auth and config actions ----------
  async saveConfiguration() {
    try {
      const managedOAuth = this.elements.authMethod?.value === 'managed';
      const managedOAuthBaseUrl = this.elements.managedOAuthBaseUrl?.value.trim() || 'https://rdoauth.daiquiri.dev';

      let clientId = this.elements.clientId?.value.trim() || '';
      let clientSecret = this.elements.clientSecret?.value.trim() || '';
      let redirectUri = (this.elements.redirectUri?.value.trim()) || '';
      if (!redirectUri && chrome.identity && chrome.identity.getRedirectURL) {
        redirectUri = chrome.identity.getRedirectURL();
      }
      if (!managedOAuth) {
        if (!clientId) return this.showMessage('Client ID is required', 'error');
        if (!clientSecret) return this.showMessage('Client Secret is required', 'error');
      } else {
        // In managed mode, we can clear local secrets if previously set
        clientId = clientId; // optional
        clientSecret = clientSecret; // optional
      }

      await chrome.storage.sync.set({ clientId, clientSecret, managedOAuth, managedOAuthBaseUrl, redirectUri });
      // Only show save message if not in the middle of authentication
      if (!this.elements.authenticateManaged?.disabled && !this.elements.authenticateManual?.disabled) {
        this.showMessage('Configuration saved successfully', 'success');
      }
    } catch (_) { this.showMessage('Failed to save configuration', 'error'); }
  }

  async authenticateManaged() {
    try {
      this.clearMessages(); // Clear any previous messages
      this.setButtonLoading(this.elements.authenticateBtn, true);
      this.setAuthStatus('Connecting...', 'Initializing Cloudflare authentication', true);
      this.showProgress(true, 10, 'Starting authentication flow...');

      // Force managed mode on
      if (this.elements.managedOAuth) {
        this.elements.managedOAuth.checked = true;
        await this.saveConfiguration();
      }

      this.showProgress(true, 30, 'Redirecting to authentication...');

      console.log('🔐 Starting managed OAuth flow...');
      const res = await this.oauth.startAuthFlow();
      console.log('🔐 OAuth flow result:', res);

      this.showProgress(true, 80, 'Processing authentication response...');

      if (res?.success) {
        this.showProgress(true, 100, 'Authentication successful!');
        this.showMessage('Managed authentication successful!', 'success');

        console.log('🔐 Auth successful, checking token storage...');

        // Immediately check if tokens were saved
        const { accessToken } = await chrome.storage.sync.get(['accessToken']);
        console.log('🔐 Token in storage after auth:', !!accessToken);

        // Wait a bit for tokens to be saved to storage, then update status
        setTimeout(async () => {
          console.log('🔐 Starting auth status update with retry...');
          await this.updateAuthStatusWithRetry();
          await this.loadUserInfo();
        }, 500);
      } else {
        this.showMessage('Managed authentication failed', 'error');
        this.setAuthStatus('Authentication failed', 'Please try again or use manual mode');
      }
    } catch (e) {
      const suggestions = this.getErrorSuggestions(e.message);
      this.showDetailedError('Managed Authentication Failed', e.message, suggestions);
      this.setAuthStatus('Authentication error', e.message);

      // Show manual auth section for fallback
      if (this.elements.manualAuthSection) {
        this.elements.manualAuthSection.classList.remove('hidden');
      }

      // Fallback suggestion
      await this.suggestFallbackAuth('managed-to-manual', e.message);
    } finally {
      this.setButtonLoading(this.elements.authenticateBtn, false);
      this.showProgress(false);
    }
  }

  async authenticateManual() {
    try {
      this.clearMessages(); // Clear any previous messages
      this.setButtonLoading(this.elements.authenticateBtn, true);
      this.setAuthStatus('Validating...', 'Checking credentials', true);
      this.showProgress(true, 10, 'Validating configuration...');

      // Force managed mode off
      if (this.elements.managedOAuth) {
        this.elements.managedOAuth.checked = false;
        this.updateManagedUi();
        await this.saveConfiguration();
      }

      // Validate required fields for manual mode
      const clientId = this.elements.clientId?.value.trim();
      const clientSecret = this.elements.clientSecret?.value.trim();

      const { sanitized, validation } = this.sanitizeCredentials(clientId, clientSecret);

      if (!validation.valid) {
        const suggestions = validation.errors.map(error => `Fix: ${error}`);
        this.showDetailedError('Invalid Credentials', validation.errors.join(', '), suggestions);
        this.setAuthStatus('Configuration incomplete', 'Invalid credentials provided');
        return;
      }

      this.showProgress(true, 30, 'Starting direct authentication...');
      const res = await this.oauth.startAuthFlow();

      this.showProgress(true, 80, 'Processing authentication...');

      if (res?.success) {
        this.showProgress(true, 100, 'Authentication complete!');
        this.showMessage('Manual authentication successful!', 'success');

        // Wait a bit for tokens to be saved to storage, then update status
        setTimeout(async () => {
          await this.updateAuthStatusWithRetry();
          await this.loadUserInfo();
        }, 500);
      } else {
        this.showMessage('Manual authentication failed', 'error');
        this.setAuthStatus('Authentication failed', 'Check your credentials and try again');
      }
    } catch (e) {
      const suggestions = this.getErrorSuggestions(e.message);
      this.showDetailedError('Manual Authentication Failed', e.message, suggestions);
      this.setAuthStatus('Authentication error', e.message);
    } finally {
      this.setButtonLoading(this.elements.authenticateBtn, false);
      this.showProgress(false);
    }
  }

  async testConnection() {
    try {
      if (this.elements.testConnection) { this.elements.testConnection.disabled = true; this.elements.testConnection.textContent = 'Testing...'; }
      const result = await this.oauth.testConnection();
      if (result?.success) {
        this.showMessage(`Connection successful! Connected as: ${result.user?.name || 'Unknown'}`, 'success');
        await this.updateAuthStatus();
      } else {
        this.showMessage(`Connection failed: ${result?.message || 'Unknown'}`, 'error');
      }
    } catch (e) { this.showMessage(`Connection test failed: ${e.message}`, 'error'); }
    finally { if (this.elements.testConnection) { this.elements.testConnection.disabled = false; this.elements.testConnection.textContent = 'Test Connection'; } }
  }

  async logout() {
    try {
      if (this.elements.logout) this.elements.logout.disabled = true;
      await this.oauth.logout();
      this.showMessage('Logged out successfully', 'success');
      await this.updateAuthStatus();
      this.clearUserInfo();
    } catch (e) { this.showMessage(`Logout failed: ${e.message}`, 'error'); }
    finally { if (this.elements.logout) this.elements.logout.disabled = false; }
  }

  async syncNow() {
    try {
      if (this.elements.syncNow) { this.elements.syncNow.disabled = true; this.elements.syncNow.textContent = 'Syncing...'; }
      const response = await chrome.runtime.sendMessage({ action: 'syncNow' });
      if (response?.success) {
        this.showMessage('Sync completed successfully!', 'success');
        await chrome.storage.sync.set({ lastSyncTime: Date.now() });
        await this.loadSettings();
      } else {
        this.showMessage(`Sync failed: ${response?.error || 'Unknown'}`, 'error');
      }
    } catch (e) { this.showMessage(`Sync failed: ${e.message}`, 'error'); }
    finally { if (this.elements.syncNow) { this.elements.syncNow.disabled = false; this.elements.syncNow.textContent = 'Sync Now'; } }
  }

  async updateAuthStatus() {
    try {
      // Check storage first for immediate feedback
      const { accessToken } = await chrome.storage.sync.get(['accessToken']);

      let authenticated = false;
      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({ action: 'getAuthStatus' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Background script timeout')), 3000))
        ]);
        authenticated = response?.authenticated || false;
      } catch (bgError) {
        console.warn('Background script communication failed, using storage fallback:', bgError);
        // Fallback to storage check
        authenticated = !!accessToken;
      }

      const isAuth = !!authenticated;
      if (isAuth) {
        if (this.elements.statusIndicator) this.elements.statusIndicator.className = 'status-indicator connected';
        if (this.elements.authStatusText) this.elements.authStatusText.textContent = 'Connected';
        if (this.elements.logout) this.elements.logout.classList.remove('hidden');
        if (this.elements.syncNow) this.elements.syncNow.disabled = false;
        await this.loadUserInfo();
      } else {
        if (this.elements.statusIndicator) this.elements.statusIndicator.className = 'status-indicator disconnected';
        if (this.elements.authStatusText) this.elements.authStatusText.textContent = 'Not authenticated';
        if (this.elements.logout) this.elements.logout.classList.add('hidden');
        if (this.elements.syncNow) this.elements.syncNow.disabled = true;
        this.clearUserInfo();
      }
    } catch (e) {
      if (this.elements.statusIndicator) this.elements.statusIndicator.className = 'status-indicator disconnected';
      if (this.elements.authStatusText) this.elements.authStatusText.textContent = 'Status unknown';
    }
  }

  async updateAuthStatusWithRetry(maxRetries = 3, delay = 1000) {
    console.log(`🔐 Starting auth status retry (${maxRetries} attempts)`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔐 Auth status attempt ${i + 1}/${maxRetries}`);

        // Also check storage directly
        const { accessToken } = await chrome.storage.sync.get(['accessToken']);
        console.log(`🔐 Storage check - Token exists: ${!!accessToken}`);

        // Add timeout to background script communication
        let authenticated = false;
        try {
          const response = await Promise.race([
            chrome.runtime.sendMessage({ action: 'getAuthStatus' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Background script timeout')), 5000))
          ]);
          authenticated = response?.authenticated || false;
          console.log(`🔐 Background script response - Authenticated: ${authenticated}`);
        } catch (bgError) {
          console.warn(`🔐 Background script communication failed:`, bgError);
          // Fallback: if we have token in storage, assume authenticated
          if (accessToken) {
            console.log(`🔐 Fallback: Token exists in storage, assuming authenticated`);
            authenticated = true;
          }
        }

        if (authenticated) {
          // Success! Update the UI
          console.log('🔐 Auth status confirmed - updating UI to connected state');
          if (this.elements.statusIndicator) this.elements.statusIndicator.className = 'status-indicator connected';
          if (this.elements.authStatusText) this.elements.authStatusText.textContent = 'Connected';
          if (this.elements.logout) this.elements.logout.classList.remove('hidden');
          if (this.elements.syncNow) this.elements.syncNow.disabled = false;
          return;
        } else if (i === maxRetries - 1) {
          // Final attempt failed
          console.log('🔐 Final attempt failed - token exists but background says not authenticated');
          if (this.elements.statusIndicator) this.elements.statusIndicator.className = 'status-indicator disconnected';
          if (this.elements.authStatusText) this.elements.authStatusText.textContent = 'Connection failed';
          this.showMessage('Authentication completed but connection failed. Please try refreshing the page.', 'warning');
        }
      } catch (e) {
        console.warn(`🔐 Auth status check attempt ${i + 1} failed:`, e);
        if (i === maxRetries - 1) {
          if (this.elements.statusIndicator) this.elements.statusIndicator.className = 'status-indicator disconnected';
          if (this.elements.authStatusText) this.elements.authStatusText.textContent = 'Status unknown';
        }
      }

      // Wait before next retry (except on last attempt)
      if (i < maxRetries - 1) {
        console.log(`🔐 Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async loadUserInfo() {
    try {
      const result = await this.oauth.testConnection();
      if (result?.success && result.user) {
        const userName = result.user.name || 'Unknown';
        const userEmail = result.user.email || '';
        // Update authStatusText to include user info on same line
        if (this.elements.authStatusText) {
          this.elements.authStatusText.innerHTML = `Connected as: <strong>${userName}</strong>${userEmail ? ` (${userEmail})` : ''}`;
        }
        // Hide the separate userInfo section since we're showing it inline
        if (this.elements.userInfo) {
          this.elements.userInfo.classList.add('hidden');
        }
      }
    } catch (_) {}
  }

  clearUserInfo() {
          if (this.elements.userInfo) {
            this.elements.userInfo.classList.add('hidden');
          }    // Also reset authStatusText when clearing user info
    if (this.elements.authStatusText) {
      this.elements.authStatusText.textContent = 'Not authenticated';
    }
  }

  showMessage(message, type = 'info', priority = 'normal') {
    const messageObj = { message, type, priority, id: Date.now() };

    // Clear existing timeout for auto-hide messages
    if (this.currentMessageTimeout) {
      clearTimeout(this.currentMessageTimeout);
      this.currentMessageTimeout = null;
    }

    // High priority messages (errors) clear the queue and show immediately
    if (priority === 'high' || type === 'error') {
      this.messageQueue = [];
      this.displayMessage(messageObj);
      return;
    }

    // Add to queue and process
    this.messageQueue.push(messageObj);
    this.processMessageQueue();
  }

  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    // If no message is currently showing, show the next one
    if (!this.elements.statusMessage || this.elements.statusMessage.classList.contains('hidden')) {
      const nextMessage = this.messageQueue.shift();
      this.displayMessage(nextMessage);
    }
  }

  displayMessage(messageObj) {
    if (!this.elements.statusMessage) return;

    this.elements.statusMessage.textContent = messageObj.message;
    this.elements.statusMessage.className = `status ${messageObj.type}`;
    this.elements.statusMessage.classList.remove('hidden');

    try {
      this.elements.statusMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {}

    // Auto-hide success messages and process next in queue
    if (messageObj.type === 'success' || messageObj.type === 'info') {
      this.currentMessageTimeout = setTimeout(() => {
        if (this.elements.statusMessage) {
          this.elements.statusMessage.classList.add('hidden');
        }
        this.currentMessageTimeout = null;
        // Process next message in queue after hiding current one
        setTimeout(() => this.processMessageQueue(), 100);
      }, messageObj.type === 'success' ? 2000 : 3000);
    } else if (messageObj.type === 'error') {
      // Error messages auto-hide after 8 seconds but user can click to dismiss
      this.currentMessageTimeout = setTimeout(() => {
        if (this.elements.statusMessage) {
          this.elements.statusMessage.classList.add('hidden');
        }
        this.currentMessageTimeout = null;
        setTimeout(() => this.processMessageQueue(), 100);
      }, 8000);
    }
  }

  clearMessages() {
    this.messageQueue = [];
    if (this.currentMessageTimeout) {
      clearTimeout(this.currentMessageTimeout);
      this.currentMessageTimeout = null;
    }
    if (this.elements.statusMessage) {
      this.elements.statusMessage.classList.add('hidden');
    }
  }

  setButtonLoading(button, loading, originalText = null) {
    if (!button) return;
    if (loading) {
      button.disabled = true;
      button.classList.add('loading');
      button.dataset.originalText = button.textContent;
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      button.textContent = originalText || button.dataset.originalText || button.textContent;
    }
  }

  showProgress(show, percentage = 0, details = '') {
    if (this.elements.authProgress) {
      this.elements.authProgress.classList.toggle('hidden', !show);
    }
    if (this.elements.authProgressFill) {
      this.elements.authProgressFill.style.width = `${percentage}%`;
    }
    if (this.elements.statusDetails) {
      this.elements.statusDetails.classList.toggle('hidden', !details);
      if (details) this.elements.statusDetails.textContent = details;
    }
  }

  setAuthStatus(status, details = '', checking = false) {
    if (this.elements.authStatus) {
      this.elements.authStatus.classList.toggle('checking', checking);
    }
    if (this.elements.authStatusText) {
      this.elements.authStatusText.textContent = status;
    }
    this.showProgress(false, 0, details);
  }

  showDetailedError(message, error, suggestions = []) {
    const errorHtml = `
      <div class="error-details">
        <details>
          <summary>❌ ${message}</summary>
          <div style="margin-top: 8px;">
            <strong>Error details:</strong> ${error}
            ${suggestions.length > 0 ? `
              <p><strong>Possible solutions:</strong></p>
              <ul>
                ${suggestions.map(s => `<li>${s}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        </details>
      </div>
    `;

    if (this.elements.statusMessage) {
      this.elements.statusMessage.innerHTML = errorHtml;
      this.elements.statusMessage.className = 'status error';
      this.elements.statusMessage.classList.remove('hidden');
    }
  }

  getErrorSuggestions(error) {
    const errorMsg = error.toLowerCase();

    if (errorMsg.includes('worker returned no access token') || errorMsg.includes('invalid response format')) {
      return [
        'Check if your Cloudflare Worker is properly deployed',
        'Verify RAINDROP_CLIENT_ID and RAINDROP_CLIENT_SECRET are set in Worker environment',
        'Check SESSION_SECRET is configured in Worker',
        'Try using Manual authentication instead',
        'Contact your Worker administrator'
      ];
    }

    if (errorMsg.includes('worker error')) {
      return [
        'Check Worker logs in Cloudflare dashboard',
        'Verify Worker environment variables are correct',
        'Ensure Worker script is deployed and active',
        'Try Manual authentication as fallback'
      ];
    }

    if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      return [
        'Check your internet connection',
        'Verify Cloudflare Worker URL is correct',
        'Try again in a few moments'
      ];
    }

    if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
      return [
        'Check your Client ID and Secret are correct',
        'Ensure your Raindrop.io app is properly configured',
        'Try re-entering your credentials'
      ];
    }

    if (errorMsg.includes('cors') || errorMsg.includes('blocked')) {
      return [
        'Check browser extension permissions',
        'Verify redirect URI matches your app configuration',
        'Try using Managed OAuth instead'
      ];
    }

    return [
      'Check browser console for more details',
      'Try refreshing the page and attempting again',
      'Contact support if the problem persists'
    ];
  }

  async validateTokenSecurity() {
    try {
      const { accessToken, tokenExpiresAt, refreshToken } = await chrome.storage.sync.get(['accessToken', 'tokenExpiresAt', 'refreshToken']);

      if (!accessToken) {
        return { valid: false, reason: 'No access token found' };
      }

      // Check expiration
      if (tokenExpiresAt && Date.now() > tokenExpiresAt) {
        if (refreshToken) {
          try {
            await this.oauth.refreshAccessToken();
            return { valid: true, refreshed: true };
          } catch (e) {
            return { valid: false, reason: 'Token expired and refresh failed', error: e.message };
          }
        } else {
          return { valid: false, reason: 'Token expired, no refresh token available' };
        }
      }

      // Test token validity with API call
      const result = await this.oauth.testConnection();
      if (result?.success) {
        return { valid: true, user: result.user };
      } else {
        return { valid: false, reason: 'Token invalid or API test failed' };
      }
    } catch (error) {
      return { valid: false, reason: 'Token validation error', error: error.message };
    }
  }

  sanitizeCredentials(clientId, clientSecret) {
    // Basic sanitization and validation
    const sanitized = {
      clientId: (clientId || '').trim(),
      clientSecret: (clientSecret || '').trim()
    };

    const validation = {
      valid: true,
      errors: []
    };

    if (!sanitized.clientId) {
      validation.errors.push('Client ID is required');
    } else if (sanitized.clientId.length < 10) {
      validation.errors.push('Client ID seems too short');
    }

    if (!sanitized.clientSecret) {
      validation.errors.push('Client Secret is required');
    } else if (sanitized.clientSecret.length < 20) {
      validation.errors.push('Client Secret seems too short');
    }

    // Check for common patterns that might indicate invalid credentials
    if (sanitized.clientId.includes(' ') || sanitized.clientSecret.includes(' ')) {
      validation.errors.push('Credentials should not contain spaces');
    }

    validation.valid = validation.errors.length === 0;
    return { sanitized, validation };
  }

  startTokenHealthCheck() {
    // Check token health every 10 minutes
    setInterval(async () => {
      const validation = await this.validateTokenSecurity();
      if (!validation.valid && validation.reason !== 'No access token found') {
        console.warn('Token health check failed:', validation.reason);
        this.setAuthStatus('Token issue detected', validation.reason);
      }
    }, 10 * 60 * 1000);

    // Also check configuration health
    this.startConfigHealthCheck();
  }

  startConfigHealthCheck() {
    // Check configuration every 5 minutes
    setInterval(async () => {
      const healthReport = await this.validateConfiguration();
      if (healthReport.warnings.length > 0) {
        console.warn('Configuration warnings:', healthReport.warnings);
      }
    }, 5 * 60 * 1000);
  }

  async validateConfiguration() {
    const config = await chrome.storage.sync.get([
      'managedOAuth', 'managedOAuthBaseUrl', 'clientId', 'clientSecret',
      'redirectUri', 'syncEnabled', 'syncIntervalMinutes'
    ]);

    const healthReport = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    // Check managed OAuth configuration
    if (config.managedOAuth) {
      if (!config.managedOAuthBaseUrl) {
        healthReport.errors.push('Managed OAuth enabled but no base URL configured');
        healthReport.suggestions.push('Set a valid Cloudflare Worker URL');
      } else {
        // Test worker health if in managed mode
        try {
          const workerHealth = await this.checkWorker();
          if (!workerHealth.healthy) {
            healthReport.warnings.push('Cloudflare Worker is not responding correctly');
            healthReport.suggestions.push('Check your Worker deployment and environment variables');
          }
        } catch (e) {
          healthReport.warnings.push('Could not verify Worker health');
        }
      }
    } else {
      // Manual mode - check credentials
      if (!config.clientId || !config.clientSecret) {
        healthReport.errors.push('Manual OAuth mode requires both Client ID and Secret');
        healthReport.suggestions.push('Enter your Raindrop.io app credentials');
      }
    }

    // Check sync configuration
    if (config.syncEnabled) {
      const interval = Number(config.syncIntervalMinutes) || 5;
      if (interval < 1) {
        healthReport.warnings.push('Sync interval is too short (< 1 minute)');
        healthReport.suggestions.push('Set sync interval to at least 1 minute to avoid rate limits');
      } else if (interval > 60) {
        healthReport.warnings.push('Sync interval is very long (> 1 hour)');
        healthReport.suggestions.push('Consider a shorter interval for more frequent updates');
      }
    }

    // Check redirect URI
    if (config.redirectUri && !config.redirectUri.includes('chromiumapp.org')) {
      healthReport.warnings.push('Redirect URI may not be correct for browser extension');
      healthReport.suggestions.push('Use the default extension identity URL for redirect URI');
    }

    healthReport.valid = healthReport.errors.length === 0;
    return healthReport;
  }

  async runFullHealthCheck() {
    const results = {
      configuration: await this.validateConfiguration(),
      token: await this.validateTokenSecurity(),
      worker: null,
      timestamp: Date.now()
    };

    // Check worker if in managed mode
    const { managedOAuth } = await chrome.storage.sync.get(['managedOAuth']);
    if (managedOAuth) {
      results.worker = await this.checkWorker();
    }

    return results;
  }

  async runHealthCheckUI() {
    try {
      this.setButtonLoading(this.elements.runHealthCheck, true);
      if (this.elements.authStateOut) {
        this.elements.authStateOut.textContent = 'Running comprehensive health check...';
      }

      const healthResults = await this.runFullHealthCheck();

      const report = this.formatHealthReport(healthResults);
      if (this.elements.authStateOut) {
        this.elements.authStateOut.innerHTML = report;
      }

      // Show summary message
      const hasErrors = healthResults.configuration.errors.length > 0 ||
                       (healthResults.worker && !healthResults.worker.healthy) ||
                       !healthResults.token.valid;

      if (hasErrors) {
        this.showMessage('Health check found issues. See debug output for details.', 'error');
      } else {
        this.showMessage('Health check passed! All systems are operational.', 'success');
      }

    } catch (error) {
      if (this.elements.authStateOut) {
        this.elements.authStateOut.textContent = `Health check failed: ${error.message}`;
      }
      this.showMessage(`Health check failed: ${error.message}`, 'error');
    } finally {
      this.setButtonLoading(this.elements.runHealthCheck, false);
    }
  }

  formatHealthReport(results) {
    const formatTimestamp = (ts) => new Date(ts).toLocaleString();

    let report = `<div style="font-family: monospace; font-size: 12px;">`;
    report += `<strong>🔍 Health Check Report</strong><br>`;
    report += `Generated: ${formatTimestamp(results.timestamp)}<br><br>`;

    // Configuration
    report += `<strong>📋 Configuration:</strong><br>`;
    if (results.configuration.valid) {
      report += `✅ Valid<br>`;
    } else {
      report += `❌ Issues found<br>`;
      results.configuration.errors.forEach(error => {
        report += `  • Error: ${error}<br>`;
      });
    }
    if (results.configuration.warnings.length > 0) {
      results.configuration.warnings.forEach(warning => {
        report += `  ⚠️ Warning: ${warning}<br>`;
      });
    }
    report += `<br>`;

    // Token
    report += `<strong>🔐 Authentication:</strong><br>`;
    if (results.token.valid) {
      report += `✅ Valid${results.token.refreshed ? ' (refreshed)' : ''}<br>`;
      if (results.token.user) {
        report += `  User: ${results.token.user.name || results.token.user.email || 'Unknown'}<br>`;
      }
    } else {
      report += `❌ ${results.token.reason}<br>`;
      if (results.token.error) {
        report += `  Error: ${results.token.error}<br>`;
      }
    }
    report += `<br>`;

    // Worker (if applicable)
    if (results.worker) {
      report += `<strong>☁️ Cloudflare Worker:</strong><br>`;
      if (results.worker.healthy) {
        report += `✅ Healthy (${results.worker.responseTime}ms)<br>`;
        if (results.worker.version) {
          report += `  Version: ${results.worker.version}<br>`;
        }
      } else {
        report += `❌ Unhealthy<br>`;
        if (results.worker.error) {
          report += `  Error: ${results.worker.error}<br>`;
        }
      }
      report += `<br>`;
    }

    // Suggestions
    const allSuggestions = [
      ...results.configuration.suggestions,
      ...(results.token.suggestions || [])
    ];

    if (allSuggestions.length > 0) {
      report += `<strong>💡 Suggestions:</strong><br>`;
      allSuggestions.forEach(suggestion => {
        report += `  • ${suggestion}<br>`;
      });
    }

    report += `</div>`;
    return report;
  }

  async suggestFallbackAuth(fallbackType, originalError) {
    // Add a delay to not overwhelm the user immediately
    setTimeout(() => {
      const fallbackSuggestions = this.getFallbackSuggestions(fallbackType, originalError);
      if (fallbackSuggestions.length > 0) {
        this.showFallbackOptions(fallbackType, fallbackSuggestions);
      }
    }, 2000);
  }

  getFallbackSuggestions(fallbackType, error) {
    const errorMsg = error.toLowerCase();

    switch (fallbackType) {
      case 'managed-to-manual':
        if (errorMsg.includes('network') || errorMsg.includes('worker') || errorMsg.includes('cloudflare') ||
            errorMsg.includes('no access token') || errorMsg.includes('invalid response format')) {
          return [
            {
              title: 'Try Manual Authentication',
              description: 'Switch to direct authentication with your credentials',
              action: 'switch-to-manual',
              priority: 'high'
            }
          ];
        }
        break;

      case 'manual-to-managed':
        if (errorMsg.includes('cors') || errorMsg.includes('redirect') || errorMsg.includes('identity')) {
          return [
            {
              title: 'Try Managed Authentication',
              description: 'Use Cloudflare Worker for safer authentication',
              action: 'switch-to-managed',
              priority: 'medium'
            }
          ];
        }
        break;
    }

    return [];
  }

  showFallbackOptions(fallbackType, suggestions) {
    const container = document.createElement('div');
    container.className = 'fallback-suggestions';
    container.style.cssText = `
      background: #f0f8ff;
      border: 1px solid #4a90e2;
      border-radius: 6px;
      padding: 12px;
      margin: 12px 0;
      position: relative;
    `;

    const html = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="color: #4a90e2; margin-right: 8px;">💡</span>
        <strong style="color: #2c5aa0;">Alternative Authentication Method</strong>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
                style="margin-left: auto; background: none; border: none; font-size: 18px; cursor: pointer; color: #999;">×</button>
      </div>
      ${suggestions.map(s => `
        <div style="margin: 8px 0;">
          <div style="font-weight: 500; color: #2c5aa0;">${s.title}</div>
          <div style="font-size: 13px; color: #666; margin: 4px 0;">${s.description}</div>
          <button onclick="window.optionsManager.executeFallback('${s.action}')"
                  class="button secondary" style="margin-top: 6px; padding: 6px 12px; font-size: 12px;">
            Try This Method
          </button>
        </div>
      `).join('')}
    `;

    container.innerHTML = html;

    // Insert after status message
    const statusMessage = this.elements.statusMessage;
    if (statusMessage && statusMessage.parentNode) {
      statusMessage.parentNode.insertBefore(container, statusMessage.nextSibling);
    }
  }

  async executeFallback(action) {
    switch (action) {
      case 'switch-to-manual':
        if (this.elements.managedOAuth) {
          this.elements.managedOAuth.checked = false;
          this.updateManagedUi();
          await this.saveConfiguration();
          this.showMessage('Switched to Manual mode. Please enter your Client ID and Secret above, then try authenticating.', 'info');
        }
        break;

      case 'switch-to-managed':
        if (this.elements.managedOAuth) {
          this.elements.managedOAuth.checked = true;
          this.updateManagedUi();
          await this.saveConfiguration();
          this.showMessage('Switched to Managed mode. You can now try Cloudflare authentication.', 'info');
        }
        break;
    }

    // Remove fallback suggestions
    document.querySelectorAll('.fallback-suggestions').forEach(el => el.remove());
  }

  // Local backup management functions
  async refreshLocalBackups() {
    try {
      const btn = this.elements.refreshBackups;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Loading...';
      }

      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);
      const container = this.elements.localBackupsList;

      if (!container) return;

      if (backupKeys.length === 0) {
        container.innerHTML = '<div class="help-text">No local backups found. Backups are created automatically before sync operations.</div>';
        return;
      }

      // Load backup metadata for each key
      const backupMetadata = [];
      for (const key of backupKeys) {
        try {
          const data = await chrome.storage.local.get([key]);
          if (data[key]) {
            backupMetadata.push({
              key,
              timestamp: data[key].timestamp,
              version: data[key].version,
              type: data[key].type
            });
          }
        } catch (error) {
          console.warn('Failed to load backup metadata for key:', key, error);
        }
      }

      // Sort by timestamp (newest first)
      backupMetadata.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Generate backup list HTML
      const backupListHtml = backupMetadata.map(backup => {
        const date = new Date(backup.timestamp).toLocaleString();
        const size = 'Unknown size'; // We could calculate this if needed
        return `
          <div style="border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin: 8px 0; background: #fff;">
            <div style="font-weight: 600; margin-bottom: 4px;">${date}</div>
            <div style="font-size: 14px; color: #6c757d; margin-bottom: 8px;">
              Type: ${backup.type} | Version: ${backup.version}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button data-action="restore" data-backup-key="${backup.key}" class="button secondary local-backup-btn" style="font-size: 14px; padding: 4px 8px;">Restore</button>
              <button data-action="download" data-backup-key="${backup.key}" class="button secondary local-backup-btn" style="font-size: 14px; padding: 4px 8px;">Download</button>
              <button data-action="delete" data-backup-key="${backup.key}" class="button danger local-backup-btn" style="font-size: 14px; padding: 4px 8px;">Delete</button>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="help-text" style="margin-bottom: 12px;">Found ${backupMetadata.length} local backup(s):</div>
        ${backupListHtml}
      `;

      // Add event listeners for backup action buttons
      container.querySelectorAll('.local-backup-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          const backupKey = e.target.dataset.backupKey;

          switch (action) {
            case 'restore':
              this.restoreLocalBackup(backupKey);
              break;
            case 'download':
              this.downloadLocalBackup(backupKey);
              break;
            case 'delete':
              this.deleteLocalBackup(backupKey);
              break;
          }
        });
      });

    } catch (error) {
      console.error('Failed to load local backups:', error);
      if (this.elements.localBackupsList) {
        this.elements.localBackupsList.innerHTML = '<div class="help-text" style="color: #dc3545;">Failed to load backups: ' + error.message + '</div>';
      }
    } finally {
      const btn = this.elements.refreshBackups;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Refresh List';
      }
    }
  }

  async restoreLocalBackup(backupKey) {
    const confirmed = await this.confirmWithText('⚠️ RESTORE FROM LOCAL BACKUP\n\nThis will restore bookmarks from the selected backup. Current bookmarks will be merged with backup contents.\n\nProceed with restore?', {
      confirmText: 'Restore',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;

    try {
      const data = await chrome.storage.local.get([backupKey]);
      if (!data[backupKey]) {
        throw new Error('Backup not found');
      }

      await this.restoreFromBackup(data[backupKey]);
      this.showMessage('Local backup restored successfully', 'success');
    } catch (error) {
      this.showMessage('Local backup restore failed: ' + error.message, 'error');
    }
  }

  async downloadLocalBackup(backupKey) {
    try {
      const data = await chrome.storage.local.get([backupKey]);
      if (!data[backupKey]) {
        throw new Error('Backup not found');
      }

      const backupData = data[backupKey];
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `local-backup-${backupData.timestamp.replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showMessage('Backup downloaded successfully', 'success');
    } catch (error) {
      this.showMessage('Failed to download backup: ' + error.message, 'error');
    }
  }

  async deleteLocalBackup(backupKey) {
    const confirmed = await this.confirmWithText('⚠️ DELETE BACKUP\n\nThis will permanently delete the selected backup from local storage.\n\nThis action cannot be undone. Proceed?', {
      confirmText: 'Delete',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      await chrome.storage.local.remove([backupKey]);

      // Remove from backup keys list
      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);
      const updatedKeys = backupKeys.filter(key => key !== backupKey);
      await chrome.storage.sync.set({ backupKeys: updatedKeys });

      this.showMessage('Backup deleted successfully', 'success');
      // Refresh the list
      await this.refreshLocalBackups();
    } catch (error) {
      this.showMessage('Failed to delete backup: ' + error.message, 'error');
    }
  }

  async clearOldBackups() {
    const confirmed = await this.confirmWithText('⚠️ CLEAR OLD BACKUPS\n\nThis will delete all stored local backups except the most recent one.\n\nThis action cannot be undone. Proceed?', {
      confirmText: 'Clear',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      const btn = this.elements.clearOldBackups;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Clearing...';
      }

      const { backupKeys = [] } = await chrome.storage.sync.get(['backupKeys']);
      if (backupKeys.length <= 1) {
        this.showMessage('No old backups to clear', 'info');
        return;
      }

      // Keep only the most recent backup (last in array)
      const keysToDelete = backupKeys.slice(0, -1);
      const latestKey = backupKeys[backupKeys.length - 1];

      // Delete old backup data
      await chrome.storage.local.remove(keysToDelete);

      // Update backup keys list to only include the latest
      await chrome.storage.sync.set({ backupKeys: [latestKey] });

      this.showMessage(`Cleared ${keysToDelete.length} old backup(s)`, 'success');
      // Refresh the list
      await this.refreshLocalBackups();
    } catch (error) {
      this.showMessage('Failed to clear old backups: ' + error.message, 'error');
    } finally {
      const btn = this.elements.clearOldBackups;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Clear Old Backups';
      }
    }
  }

  // Duplicates tab functions
  async scanDuplicatesInTab() {
    try {
      const btn = this.elements.scanDuplicatesTab;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Scanning...';
      }

      // Update status
      if (this.elements.duplicateStatusText) {
        this.elements.duplicateStatusText.textContent = 'Scanning bookmarks for duplicates...';
      }

      // Get all bookmarks to analyze
      const bookmarkTree = await chrome.bookmarks.getTree();

      // Find duplicate bookmarks and folders
      const duplicateBookmarks = this.findDuplicateBookmarks(bookmarkTree);
      const duplicateFolders = this.findDuplicateFolders(bookmarkTree);

      // Store results for later use
      this.duplicateAnalysisTab = {
        bookmarks: duplicateBookmarks,
        folders: duplicateFolders,
        scanned: Date.now()
      };

      // Display results
      this.displayDuplicateResultsInTab(duplicateBookmarks, duplicateFolders);

      // Update status
      if (this.elements.duplicateStatusText) {
        this.elements.duplicateStatusText.textContent = `Scan completed: ${duplicateBookmarks.length} duplicate bookmark groups, ${duplicateFolders.length} duplicate folder groups found`;
      }

      // Enable auto-fix button if duplicates found
      if (this.elements.autoFixDuplicates) {
        this.elements.autoFixDuplicates.disabled = (duplicateBookmarks.length === 0 && duplicateFolders.length === 0);
      }

    } catch (error) {
      console.error('Duplicate scan failed:', error);
      if (this.elements.duplicateStatusText) {
        this.elements.duplicateStatusText.textContent = 'Scan failed: ' + error.message;
      }
    } finally {
      const btn = this.elements.scanDuplicatesTab;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Scan for Duplicates';
      }
    }
  }

  displayDuplicateResultsInTab(duplicateBookmarks, duplicateFolders) {
    // Show results container
    if (this.elements.duplicateResultsTab) {
      this.elements.duplicateResultsTab.style.display = 'block';
    }

    // Update counts
    if (this.elements.duplicateBookmarkCount) {
      this.elements.duplicateBookmarkCount.textContent = duplicateBookmarks.length;
    }
    if (this.elements.duplicateFolderCount) {
      this.elements.duplicateFolderCount.textContent = duplicateFolders.length;
    }

    // Display duplicate bookmarks
    if (this.elements.duplicateBookmarksList) {
      if (duplicateBookmarks.length === 0) {
        this.elements.duplicateBookmarksList.innerHTML = '<div style="padding: 12px; text-align: center; color: #6c757d;">No duplicate bookmarks found</div>';
      } else {
        const bookmarkHtml = duplicateBookmarks.map(group => {
          const itemsHtml = group.bookmarks.map((bookmark, index) => `
            <div class="duplicate-item">
              <input type="checkbox" data-type="bookmark" data-id="${bookmark.id}" ${index > 0 ? 'checked' : ''}>
              <div style="flex: 1;">
                <div style="font-weight: 500;">${this.escapeHtml(bookmark.title)}</div>
                <div class="duplicate-url">${this.escapeHtml(bookmark.url)}</div>
                <div class="duplicate-location">📁 ${this.escapeHtml(this.getBookmarkPath(bookmark))}</div>
              </div>
              ${index === 0 ? '<span style="color: #28a745; font-size: 12px;">KEEP</span>' : '<span style="color: #dc3545; font-size: 12px;">REMOVE</span>'}
            </div>
          `).join('');

          return `
            <div class="duplicate-group">
              <div style="font-weight: 600; margin-bottom: 8px;">📄 ${group.bookmarks.length} duplicates of "${this.escapeHtml(group.bookmarks[0].title)}"</div>
              ${itemsHtml}
            </div>
          `;
        }).join('');

        this.elements.duplicateBookmarksList.innerHTML = bookmarkHtml;
      }
    }

    // Display duplicate folders
    if (this.elements.duplicateFoldersList) {
      if (duplicateFolders.length === 0) {
        this.elements.duplicateFoldersList.innerHTML = '<div style="padding: 12px; text-align: center; color: #6c757d;">No duplicate folders found</div>';
      } else {
        const folderHtml = duplicateFolders.map(group => {
          const itemsHtml = group.folders.map((folder, index) => `
            <div class="duplicate-item">
              <input type="checkbox" data-type="folder" data-id="${folder.id}" ${index > 0 ? 'checked' : ''}>
              <div style="flex: 1;">
                <div style="font-weight: 500;">📁 ${this.escapeHtml(folder.title)}</div>
                <div class="duplicate-location">📁 ${this.escapeHtml(this.getBookmarkPath(folder))}</div>
              </div>
              ${index === 0 ? '<span style="color: #28a745; font-size: 12px;">KEEP</span>' : '<span style="color: #dc3545; font-size: 12px;">MERGE</span>'}
            </div>
          `).join('');

          return `
            <div class="duplicate-group">
              <div style="font-weight: 600; margin-bottom: 8px;">📁 ${group.folders.length} duplicates of "${this.escapeHtml(group.folders[0].title)}"</div>
              ${itemsHtml}
            </div>
          `;
        }).join('');

        this.elements.duplicateFoldersList.innerHTML = folderHtml;
      }
    }

    // Update remove button state
    this.updateRemoveButtonState();
  }

  getBookmarkPath(bookmark) {
    // Get the path of a bookmark for display
    try {
      if (bookmark.parentId === '1') return 'Bookmarks Bar';
      if (bookmark.parentId === '2') return 'Other Bookmarks';
      if (bookmark.parentId === '3') return 'Mobile Bookmarks';
      return 'Unknown Location';
    } catch (error) {
      return 'Unknown Location';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateRemoveButtonState() {
    const checkboxes = document.querySelectorAll('#duplicateResultsTab input[type="checkbox"]:checked');
    if (this.elements.removeSelectedDuplicates) {
      this.elements.removeSelectedDuplicates.disabled = checkboxes.length === 0;
    }
  }

  selectAllDuplicates() {
    const checkboxes = document.querySelectorAll('#duplicateResultsTab input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    this.updateRemoveButtonState();
  }

  selectNoneDuplicates() {
    const checkboxes = document.querySelectorAll('#duplicateResultsTab input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    this.updateRemoveButtonState();
  }

  async autoFixAllDuplicates() {
    if (!this.duplicateAnalysisTab) {
      this.showMessage('Please scan for duplicates first', 'error');
      return;
    }

    const confirmed = await this.confirmWithText('⚠️ AUTO-FIX ALL DUPLICATES\n\nThis will automatically remove all duplicate bookmarks and merge duplicate folders.\n\nA backup will be created automatically. Proceed?', {
      confirmText: 'Clean Duplicates',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      const btn = this.elements.autoFixDuplicates;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Fixing...';
      }

      // Create backup if enabled
      if (this.elements.createBackupBeforeRemoval?.checked) {
        await this.createAutoBackup();
      }

      let removedCount = 0;
      let mergedCount = 0;

      // Remove duplicate bookmarks
      for (const group of this.duplicateAnalysisTab.bookmarks) {
        const toRemove = group.bookmarks.slice(1); // Keep first, remove others
        for (const bookmark of toRemove) {
          try {
            await chrome.bookmarks.remove(bookmark.id);
            removedCount++;
          } catch (error) {
            console.warn('Failed to remove duplicate bookmark:', bookmark, error);
          }
        }
      }

      // Merge duplicate folders
      for (const group of this.duplicateAnalysisTab.folders) {
        const keepFolder = group.folders[0];
        const mergeFolders = group.folders.slice(1);

        for (const folder of mergeFolders) {
          try {
            // Move all children from duplicate folder to keep folder
            const children = await chrome.bookmarks.getChildren(folder.id);
            for (const child of children) {
              await chrome.bookmarks.move(child.id, { parentId: keepFolder.id });
            }
            // Remove the now-empty folder
            await chrome.bookmarks.removeTree(folder.id);
            mergedCount++;
          } catch (error) {
            console.warn('Failed to merge duplicate folder:', folder, error);
          }
        }
      }

      this.showMessage(`Auto-fix completed: ${removedCount} bookmarks removed, ${mergedCount} folders merged`, 'success');

      // Refresh the view
      await this.refreshDuplicateView();

    } catch (error) {
      this.showMessage('Auto-fix failed: ' + error.message, 'error');
    } finally {
      const btn = this.elements.autoFixDuplicates;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Auto-Fix All Duplicates';
      }
    }
  }

  async removeSelectedDuplicates() {
    const checkboxes = document.querySelectorAll('#duplicateResultsTab input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
      this.showMessage('No duplicates selected', 'error');
      return;
    }

    const confirmed = await this.confirmWithText(`⚠️ REMOVE SELECTED DUPLICATES\n\nThis will remove ${checkboxes.length} selected duplicate items.\n\nThis action cannot be undone. Proceed?`, {
      confirmText: 'Remove',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      const btn = this.elements.removeSelectedDuplicates;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Removing...';
      }

      // Create backup if enabled
      if (this.elements.createBackupBeforeRemoval?.checked) {
        await this.createAutoBackup();
      }

      let removedCount = 0;

      for (const checkbox of checkboxes) {
        const itemId = checkbox.dataset.id;
        const itemType = checkbox.dataset.type;

        try {
          if (itemType === 'bookmark') {
            await chrome.bookmarks.remove(itemId);
          } else if (itemType === 'folder') {
            await chrome.bookmarks.removeTree(itemId);
          }
          removedCount++;
        } catch (error) {
          console.warn('Failed to remove item:', itemId, error);
        }
      }

      this.showMessage(`Removed ${removedCount} duplicate items`, 'success');

      // Refresh the view
      await this.refreshDuplicateView();

    } catch (error) {
      this.showMessage('Remove failed: ' + error.message, 'error');
    } finally {
      const btn = this.elements.removeSelectedDuplicates;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Remove Selected';
      }
    }
  }

  async refreshDuplicateView() {
    // Clear current results
    this.duplicateAnalysisTab = null;

    if (this.elements.duplicateResultsTab) {
      this.elements.duplicateResultsTab.style.display = 'none';
    }

    if (this.elements.duplicateStatusText) {
      this.elements.duplicateStatusText.textContent = 'Click "Scan for Duplicates" to analyze your bookmarks';
    }

    if (this.elements.autoFixDuplicates) {
      this.elements.autoFixDuplicates.disabled = true;
    }
  }

  // Mandatory backup system - ensures user has downloaded a backup before using features
  async checkMandatoryBackup() {
    try {
      // Check if user has already downloaded the mandatory backup
      const { mandatoryBackupDownloaded, mandatoryBackupCreated } = await chrome.storage.sync.get(['mandatoryBackupDownloaded', 'mandatoryBackupCreated']);

      if (mandatoryBackupDownloaded) {
        // User has already downloaded backup, enable all features
        this.enableAllFeatures();
        return;
      }

      // Create mandatory backup if not created yet
      if (!mandatoryBackupCreated) {
        await this.createMandatoryBackup();
      }

      // Disable all features until backup is downloaded
      this.disableAllFeatures();
      this.showMandatoryBackupNotice();

    } catch (error) {
      console.error('Mandatory backup check failed:', error);
      // On error, still show backup notice for safety
      this.disableAllFeatures();
      this.showMandatoryBackupNotice();
    }
  }

  async createMandatoryBackup() {
    try {
      console.log('Creating mandatory startup backup...');

      const bookmarkTree = await chrome.bookmarks.getTree();
      const timestamp = new Date().toISOString();
      const backupData = {
        version: '1.2.0',
        timestamp: timestamp,
        type: 'mandatory-startup',
        bookmarks: bookmarkTree
      };

      // Store in local storage
      const backupKey = `mandatory_backup_${timestamp.replace(/[:.]/g, '-')}`;
      await chrome.storage.local.set({ [backupKey]: backupData });

      // Mark as created
      await chrome.storage.sync.set({
        mandatoryBackupCreated: true,
        mandatoryBackupKey: backupKey,
        mandatoryBackupTimestamp: timestamp
      });

      console.log('Mandatory backup created successfully');

    } catch (error) {
      console.error('Failed to create mandatory backup:', error);
      throw error;
    }
  }

  disableAllFeatures() {
    // Disable all critical buttons and inputs
    const criticalSelectors = [
      'button[id*="sync"]',
      'button[id*="Sync"]',
      'button[id*="duplicate"]',
      'button[id*="Duplicate"]',
      'button[id*="clear"]',
      'button[id*="Clear"]',
      'button[id*="remove"]',
      'button[id*="Remove"]',
      'button[id*="delete"]',
      'button[id*="Delete"]',
      'button[id*="import"]',
      'button[id*="Import"]',
      'button[id*="merge"]',
      'button[id*="Merge"]',
      'button[id*="cleanup"]',
      'button[id*="Cleanup"]',
      'button[id*="emergency"]',
      'button[id*="Emergency"]',
      '#authenticateBtn',
      '#exportBookmarks'
    ];

    criticalSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.disabled = true;
        element.style.opacity = '0.5';
        element.title = 'Please download mandatory backup first';
      });
    });

    // Disable navigation to danger zones
    document.querySelectorAll('[data-tab="danger"], [data-tab="duplicates"], [data-tab="sync"]').forEach(element => {
      element.disabled = true;
      element.style.opacity = '0.5';
    });

    console.log('All features disabled until mandatory backup download');
  }

  enableAllFeatures() {
    // Re-enable all previously disabled elements
    document.querySelectorAll('button[disabled], a[disabled], input[disabled]').forEach(element => {
      if (element.title === 'Please download mandatory backup first') {
        element.disabled = false;
        element.style.opacity = '';
        element.title = '';
      }
    });

    document.querySelectorAll('[data-tab]').forEach(element => {
      element.disabled = false;
      element.style.opacity = '';
    });

    console.log('All features enabled - backup downloaded');
  }

  showMandatoryBackupNotice() {
    // Create and show mandatory backup notice
    const existingNotice = document.getElementById('mandatoryBackupNotice');
    if (existingNotice) {
      existingNotice.remove();
    }

    const notice = document.createElement('div');
    notice.id = 'mandatoryBackupNotice';
    notice.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    notice.innerHTML = `
      <div style="background: white; padding: 32px; border-radius: 12px; max-width: 500px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
        <h2 style="color: #dc3545; margin: 0 0 16px 0;">🛡️ Mandatory Backup Required</h2>
        <p style="margin: 0 0 20px 0; line-height: 1.6;">
          <strong>For your safety, a backup of your bookmarks has been created automatically.</strong><br><br>
          You must download this backup to your computer before using any features of this extension.<br><br>
          This ensures you can always restore your bookmarks if something goes wrong.
        </p>
        <button id="downloadMandatoryBackup" class="button" style="background: #dc3545; color: white; margin-right: 12px;">
          📥 Download Backup Now
        </button>
        <div style="margin-top: 16px; font-size: 14px; color: #6c757d;">
          ⚠️ All extension features are disabled until backup is downloaded
        </div>
        <div style="margin-top: 12px;">
          <button id="resetBackupRequirement" style="background: none; border: none; color: #6c757d; font-size: 12px; text-decoration: underline; cursor: pointer;">
            [Debug] Reset backup requirement
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(notice);

    // Add download handler
    document.getElementById('downloadMandatoryBackup').addEventListener('click', () => {
      this.downloadMandatoryBackup();
    });

    // Add debug reset handler
    document.getElementById('resetBackupRequirement').addEventListener('click', () => {
      this.resetBackupRequirement();
    });
  }

  async downloadMandatoryBackup() {
    try {
      const { mandatoryBackupKey } = await chrome.storage.sync.get(['mandatoryBackupKey']);

      if (!mandatoryBackupKey) {
        throw new Error('Mandatory backup not found');
      }

      const data = await chrome.storage.local.get([mandatoryBackupKey]);
      if (!data[mandatoryBackupKey]) {
        throw new Error('Backup data not found');
      }

      const backupData = data[mandatoryBackupKey];
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MANDATORY-BACKUP-${backupData.timestamp.replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark as downloaded
      await chrome.storage.sync.set({ mandatoryBackupDownloaded: true });

      // Remove notice and enable features
      const notice = document.getElementById('mandatoryBackupNotice');
      if (notice) {
        notice.remove();
      }

      this.enableAllFeatures();
      this.showMessage('✅ Mandatory backup downloaded! All features are now enabled.', 'success');

    } catch (error) {
      console.error('Failed to download mandatory backup:', error);
      this.showMessage('Failed to download backup: ' + error.message, 'error');
    }
  }

  async resetBackupRequirement() {
    // Debug function to reset backup requirement
    const confirmed = await this.confirmWithText('⚠️ DEBUG: Reset backup requirement?\n\nThis will clear the backup requirement and enable all features without downloading.\n\nOnly use for testing!', {
      confirmText: 'Reset',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      await chrome.storage.sync.remove(['mandatoryBackupDownloaded', 'mandatoryBackupCreated', 'mandatoryBackupKey', 'mandatoryBackupTimestamp']);

      const notice = document.getElementById('mandatoryBackupNotice');
      if (notice) {
        notice.remove();
      }

      this.enableAllFeatures();
      this.showMessage('🔧 DEBUG: Backup requirement reset. All features enabled.', 'info');

    } catch (error) {
      console.error('Failed to reset backup requirement:', error);
      this.showMessage('Failed to reset: ' + error.message, 'error');
    }
  }

  applyNotificationStyle() {
    const isModern = this.elements.modernNotification?.checked;
    const isMinimal = this.elements.minimalNotification?.checked;

    if (isModern) {
      // Show modern, hide minimal
      if (this.elements.betaNotificationBar) {
        this.elements.betaNotificationBar.style.display = 'flex';
      }
      if (this.elements.betaNotificationBarAlt) {
        this.elements.betaNotificationBarAlt.style.display = 'none';
      }
      chrome.storage.sync.set({ notificationStyle: 'modern' });
      this.showMessage('Modern notification style applied', 'success');
    } else if (isMinimal) {
      // Show minimal, hide modern
      if (this.elements.betaNotificationBar) {
        this.elements.betaNotificationBar.style.display = 'none';
      }
      if (this.elements.betaNotificationBarAlt) {
        this.elements.betaNotificationBarAlt.style.display = 'flex';
      }
      chrome.storage.sync.set({ notificationStyle: 'minimal' });
      this.showMessage('Minimal notification style applied', 'success');
    }

    // Remove hidden class if notification is shown again
    document.body.classList.remove('notification-hidden');

    // Update layout offset based on current bar
    this.updateNotificationOffset();
  }

  async previewNotificationStyle() {
    const isModern = this.elements.modernNotification?.checked;

    // Temporarily show the selected style for 3 seconds
    if (isModern) {
      if (this.elements.betaNotificationBar) {
        this.elements.betaNotificationBar.style.display = 'flex';
        this.updateNotificationOffset();
        setTimeout(() => {
          if (this.elements.betaNotificationBar) {
            this.elements.betaNotificationBar.style.display = 'none';
          }
          this.updateNotificationOffset();
        }, 3000);
      }
    } else {
      if (this.elements.betaNotificationBarAlt) {
        this.elements.betaNotificationBarAlt.style.display = 'flex';
        this.updateNotificationOffset();
        setTimeout(() => {
          if (this.elements.betaNotificationBarAlt) {
            this.elements.betaNotificationBarAlt.style.display = 'none';
          }
          this.updateNotificationOffset();
        }, 3000);
      }
    }

    this.showMessage('Preview shown for 3 seconds', 'info');
  }

  async loadNotificationStyle() {
    try {
      const { notificationStyle = 'modern' } = await chrome.storage.sync.get(['notificationStyle']);

      if (notificationStyle === 'minimal') {
        if (this.elements.minimalNotification) {
          this.elements.minimalNotification.checked = true;
        }
        if (this.elements.betaNotificationBar) {
          this.elements.betaNotificationBar.style.display = 'none';
        }
        if (this.elements.betaNotificationBarAlt) {
          this.elements.betaNotificationBarAlt.style.display = 'flex';
        }
      } else {
        if (this.elements.modernNotification) {
          this.elements.modernNotification.checked = true;
        }
        if (this.elements.betaNotificationBar) {
          this.elements.betaNotificationBar.style.display = 'flex';
        }
        if (this.elements.betaNotificationBarAlt) {
          this.elements.betaNotificationBarAlt.style.display = 'none';
        }
      }

      // Ensure layout reflects the current notification
      this.updateNotificationOffset();
    } catch (error) {
      console.warn('Failed to load notification style preference:', error);
    }
  }

  // --- Theme selection ---
  applyTheme() {
    const theme = this.elements.themeSelect?.value || 'default';
    document.documentElement.setAttribute('data-theme', theme);
    chrome.storage.sync.set({ colorTheme: theme }).catch(() => {});
    this.updateThemePreview();
    this.showMessage(`Theme applied: ${theme}`, 'success');
  }

  async loadTheme() {
    try {
      const { colorTheme = 'default' } = await chrome.storage.sync.get(['colorTheme']);
      document.documentElement.setAttribute('data-theme', colorTheme);
      if (this.elements.themeSelect) this.elements.themeSelect.value = colorTheme;
      this.updateThemePreview();
    } catch (_) {
      // ignore
    }
  }

  updateThemePreview() {
    const el = this.elements.themePreview; if (!el) return;
    const id = this.elements.themeSelect?.value || 'slate';
    const palettes = {
      slate: ['#64748b', '#475569', '#334155'],
      charcoal: ['#52525b', '#3f3f46', '#27272a'],
      ocean: ['#5b7c99', '#456073', '#34495e']
    };
    const arr = palettes[id] || palettes.slate;
    el.textContent = '';
    arr.forEach(c => {
      const span = document.createElement('span');
      span.style.cssText = `display:inline-block;width:16px;height:16px;border-radius:3px;background:${c};border:1px solid rgba(0,0,0,0.1);`;
      el.appendChild(span);
    });
  }

  // Color mode (dark/light)
  async loadColorMode() {
    try {
      const { colorMode = 'light' } = await chrome.storage.sync.get(['colorMode']);
      const isDark = colorMode === 'dark';
      document.documentElement.setAttribute('data-color-mode', isDark ? 'dark' : 'light');
      if (this.elements.darkModeToggle) this.elements.darkModeToggle.checked = isDark;
    } catch (_) {}
  }

  toggleColorMode() {
    const isDark = !!this.elements.darkModeToggle?.checked;
    document.documentElement.setAttribute('data-color-mode', isDark ? 'dark' : 'light');
    chrome.storage.sync.set({ colorMode: isDark ? 'dark' : 'light' }).catch(() => {});
  }

  // (removed) Auto-confirm handling was removed as per request.

  // --- Notification offset helpers ---
  setNotificationHeight(px) {
    const h = Math.max(0, Math.round(px || 0));
    document.documentElement.style.setProperty('--notification-h', `${h}px`);
  }

  updateNotificationOffset() {
    // Decide which bar is visible and measure its height
    const bars = [this.elements.betaNotificationBar, this.elements.betaNotificationBarAlt].filter(Boolean);
    let height = 0;
    for (const bar of bars) {
      if (!bar) continue;
      const style = window.getComputedStyle(bar);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        const rect = bar.getBoundingClientRect();
        height = Math.max(height, rect.height);
      }
    }
    this.setNotificationHeight(height);
  }

  // Security: Safe DOM manipulation utilities
  setHelpText(element, text) {
    if (!element) return;
    element.textContent = '';
    const div = document.createElement('div');
    div.className = 'help-text';
    div.textContent = text;
    element.appendChild(div);
  }

  clearAndSetText(element, text, className = '') {
    if (!element) return;
    element.textContent = '';
    if (text) {
      if (className) {
        const wrapper = document.createElement('div');
        wrapper.className = className;
        wrapper.textContent = text;
        element.appendChild(wrapper);
      } else {
        element.textContent = text;
      }
    }
  }

  initSidebarCollapse() {
    // Load saved collapse states from localStorage
    const savedStates = JSON.parse(localStorage.getItem('sidebarCollapseStates') || '{}');

    // Get all collapsible sections
    const collapsibleTitles = document.querySelectorAll('.sidebar-title.collapsible');

    collapsibleTitles.forEach(title => {
      const sectionName = title.dataset.section;
      const linksContainer = document.querySelector(`[data-links="${sectionName}"]`);

      if (!linksContainer) return;

      // Apply saved state (default: expanded)
      if (savedStates[sectionName] === 'collapsed') {
        title.classList.add('collapsed');
        linksContainer.classList.add('collapsed');
      }

      // Add click handler
      title.addEventListener('click', () => {
        const isCollapsed = title.classList.toggle('collapsed');
        linksContainer.classList.toggle('collapsed');

        // Save state
        savedStates[sectionName] = isCollapsed ? 'collapsed' : 'expanded';
        localStorage.setItem('sidebarCollapseStates', JSON.stringify(savedStates));
      });
    });
  }

  async checkFirstRun() {
    // Check if user has seen welcome screen
    const { hasSeenWelcome } = await chrome.storage.sync.get(['hasSeenWelcome']);

    if (!hasSeenWelcome) {
      this.showWelcomeScreen();
    }
  }

  showWelcomeScreen() {
    const overlay = document.getElementById('welcomeOverlay');
    const startBtn = document.getElementById('welcomeStart');
    const skipBtn = document.getElementById('welcomeSkip');

    if (!overlay) return;

    // Show the overlay
    overlay.classList.add('show');

    // Handle "Let's Get Started" button
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        await chrome.storage.sync.set({ hasSeenWelcome: true });
        overlay.classList.remove('show');
        // Navigate to Connect tab
        this.showTab('api');
      });
    }

    // Handle "Skip Tour" button
    if (skipBtn) {
      skipBtn.addEventListener('click', async () => {
        await chrome.storage.sync.set({ hasSeenWelcome: true });
        overlay.classList.remove('show');
      });
    }
  }

  async resetToDefaults() {
    const confirmed = await this.confirmWithText(
      '🔄 Reset to Default Settings',
      'This will restore all settings to their recommended defaults:\n\n• Sync interval: 15 minutes\n• Sync mode: Additions only (safe)\n• Auto backup: Enabled\n• Managed OAuth: Enabled\n\nYour bookmarks and Raindrop connection will not be affected.\n\nContinue?',
      { confirmText: 'Reset', confirmVariant: 'primary' }
    );

    if (!confirmed) return;

    try {
      // Get default config from background script
      const SMART_DEFAULTS = {
        syncEnabled: false, // User must configure settings first
        syncIntervalMinutes: 15,
        twoWayMode: 'additions_only',
        targetFolderId: '1',
        useSubfolder: false,
      // OAuth
      managedOAuth: true,
      managedOAuthBaseUrl: 'https://rdoauth.daiquiri.dev',
      clientId: '',
        collectionMode: 'parentOnly',
        collectionsSort: 'alpha_asc',
        bookmarksSort: 'created_desc',
        rateLimitRpm: 60,
        autoBackupEnabled: true,
        createBackupBeforeSync: true
      };

      // Keep authentication tokens and user data
      const { accessToken, refreshToken, tokenExpiresAt, clientId, clientSecret } =
        await chrome.storage.sync.get(['accessToken', 'refreshToken', 'tokenExpiresAt', 'clientId', 'clientSecret']);

      // Apply defaults
      await chrome.storage.sync.set(SMART_DEFAULTS);

      // Restore auth if it existed
      if (accessToken) {
        await chrome.storage.sync.set({ accessToken, refreshToken, tokenExpiresAt });
      }
      if (clientId) {
        await chrome.storage.sync.set({ clientId, clientSecret });
      }

      this.showMessage('✅ Settings reset to defaults successfully!', 'success');

      // Reload the page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      this.showMessage(`❌ Reset failed: ${error.message}`, 'error');
    }
  }

  showCleanupResults(operationName, results) {
    const { total, success, failed, message, details } = results;

    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    const status = failed === 0 ? 'success' : (success > 0 ? 'warning' : 'error');
    const icon = failed === 0 ? '✅' : (success > 0 ? '⚠️' : '❌');

    let resultHTML = `
      <div style="margin: 20px 0; padding: 16px; background: ${status === 'success' ? '#d4edda' : status === 'warning' ? '#fff3cd' : '#f8d7da'};
                  border: 1px solid ${status === 'success' ? '#c3e6cb' : status === 'warning' ? '#ffeaa7' : '#f5c6cb'};
                  border-radius: 6px;">
        <h4 style="margin: 0 0 12px 0; color: ${status === 'success' ? '#155724' : status === 'warning' ? '#856404' : '#721c24'};">
          ${icon} ${operationName} Complete
        </h4>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 12px;">
          <div style="background: white; padding: 8px; border-radius: 4px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #333;">${total}</div>
            <div style="font-size: 11px; color: #666; text-transform: uppercase;">Total</div>
          </div>
          <div style="background: white; padding: 8px; border-radius: 4px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #28a745;">${success}</div>
            <div style="font-size: 11px; color: #666; text-transform: uppercase;">Success</div>
          </div>
          ${failed > 0 ? `
            <div style="background: white; padding: 8px; border-radius: 4px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #dc3545;">${failed}</div>
              <div style="font-size: 11px; color: #666; text-transform: uppercase;">Failed</div>
            </div>
          ` : ''}
          <div style="background: white; padding: 8px; border-radius: 4px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #007bff;">${successRate}%</div>
            <div style="font-size: 11px; color: #666; text-transform: uppercase;">Success Rate</div>
          </div>
        </div>

        ${message ? `<div style="color: #333; font-size: 13px; margin-bottom: 8px;">${message}</div>` : ''}
        ${details ? `<div style="color: #666; font-size: 12px; font-style: italic;">${details}</div>` : ''}
      </div>
    `;

    const resultsContainer = this.elements.duplicateResults;
    if (resultsContainer) {
      resultsContainer.innerHTML = resultHTML;
      this.elements.duplicatePreview.classList.remove('hidden');

      // Auto-hide after 10 seconds
      setTimeout(() => {
        if (this.elements.duplicatePreview) {
          this.elements.duplicatePreview.classList.add('hidden');
        }
      }, 10000);
    }

    // Also show a quick message
    if (failed === 0) {
      this.showMessage(`${icon} ${operationName}: ${success}/${total} completed successfully!`, status);
    } else {
      this.showMessage(`${icon} ${operationName}: ${success} succeeded, ${failed} failed`, status);
    }
  }
}

// === AI User Interface ===
class AIUserInterface {
  constructor() {
    this.aiManager = new AIManager();
    this.currentResults = null;
    this.init();
  }

  async init() {
    // Initialize AI manager
    await this.aiManager.initialize();

    // Setup event listeners
    this.setupProviderSelection();
    this.setupConfigSave();
    this.setupConnectionTest();
    this.setupAnalysis();
    this.setupResultsActions();

    // Load saved config if exists
    await this.loadSavedConfig();
  }

  setupProviderSelection() {
    const providerSelect = document.getElementById('aiProvider');
    const configSection = document.getElementById('aiProviderConfig');
    const toolsSection = document.getElementById('aiToolsSection');
    const apiKeyLink = document.getElementById('apiKeyLink');
    const modelSelect = document.getElementById('aiModel');

    if (!providerSelect) return;

    providerSelect.addEventListener('change', async (e) => {
      const provider = e.target.value;

      if (!provider) {
        configSection.classList.add('hidden');
        toolsSection.classList.add('hidden');
        return;
      }

      configSection.classList.remove('hidden');

      // Update provider info
      const info = AIManager.getProviderInfo(provider);
      if (info) {
        apiKeyLink.href = info.website;
        apiKeyLink.textContent = info.name;

        // Show API key format hint
        const formatSpan = document.getElementById('apiKeyFormat');
        const formatText = document.getElementById('apiKeyFormatText');
        if (formatSpan && formatText && info.keyFormat) {
          formatText.textContent = info.keyFormat;
          formatSpan.style.display = 'inline';
        }

        // Populate models
        modelSelect.innerHTML = '<option value="">-- Select Model --</option>';
        info.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.value;
          option.textContent = model.label;
          modelSelect.appendChild(option);
        });
      }

      // Load saved config for this provider
      const { config } = await this.aiManager.getConfig(provider);
      if (config) {
        // Fill in saved API key and model
        const apiKeyInput = document.getElementById('aiApiKey');
        if (apiKeyInput && config.apiKey) {
          apiKeyInput.value = config.apiKey;
        }

        // Set model after a small delay to ensure options are populated
        setTimeout(() => {
          if (modelSelect && config.model) {
            modelSelect.value = config.model;
          }
        }, 50);

        // Show tools section if config exists
        document.getElementById('aiToolsSection').classList.remove('hidden');
      } else {
        // Clear fields if no saved config
        const apiKeyInput = document.getElementById('aiApiKey');
        if (apiKeyInput) {
          apiKeyInput.value = '';
        }
        document.getElementById('aiToolsSection').classList.add('hidden');
      }
    });

    // Toggle API key visibility
    const toggleBtn = document.getElementById('toggleApiKey');
    const apiKeyInput = document.getElementById('aiApiKey');

    if (toggleBtn && apiKeyInput) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        apiKeyInput.type = isPassword ? 'text' : 'password';
        toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
      });
    }
  }

  setupConfigSave() {
    const saveBtn = document.getElementById('saveAiConfig');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      const provider = document.getElementById('aiProvider').value;
      const apiKey = document.getElementById('aiApiKey').value;
      const model = document.getElementById('aiModel').value;

      if (!provider || !apiKey || !model) {
        this.showStatus('Please fill in all fields', 'error');
        return;
      }

      // Validate API key format
      const validation = AIManager.validateApiKey(provider, apiKey);
      if (!validation.valid) {
        this.showStatus(`Invalid API key: ${validation.error}`, 'error');
        return;
      }

      try {
        await this.aiManager.saveConfig(provider, apiKey, model);
        this.showStatus('Configuration saved successfully!', 'success');
        document.getElementById('aiToolsSection').classList.remove('hidden');

        // Update saved providers hint
        const allConfigs = await this.aiManager.getAllConfigs();
        const savedProviders = Object.keys(allConfigs);
        const hint = document.getElementById('savedProvidersHint');
        if (hint && savedProviders.length > 0) {
          const providerNames = savedProviders.map(p => {
            const info = AIManager.getProviderInfo(p);
            return info ? info.name.split(' ')[0] : p;
          }).join(', ');
          hint.textContent = `✓ Saved: ${providerNames}`;
          hint.style.display = 'inline';
        }
      } catch (error) {
        this.showStatus(`Failed to save: ${error.message}`, 'error');
      }
    });
  }

  setupConnectionTest() {
    const testBtn = document.getElementById('testAiConnection');
    if (!testBtn) return;

    testBtn.addEventListener('click', async () => {
      const provider = document.getElementById('aiProvider').value;
      const apiKey = document.getElementById('aiApiKey').value;
      const model = document.getElementById('aiModel').value;

      if (!provider || !apiKey || !model) {
        this.showStatus('Please configure all settings first', 'error');
        return;
      }

      // Validate API key format
      const validation = AIManager.validateApiKey(provider, apiKey);
      if (!validation.valid) {
        this.showStatus(`Invalid API key: ${validation.error}`, 'error');
        return;
      }

      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';

      try {
        // Temporarily save config for testing
        await this.aiManager.saveConfig(provider, apiKey, model);
        const result = await this.aiManager.testConnection();
        this.showStatus(`✓ Connection successful! Model: ${result.model}`, 'success');
        document.getElementById('aiToolsSection').classList.remove('hidden');
      } catch (error) {
        this.showStatus(`✗ Connection failed: ${error.message}`, 'error');
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
      }
    });
  }

  setupAnalysis() {
    const startBtn = document.getElementById('startAiAnalysis');
    const sourceSelect = document.getElementById('aiAnalysisSource');
    const folderSelect = document.getElementById('aiFolderSelect');

    if (!startBtn) return;

    // Show/hide folder select based on source
    if (sourceSelect) {
      sourceSelect.addEventListener('change', (e) => {
        if (e.target.value === 'folder') {
          folderSelect.classList.remove('hidden');
          this.populateFolderSelect();
        } else {
          folderSelect.classList.add('hidden');
        }
      });
    }

    startBtn.addEventListener('click', async () => {
      await this.runAnalysis();
    });
  }

  async populateFolderSelect() {
    const select = document.getElementById('aiTargetFolder');
    if (!select) return;

    const tree = await chrome.bookmarks.getTree();
    select.innerHTML = '';

    const addFolder = (node, depth = 0) => {
      if (node.children) {
        if (node.id !== '0') {
          const option = document.createElement('option');
          option.value = node.id;
          option.textContent = '  '.repeat(depth) + (node.title || 'Bookmarks');
          select.appendChild(option);
        }
        node.children.forEach(child => addFolder(child, depth + 1));
      }
    };

    tree.forEach(node => addFolder(node));
  }

  async runAnalysis() {
    const startBtn = document.getElementById('startAiAnalysis');
    const progressSection = document.getElementById('aiProgress');
    const resultsSection = document.getElementById('aiResultsSection');
    const resultsContent = document.getElementById('aiResultsContent');

    startBtn.disabled = true;
    startBtn.textContent = 'Analyzing...';
    progressSection.classList.remove('hidden');
    resultsSection.classList.remove('hidden');

    try {
      // Get bookmarks to analyze
      const bookmarks = await this.getBookmarksForAnalysis();

      if (bookmarks.length === 0) {
        this.showStatus('No bookmarks found to analyze', 'error');
        return;
      }

      this.updateProgress('Analyzing bookmarks...', 10);

      // Get analysis options
      const options = {
        analyzeDomain: document.getElementById('aiAnalyzeDomain').checked,
        analyzeTopic: document.getElementById('aiAnalyzeTopic').checked,
        analyzeSimilar: document.getElementById('aiAnalyzeSimilar').checked,
        analyzeDuplicates: document.getElementById('aiAnalyzeDuplicates').checked,
        analyzeBroken: document.getElementById('aiAnalyzeBroken').checked
      };

      this.updateProgress('Processing with AI...', 30);

      // Run analysis
      const results = await this.aiManager.analyzeBookmarks(bookmarks, options);

      this.updateProgress('Generating results...', 90);

      // Display results
      this.displayResults(results, bookmarks.length);
      this.currentResults = { results, bookmarks };

      this.updateProgress('Complete!', 100);

      setTimeout(() => {
        progressSection.classList.add('hidden');
      }, 1000);

    } catch (error) {
      this.showStatus(`Analysis failed: ${error.message}`, 'error');
      console.error('Analysis error:', error);
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = '🔍 Analyze Bookmarks';
    }
  }

  async getBookmarksForAnalysis() {
    const source = document.getElementById('aiAnalysisSource').value;
    const tree = await chrome.bookmarks.getTree();

    const bookmarks = [];

    const traverse = (node) => {
      if (node.url) {
        bookmarks.push(node);
      }
      if (node.children) {
        node.children.forEach(child => traverse(child));
      }
    };

    if (source === 'all') {
      tree.forEach(node => traverse(node));
    } else if (source === 'folder') {
      const folderId = document.getElementById('aiTargetFolder').value;
      const folder = await chrome.bookmarks.getSubTree(folderId);
      folder.forEach(node => traverse(node));
    } else if (source === 'unsorted') {
      // Find "Other Bookmarks" folder
      const findOtherBookmarks = (node) => {
        if (node.title === 'Other Bookmarks' || node.id === '2') {
          return node;
        }
        if (node.children) {
          for (const child of node.children) {
            const result = findOtherBookmarks(child);
            if (result) return result;
          }
        }
        return null;
      };

      const otherBookmarks = findOtherBookmarks(tree[0]);
      if (otherBookmarks) {
        traverse(otherBookmarks);
      }
    }

    return bookmarks;
  }

  displayResults(results, totalBookmarks) {
    const content = document.getElementById('aiResultsContent');
    const actions = document.getElementById('aiResultsActions');

    let html = '<div style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px;">';
    html += `<strong>Analysis Complete!</strong> Analyzed ${totalBookmarks} bookmarks.`;
    html += '</div>';

    // Domain groups
    if (results.domains.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4>📊 Domain Groups</h4>';
      html += '<div style="font-size: 12px; color: #666; margin-bottom: 8px;">Bookmarks grouped by website</div>';
      results.domains.slice(0, 10).forEach(group => {
        html += `
          <div style="padding: 10px; border: 1px solid #e9ecef; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${group.domain}</div>
            <div style="font-size: 12px; color: #666;">${group.count} bookmarks</div>
          </div>
        `;
      });
      if (results.domains.length > 10) {
        html += `<div style="font-size: 12px; color: #666; margin-top: 8px;">...and ${results.domains.length - 10} more domains</div>`;
      }
      html += '</div>';
    }

    // Topics
    if (results.topics.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4>🏷️ Topic Categories</h4>';
      html += '<div style="font-size: 12px; color: #666; margin-bottom: 8px;">AI-suggested topics and folders</div>';
      results.topics.forEach(topic => {
        html += `
          <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 6px; margin-bottom: 10px; background: #f8f9fa;">
            <div style="font-weight: 600; margin-bottom: 4px;">${topic.topic}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 6px;">${topic.description}</div>
            <div style="font-size: 12px;">
              <strong>Suggested folder:</strong> ${topic.suggestedFolder}<br>
              <strong>Bookmarks:</strong> ${topic.bookmarkIds.length}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    // Similar groups
    if (results.similar.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4>🔗 Similar Bookmarks</h4>';
      html += '<div style="font-size: 12px; color: #666; margin-bottom: 8px;">Related bookmarks that could be grouped</div>';
      results.similar.forEach(group => {
        html += `
          <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 6px; margin-bottom: 10px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${group.groupName}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${group.reason}</div>
            <div style="font-size: 12px;"><strong>Count:</strong> ${group.bookmarkIds.length} bookmarks</div>
          </div>
        `;
      });
      html += '</div>';
    }

    // Duplicates
    if (results.duplicates.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4>⚠️ Duplicate Bookmarks</h4>';
      html += '<div style="font-size: 12px; color: #666; margin-bottom: 8px;">Found ${results.duplicates.length} URLs with multiple bookmarks</div>';
      results.duplicates.slice(0, 5).forEach(dup => {
        html += `
          <div style="padding: 10px; border: 1px solid #ffc107; border-radius: 6px; margin-bottom: 8px; background: #fff8e1;">
            <div style="font-size: 12px; word-break: break-all; margin-bottom: 4px;">${dup.url}</div>
            <div style="font-size: 12px; color: #666;"><strong>${dup.count} duplicates</strong></div>
          </div>
        `;
      });
      if (results.duplicates.length > 5) {
        html += `<div style="font-size: 12px; color: #666; margin-top: 8px;">...and ${results.duplicates.length - 5} more duplicate sets</div>`;
      }
      html += '</div>';
    }

    content.innerHTML = html;
    actions.classList.remove('hidden');
  }

  setupResultsActions() {
    const applyBtn = document.getElementById('applyAiSuggestions');
    const exportBtn = document.getElementById('exportAiResults');
    const clearBtn = document.getElementById('clearAiResults');

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.applySuggestions();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportResults();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        document.getElementById('aiResultsContent').innerHTML = '';
        document.getElementById('aiResultsActions').classList.add('hidden');
        this.currentResults = null;
      });
    }
  }

  async applySuggestions() {
    if (!this.currentResults) return;

    if (!confirm('Apply AI suggestions? This will create folders and move bookmarks.')) {
      return;
    }

    const { results } = this.currentResults;
    let applied = 0;

    try {
      // Apply topic-based organization
      for (const topic of results.topics) {
        // Create folder structure
        const folderPath = topic.suggestedFolder.split('/');
        let parentId = '1'; // Bookmarks Bar

        for (const folderName of folderPath) {
          const existing = await this.findFolder(parentId, folderName);
          if (existing) {
            parentId = existing.id;
          } else {
            const newFolder = await chrome.bookmarks.create({
              parentId,
              title: folderName
            });
            parentId = newFolder.id;
          }
        }

        // Move bookmarks to this folder
        for (const bookmarkId of topic.bookmarkIds) {
          try {
            await chrome.bookmarks.move(bookmarkId, { parentId });
            applied++;
          } catch (e) {
            console.warn('Failed to move bookmark:', bookmarkId, e);
          }
        }
      }

      this.showStatus(`✓ Applied ${applied} suggestions successfully!`, 'success');
    } catch (error) {
      this.showStatus(`Failed to apply suggestions: ${error.message}`, 'error');
    }
  }

  async findFolder(parentId, title) {
    const children = await chrome.bookmarks.getChildren(parentId);
    return children.find(c => !c.url && c.title === title);
  }

  exportResults() {
    if (!this.currentResults) return;

    const data = JSON.stringify(this.currentResults.results, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmark-analysis-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async loadSavedConfig() {
    const { provider, config } = await this.aiManager.getConfig();

    // Show saved providers hint
    const allConfigs = await this.aiManager.getAllConfigs();
    const savedProviders = Object.keys(allConfigs);

    if (savedProviders.length > 0) {
      const hint = document.getElementById('savedProvidersHint');
      if (hint) {
        const providerNames = savedProviders.map(p => {
          const info = AIManager.getProviderInfo(p);
          return info ? info.name.split(' ')[0] : p;
        }).join(', ');
        hint.textContent = `✓ Saved: ${providerNames}`;
        hint.style.display = 'inline';
      }
    }

    if (provider && config) {
      const providerSelect = document.getElementById('aiProvider');
      const apiKeyInput = document.getElementById('aiApiKey');
      const modelSelect = document.getElementById('aiModel');

      if (providerSelect) {
        providerSelect.value = provider;
        providerSelect.dispatchEvent(new Event('change'));
      }

      if (apiKeyInput && config.apiKey) {
        apiKeyInput.value = config.apiKey;
      }

      setTimeout(() => {
        if (modelSelect && config.model) {
          modelSelect.value = config.model;
        }
      }, 100);

      document.getElementById('aiToolsSection').classList.remove('hidden');
    }
  }

  updateProgress(text, percent) {
    const progressText = document.getElementById('aiProgressText');
    const progressPercent = document.getElementById('aiProgressPercent');
    const progressBar = document.getElementById('aiProgressBar');

    if (progressText) progressText.textContent = text;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('aiConfigStatus');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.classList.remove('hidden');

    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 5000);
  }
}

// === New Features: Countdown, Diagnostics, Activity Log, Keyboard Shortcuts ===
class FeatureEnhancements {
  constructor() {
    this.activityLog = [];
    this.maxLogEntries = 10;
    this.init();
  }

  init() {
    this.setupCountdown();
    this.setupDiagnostics();
    this.setupActivityLog();
    this.setupKeyboardShortcuts();
    this.setupRetryButton();
    this.setupLoadingStates();
    this.setupQuietHours();
    this.setupConditionalSync();
    this.setupProgressBar();
    this.setupQuickStatusBadges();
    this.setupBackupVersioning();
    this.setupSettingsExportImport();
    this.setupSyncHistory();
    this.setupActivityLogSearch();
    this.setupQuickActions();
  }

  // Countdown Timer
  setupCountdown() {
    const countdownEl = document.getElementById('nextSyncCountdown');
    const timerEl = document.getElementById('countdownTimer');
    if (!countdownEl || !timerEl) return;

    chrome.storage.sync.get(['syncInterval', 'autoSync'], ({ syncInterval, autoSync }) => {
      if (!autoSync) return;
      const interval = parseInt(syncInterval) || 15;
      const nextSync = Date.now() + interval * 60 * 1000;

      countdownEl.style.display = 'block';

      setInterval(() => {
        const remaining = Math.max(0, nextSync - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }, 1000);
    });
  }

  // Copy Diagnostics
  setupDiagnostics() {
    const btn = document.getElementById('copyDiagnostics');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const data = await chrome.storage.sync.get(null);
      const manifest = chrome.runtime.getManifest();

      const diagnostics = `
=== Folio Diagnostics ===
Version: ${manifest.version}
Date: ${new Date().toISOString()}

Settings:
- Sync Mode: ${data.syncMode || 'additions_only'}
- Auto Sync: ${data.autoSync ? 'Enabled' : 'Disabled'}
- Sync Interval: ${data.syncInterval || 15} minutes
- OAuth Method: ${data.useCloudflareOAuth ? 'Managed' : 'Manual'}

Last Sync:
- Status: ${data.lastSyncStatus || 'Never synced'}
- Time: ${data.lastSyncTime || 'N/A'}
- Items: ${data.lastSyncItems || 0}

Activity Log:
${this.activityLog.slice(-5).map(e => `[${e.time}] ${e.action}: ${e.status}`).join('\n')}

Browser: ${navigator.userAgent}
      `.trim();

      await navigator.clipboard.writeText(diagnostics);
      btn.textContent = '✅ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy Diagnostics for Issue Report', 2000);
    });
  }

  // Activity Log
  setupActivityLog() {
    const container = document.getElementById('activityLogContainer');
    const clearBtn = document.getElementById('clearActivityLog');
    if (!container) return;

    chrome.storage.local.get(['activityLog'], ({ activityLog }) => {
      if (activityLog) {
        this.activityLog = activityLog;
        this.renderActivityLog();
      }
    });

    clearBtn?.addEventListener('click', () => {
      this.activityLog = [];
      chrome.storage.local.set({ activityLog: [] });
      this.renderActivityLog();
    });
  }

  addActivity(action, status, details = '') {
    const entry = {
      time: new Date().toLocaleTimeString(),
      action,
      status,
      details
    };
    this.activityLog.push(entry);
    if (this.activityLog.length > this.maxLogEntries) {
      this.activityLog.shift();
    }
    chrome.storage.local.set({ activityLog: this.activityLog });
    this.renderActivityLog();
  }

  renderActivityLog() {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    if (this.activityLog.length === 0) {
      container.innerHTML = '<div style="color: #999;">No activity yet...</div>';
      return;
    }

    container.innerHTML = this.activityLog.slice().reverse().map(e => `
      <div style="padding: 4px 0; border-bottom: 1px solid #e9ecef;">
        <span style="color: #999;">[${e.time}]</span>
        <span style="font-weight: 600;">${e.action}</span>:
        <span style="color: ${e.status === 'success' ? '#10b981' : '#dc3545'};">${e.status}</span>
        ${e.details ? `<span style="color: #666;"> - ${e.details}</span>` : ''}
      </div>
    `).join('');
  }

  // Keyboard Shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('syncNow')?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.getElementById('backupNow')?.click();
      }
    });
  }

  // Retry Button
  setupRetryButton() {
    const retryBtn = document.getElementById('retrySyncBtn');
    if (!retryBtn) return;

    retryBtn.addEventListener('click', () => {
      document.getElementById('syncNow')?.click();
      retryBtn.style.display = 'none';
    });
  }

  // Loading States
  setupLoadingStates() {
    const addLoadingState = (btnId) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      const originalClick = btn.onclick;
      btn.onclick = async function(e) {
        btn.classList.add('loading');
        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        btn.insertBefore(spinner, btn.firstChild);

        try {
          if (originalClick) await originalClick.call(this, e);
        } finally {
          setTimeout(() => {
            btn.classList.remove('loading');
            spinner.remove();
          }, 1000);
        }
      };
    };

    ['syncNow', 'backupNow', 'restoreBackup'].forEach(addLoadingState);
  }

  showSyncMetrics(items, duration) {
    const metricsEl = document.getElementById('syncMetrics');
    const statsEl = document.getElementById('lastSyncStats');
    if (!metricsEl || !statsEl) return;

    const itemsPerSec = (items / (duration / 1000)).toFixed(1);
    statsEl.textContent = `${items} items in ${(duration / 1000).toFixed(1)}s (${itemsPerSec} items/sec)`;
    metricsEl.style.display = 'block';
  }

  showRetryButton() {
    const retryBtn = document.getElementById('retrySyncBtn');
    if (retryBtn) retryBtn.style.display = 'inline-block';
  }

  // Quiet Hours
  setupQuietHours() {
    const toggle = document.getElementById('quietHoursEnabled');
    const settings = document.getElementById('quietHoursSettings');
    const startInput = document.getElementById('quietHoursStart');
    const endInput = document.getElementById('quietHoursEnd');

    if (!toggle) return;

    chrome.storage.sync.get(['quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd'], (data) => {
      toggle.checked = data.quietHoursEnabled || false;
      startInput.value = data.quietHoursStart || '23:00';
      endInput.value = data.quietHoursEnd || '07:00';
      settings.style.display = toggle.checked ? 'block' : 'none';
    });

    toggle.addEventListener('change', () => {
      settings.style.display = toggle.checked ? 'block' : 'none';
      this.saveQuietHours();
    });

    startInput?.addEventListener('change', () => this.saveQuietHours());
    endInput?.addEventListener('change', () => this.saveQuietHours());
  }

  saveQuietHours() {
    const enabled = document.getElementById('quietHoursEnabled')?.checked;
    const start = document.getElementById('quietHoursStart')?.value;
    const end = document.getElementById('quietHoursEnd')?.value;

    chrome.storage.sync.set({ quietHoursEnabled: enabled, quietHoursStart: start, quietHoursEnd: end });
    this.updateQuickStatusBadges();
  }

  isQuietHours() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const start = document.getElementById('quietHoursStart')?.value || '23:00';
    const end = document.getElementById('quietHoursEnd')?.value || '07:00';

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (startMin < endMin) {
      return currentTime >= startMin && currentTime < endMin;
    } else {
      return currentTime >= startMin || currentTime < endMin;
    }
  }

  // Conditional Sync
  setupConditionalSync() {
    const lowBattery = document.getElementById('pauseOnLowBattery');
    const metered = document.getElementById('pauseOnMetered');

    chrome.storage.sync.get(['pauseOnLowBattery', 'pauseOnMetered'], (data) => {
      if (lowBattery) lowBattery.checked = data.pauseOnLowBattery || false;
      if (metered) metered.checked = data.pauseOnMetered || false;
    });

    lowBattery?.addEventListener('change', () => {
      chrome.storage.sync.set({ pauseOnLowBattery: lowBattery.checked });
      this.updateQuickStatusBadges();
    });

    metered?.addEventListener('change', () => {
      chrome.storage.sync.set({ pauseOnMetered: metered.checked });
      this.updateQuickStatusBadges();
    });

    // Check battery status
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        this.batteryLevel = battery.level;
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.updateQuickStatusBadges();
        });
      });
    }
  }

  // Progress Bar
  setupProgressBar() {
    this.progressContainer = document.getElementById('syncProgress');
    this.progressBar = document.getElementById('syncProgressBar');
  }

  showProgress(percent, text = '') {
    if (!this.progressContainer || !this.progressBar) return;
    this.progressContainer.classList.add('visible');
    this.progressBar.style.width = `${percent}%`;
    this.progressBar.textContent = text || `${percent}%`;
  }

  hideProgress() {
    if (!this.progressContainer) return;
    this.progressContainer.classList.remove('visible');
    this.progressBar.style.width = '0%';
  }

  // Quick Status Badges
  setupQuickStatusBadges() {
    setInterval(() => this.updateQuickStatusBadges(), 30000); // Update every 30s
    this.updateQuickStatusBadges();
  }

  updateQuickStatusBadges() {
    const quietBadge = document.getElementById('quietHoursBadge');
    const batteryBadge = document.getElementById('lowBatteryBadge');
    const meteredBadge = document.getElementById('meteredBadge');

    chrome.storage.sync.get(['quietHoursEnabled', 'pauseOnLowBattery', 'pauseOnMetered'], (data) => {
      if (quietBadge && data.quietHoursEnabled && this.isQuietHours()) {
        quietBadge.style.display = 'inline-block';
      } else if (quietBadge) {
        quietBadge.style.display = 'none';
      }

      if (batteryBadge && data.pauseOnLowBattery && this.batteryLevel < 0.2) {
        batteryBadge.style.display = 'inline-block';
      } else if (batteryBadge) {
        batteryBadge.style.display = 'none';
      }

      if (meteredBadge && data.pauseOnMetered && navigator.connection?.saveData) {
        meteredBadge.style.display = 'inline-block';
      } else if (meteredBadge) {
        meteredBadge.style.display = 'none';
      }
    });
  }

  // Backup Versioning
  setupBackupVersioning() {
    const container = document.getElementById('backupVersionHistory');
    const refreshBtn = document.getElementById('refreshBackupHistory');

    if (!container) return;

    const loadBackupHistory = () => {
      chrome.storage.local.get(['autoBackups'], ({ autoBackups }) => {
        if (!autoBackups || autoBackups.length === 0) {
          container.innerHTML = '<div class="help-text">No backup history available.</div>';
          return;
        }

        container.innerHTML = autoBackups.slice().reverse().map((backup, idx) => {
          const date = new Date(backup.timestamp);
          const size = (JSON.stringify(backup.data).length / 1024).toFixed(1);
          return `
            <div style="padding: 10px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600; margin-bottom: 4px;">${date.toLocaleString()}</div>
                <div style="font-size: 11px; color: #666;">${size} KB • ${backup.data?.length || 0} items</div>
              </div>
              <button class="button" style="height: 28px; padding: 0 10px; font-size: 11px;" onclick="window.featureEnhancements.restoreBackupVersion(${autoBackups.length - 1 - idx})">Restore</button>
            </div>
          `;
        }).join('');
      });
    };

    refreshBtn?.addEventListener('click', loadBackupHistory);
    loadBackupHistory();
  }

  restoreBackupVersion(index) {
    if (!confirm('Restore this backup? Current bookmarks will be replaced.')) return;
    chrome.storage.local.get(['autoBackups'], ({ autoBackups }) => {
      if (autoBackups && autoBackups[index]) {
        window.optionsApp?.restoreFromBackup(autoBackups[index].data);
        this.addActivity('Backup Restore', 'success', `Restored from ${new Date(autoBackups[index].timestamp).toLocaleString()}`);
      }
    });
  }

  // Settings Export/Import
  setupSettingsExportImport() {
    const exportBtn = document.getElementById('exportSettings');
    const importBtn = document.getElementById('importSettings');
    const fileInput = document.getElementById('importSettingsFile');

    exportBtn?.addEventListener('click', async () => {
      const settings = await chrome.storage.sync.get(null);
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmark-sync-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.addActivity('Settings Export', 'success', 'Settings exported successfully');
    });

    importBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      try {
        const settings = JSON.parse(text);
        await chrome.storage.sync.set(settings);
        alert('Settings imported successfully! Page will reload.');
        location.reload();
      } catch (err) {
        alert('Failed to import settings: ' + err.message);
      }
    });
  }

  // Sync History
  async refreshSyncHistory() {
    try {
      const { syncHistory = [] } = await chrome.storage.local.get(['syncHistory']);
      const container = document.getElementById('syncHistoryTimeline');

      if (!container) return; // Guard against missing element

      if (syncHistory.length === 0) {
        container.innerHTML = '<div style="color: #999;">No sync history yet...</div>';
        return;
      }

      container.innerHTML = syncHistory.slice(-20).reverse().map(entry => {
        const time = new Date(entry.timestamp).toLocaleString();
        const icon = entry.success ? '✓' : '✗';
        const color = entry.success ? '#28a745' : '#dc3545';
        return `
          <div style="margin-bottom: 8px; border-left: 3px solid ${color}; padding-left: 8px;">
            <div style="font-weight: 600;">${icon} ${time}</div>
            <div style="font-size: 11px; color: #666;">${entry.details || (entry.success ? 'Sync completed' : 'Failed')}</div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error('Failed to load sync history:', e);
    }
  }

  addSyncHistoryEntry(status, details) {
    chrome.storage.local.get(['syncHistory'], ({ syncHistory }) => {
      const history = syncHistory || [];
      history.push({
        timestamp: new Date().toLocaleString(),
        status,
        details
      });
      if (history.length > 50) history.shift();
      chrome.storage.local.set({ syncHistory: history });
    });
  }

  // Activity Log Search
  setupActivityLogSearch() {
    const searchInput = document.getElementById('activityLogSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const entries = document.querySelectorAll('#activityLogContainer > div');

      entries.forEach(entry => {
        const text = entry.textContent.toLowerCase();
        entry.style.display = text.includes(query) ? 'block' : 'none';
      });
    });
  }

  // Quick Actions (FAB)
  setupQuickActions() {
    document.getElementById('fabSync')?.addEventListener('click', () => {
      document.getElementById('syncNow')?.click();
    });

    document.getElementById('fabBackup')?.addEventListener('click', () => {
      document.getElementById('createBackup')?.click();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new OptionsManager();
  window.optionsManager = app;
  window.optionsApp = app;
  window.featureEnhancements = new FeatureEnhancements();
  window.aiUI = new AIUserInterface();
  try { app.openRoadmapLink?.(); } catch (_) {}
});
