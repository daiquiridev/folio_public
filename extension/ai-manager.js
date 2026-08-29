/**
 * AI Manager - Core module for AI-powered bookmark organization
 * Supports multiple AI providers: Claude, OpenAI, Gemini
 */

class AIManager {
    constructor() {
        this.provider = null;
        this.config = null;
    }

    /**
     * Initialize AI manager with stored configuration
     */
    async initialize() {
        const { provider, config } = await this.getConfig();
        if (provider && config) {
            this.provider = provider;
            this.config = config;
            return true;
        }
        // AI Pro plan: included AI auto-enables with zero setup — no key,
        // no model picking. BYOK config, when present, wins (user's explicit
        // choice); this branch only fills the vacuum.
        if (typeof FolioLicense !== 'undefined' && await FolioLicense.can('includedAI')) {
            this.provider = 'folio';
            this.config = {};
            return true;
        }
        return false;
    }

    /** Plan-aware status for the options UI. */
    async getStatus() {
        const { provider, config } = await this.getConfig();
        const lic = (typeof FolioLicense !== 'undefined') ? await FolioLicense.status() : { plan: 'free', features: {} };
        const effective = (provider && config) ? provider : (lic.features.includedAI ? 'folio' : null);
        return {
            configuredProvider: provider || null,
            effectiveProvider: effective,
            model: config?.model || null,
            plan: lic.plan,
            includedAI: !!lic.features.includedAI,
            aiUsage: lic.aiUsage || null,
        };
    }

    /** Customizable organize prompt. {{BOOKMARKS}} is replaced with the JSON list. */
    async getOrganizePrompt() {
        const { aiCustomPrompt } = await chrome.storage.local.get(['aiCustomPrompt']);
        return {
            prompt: aiCustomPrompt || AIManager.DEFAULT_ORGANIZE_PROMPT,
            isCustom: !!aiCustomPrompt,
            defaultPrompt: AIManager.DEFAULT_ORGANIZE_PROMPT,
        };
    }

    async setOrganizePrompt(prompt) {
        const trimmed = (prompt || '').trim();
        if (!trimmed || trimmed === AIManager.DEFAULT_ORGANIZE_PROMPT.trim()) {
            await chrome.storage.local.remove(['aiCustomPrompt']);
            return { isCustom: false };
        }
        if (!trimmed.includes('{{BOOKMARKS}}')) throw new Error('prompt_missing_placeholder');
        await chrome.storage.local.set({ aiCustomPrompt: trimmed });
        return { isCustom: true };
    }

    /**
     * Save AI configuration for a specific provider
     */
    async saveConfig(provider, apiKey, model) {
        // Save current provider
        await chrome.storage.local.set({ aiProvider: provider });

        // Save provider-specific config
        const providerConfigKey = `aiConfig_${provider}`;
        const config = {
            apiKey,
            model,
            savedAt: new Date().toISOString()
        };

        await chrome.storage.local.set({
            [providerConfigKey]: config
        });

        this.provider = provider;
        this.config = config;
    }

    /**
     * Get stored configuration for current or specific provider
     */
    async getConfig(provider = null) {
        const stored = await chrome.storage.local.get(['aiProvider']);
        const currentProvider = provider || stored.aiProvider;

        if (!currentProvider) {
            return { provider: null, config: null };
        }

        const providerConfigKey = `aiConfig_${currentProvider}`;
        const configData = await chrome.storage.local.get([providerConfigKey]);

        return {
            provider: currentProvider,
            config: configData[providerConfigKey] || null
        };
    }

    /**
     * Get all saved provider configs
     */
    async getAllConfigs() {
        const data = await chrome.storage.local.get(null);
        const configs = {};

        for (const key in data) {
            if (key.startsWith('aiConfig_')) {
                const provider = key.replace('aiConfig_', '');
                configs[provider] = data[key];
            }
        }

        return configs;
    }

    /**
     * Test AI connection
     */
    async testConnection() {
        if (!this.provider || !this.config) {
            throw new Error('AI provider not configured');
        }

        const adapter = this.getAdapter();
        return await adapter.test();
    }

    /**
     * Get appropriate adapter for current provider
     */
    getAdapter() {
        switch (this.provider) {
            case 'folio':
                return new FolioAdapter(this.config);
            case 'claude':
                return new ClaudeAdapter(this.config);
            case 'openai':
                return new OpenAIAdapter(this.config);
            case 'gemini':
                return new GeminiAdapter(this.config);
            default:
                throw new Error(`Unknown provider: ${this.provider}`);
        }
    }

    /**
     * Analyze bookmarks with AI
     */
    async analyzeBookmarks(bookmarks, options = {}) {
        if (!this.provider || !this.config) {
            throw new Error('AI provider not configured');
        }

        const adapter = this.getAdapter();
        const results = {
            domains: [],
            topics: [],
            similar: [],
            duplicates: [],
            broken: []
        };

        // Domain grouping (can be done locally, fast)
        if (options.analyzeDomain) {
            results.domains = this.groupByDomain(bookmarks);
        }

        // AI-powered analyses
        const aiAnalyses = [];

        if (options.analyzeTopic) {
            aiAnalyses.push(this.analyzeTopics(bookmarks, adapter));
        }

        if (options.analyzeSimilar) {
            aiAnalyses.push(this.findSimilar(bookmarks, adapter));
        }

        if (options.analyzeDuplicates) {
            results.duplicates = this.findDuplicates(bookmarks);
        }

        if (options.analyzeBroken) {
            aiAnalyses.push(this.checkBrokenLinks(bookmarks));
        }

        // Run AI analyses in parallel where possible
        const aiResults = await Promise.all(aiAnalyses);

        if (options.analyzeTopic) results.topics = aiResults[0];
        if (options.analyzeSimilar) results.similar = aiResults[options.analyzeTopic ? 1 : 0];

        return results;
    }

    /**
     * Group bookmarks by domain (local analysis, no AI needed)
     */
    groupByDomain(bookmarks) {
        const groups = {};

        bookmarks.forEach(bookmark => {
            try {
                const url = new URL(bookmark.url);
                const domain = url.hostname.replace(/^www\./, '');

                if (!groups[domain]) {
                    groups[domain] = {
                        domain,
                        count: 0,
                        bookmarks: []
                    };
                }

                groups[domain].count++;
                groups[domain].bookmarks.push(bookmark);
            } catch (e) {
                // Invalid URL, skip
            }
        });

        // Convert to array and sort by count
        return Object.values(groups)
            .sort((a, b) => b.count - a.count)
            .filter(g => g.count > 1); // Only show domains with multiple bookmarks
    }

    /**
     * Analyze topics using AI
     */
    async analyzeTopics(bookmarks, adapter) {
        // Prepare bookmark data for AI
        const bookmarkData = bookmarks.map(b => ({
            id: b.id,
            title: b.title,
            url: b.url
        }));

        const { prompt: template } = await this.getOrganizePrompt();
        const prompt = template.replace('{{BOOKMARKS}}', JSON.stringify(bookmarkData));

        const response = await adapter.analyze(prompt);
        return this.parseAIResponse(response);
    }

    /**
     * Find similar bookmarks using AI
     */
    async findSimilar(bookmarks, adapter) {
        const bookmarkData = bookmarks.map(b => ({
            id: b.id,
            title: b.title,
            url: b.url
        }));

        const prompt = `Find groups of similar/related bookmarks.
Return a JSON array with this structure:
[
  {
    "groupName": "Group description",
    "reason": "Why these are similar",
    "bookmarkIds": ["id1", "id2", "id3"]
  }
]

Bookmarks:
${JSON.stringify(bookmarkData)}`;

        const response = await adapter.analyze(prompt);
        return this.parseAIResponse(response);
    }

    /**
     * Find duplicate bookmarks (local analysis)
     */
    findDuplicates(bookmarks) {
        const urlMap = {};
        const duplicates = [];

        bookmarks.forEach(bookmark => {
            const normalizedUrl = this.normalizeUrl(bookmark.url);

            if (!urlMap[normalizedUrl]) {
                urlMap[normalizedUrl] = [];
            }

            urlMap[normalizedUrl].push(bookmark);
        });

        // Find URLs with multiple bookmarks
        Object.entries(urlMap).forEach(([url, items]) => {
            if (items.length > 1) {
                duplicates.push({
                    url,
                    count: items.length,
                    bookmarks: items
                });
            }
        });

        return duplicates;
    }

    /**
     * Normalize URL for duplicate detection
     */
    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            // Remove tracking parameters
            const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
            trackingParams.forEach(param => parsed.searchParams.delete(param));

            // Normalize
            let normalized = parsed.origin + parsed.pathname;
            if (parsed.search) normalized += parsed.search;

            // Remove trailing slash
            return normalized.replace(/\/$/, '');
        } catch (e) {
            return url;
        }
    }

    /**
     * Check for broken links
     */
    async checkBrokenLinks(bookmarks) {
        const broken = [];
        const batchSize = 10;

        for (let i = 0; i < bookmarks.length; i += batchSize) {
            const batch = bookmarks.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(b => this.checkUrl(b))
            );
            broken.push(...results.filter(r => r.broken));
        }

        return broken;
    }

    /**
     * Check if URL is accessible
     */
    async checkUrl(bookmark) {
        try {
            const response = await fetch(bookmark.url, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache'
            });

            return {
                ...bookmark,
                broken: false,
                status: response.status
            };
        } catch (error) {
            return {
                ...bookmark,
                broken: true,
                error: error.message
            };
        }
    }

    /**
     * Parse AI response and extract JSON
     */
    parseAIResponse(response) {
        try {
            // Try to find JSON in the response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        } catch (e) {
            console.error('Failed to parse AI response:', e);
            return [];
        }
    }

    /**
     * Get provider info
     */
    static getProviderInfo(provider) {
        const info = {
            claude: {
                name: 'Claude (Anthropic)',
                website: 'https://console.anthropic.com/',
                models: [
                    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommended)' },
                    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Faster, Cheaper)' },
                    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Most Capable)' }
                ],
                pricing: 'Pay per use (~$3-15 per million tokens)',
                keyFormat: 'sk-ant-...'
            },
            openai: {
                name: 'OpenAI',
                website: 'https://platform.openai.com/api-keys',
                models: [
                    { value: 'gpt-4o', label: 'GPT-4o (Recommended, Latest)' },
                    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster, Cheaper)' },
                    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo Preview' },
                    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legacy)' }
                ],
                pricing: 'Pay per use (~$2.50-15 per million tokens)',
                keyFormat: 'sk-...'
            },
            gemini: {
                name: 'Google Gemini',
                website: 'https://aistudio.google.com/app/apikey',
                models: [
                    { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash (Recommended, Fast & Free)' },
                    { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro (More Capable)' },
                    { value: 'gemini-pro', label: 'Gemini Pro (Legacy)' }
                ],
                pricing: 'Free tier available (15 RPM), then pay per use',
                keyFormat: 'AIza...'
            }
        };

        return info[provider] || null;
    }

    /**
     * Validate API key format for a provider
     */
    static validateApiKey(provider, apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return { valid: false, error: 'API key is required' };
        }

        const trimmedKey = apiKey.trim();

        if (trimmedKey.length < 10) {
            return { valid: false, error: 'API key is too short' };
        }

        switch (provider) {
            case 'claude':
                if (!trimmedKey.startsWith('sk-ant-')) {
                    return {
                        valid: false,
                        error: 'Claude API keys should start with "sk-ant-"'
                    };
                }
                break;

            case 'openai':
                if (!trimmedKey.startsWith('sk-')) {
                    return {
                        valid: false,
                        error: 'OpenAI API keys should start with "sk-"'
                    };
                }
                if (trimmedKey.startsWith('sk-ant-')) {
                    return {
                        valid: false,
                        error: 'This looks like a Claude API key. Please select Claude provider.'
                    };
                }
                break;

            case 'gemini':
                if (!trimmedKey.startsWith('AIza')) {
                    return {
                        valid: false,
                        error: 'Gemini API keys should start with "AIza"'
                    };
                }
                if (trimmedKey.startsWith('sk-')) {
                    return {
                        valid: false,
                        error: 'This looks like an OpenAI/Claude API key. Please select the correct provider.'
                    };
                }
                break;

            default:
                return { valid: false, error: 'Unknown provider' };
        }

        return { valid: true };
    }
}

/**
 * Claude (Anthropic) Adapter
 */
class ClaudeAdapter {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'claude-3-5-sonnet-20241022';
        this.baseUrl = 'https://api.anthropic.com/v1';
    }

    async test() {
        console.log('[Claude] Testing connection...', { model: this.model, baseUrl: this.baseUrl });

        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 100,
                messages: [{
                    role: 'user',
                    content: 'Hello! Just testing the connection. Reply with "OK".'
                }]
            })
        });

        console.log('[Claude] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Claude] API Error:', errorText);
            let errorObj;
            try {
                errorObj = JSON.parse(errorText);
            } catch (e) {
                errorObj = { message: errorText };
            }
            throw new Error(`Claude API error (${response.status}): ${errorObj.error?.message || errorObj.message || errorText}`);
        }

        const data = await response.json();
        console.log('[Claude] Test successful!', data);
        return {
            success: true,
            model: this.model,
            response: data.content[0].text
        };
    }

    async analyze(prompt) {
        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error: ${error}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }
}

/**
 * OpenAI Adapter
 */
class OpenAIAdapter {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'gpt-4o';
        this.baseUrl = 'https://api.openai.com/v1';
    }

    async test() {
        console.log('[OpenAI] Testing connection...', { model: this.model, baseUrl: this.baseUrl });

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 100,
                messages: [{
                    role: 'user',
                    content: 'Hello! Just testing the connection. Reply with "OK".'
                }]
            })
        });

        console.log('[OpenAI] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OpenAI] API Error:', errorText);
            let errorObj;
            try {
                errorObj = JSON.parse(errorText);
            } catch (e) {
                errorObj = { message: errorText };
            }

            // Friendly error messages for common issues
            let errorMessage = errorObj.error?.message || errorObj.message || errorText;
            if (response.status === 429) {
                errorMessage = '⚠️ Kredi limiti aşıldı. Lütfen OpenAI hesabınıza kredi ekleyin: https://platform.openai.com/settings/organization/billing';
            } else if (response.status === 401) {
                errorMessage = '🔑 API key geçersiz. Lütfen kontrol edin: https://platform.openai.com/api-keys';
            } else if (response.status === 404) {
                errorMessage = `❌ Model "${this.model}" bulunamadı. Hesabınızda bu modele erişim olmayabilir.`;
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('[OpenAI] Test successful!', data);
        return {
            success: true,
            model: this.model,
            response: data.choices[0].message.content
        };
    }

    async analyze(prompt) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

/**
 * Google Gemini Adapter
 */
class GeminiAdapter {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'gemini-1.5-flash-latest';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1';
    }

    async test() {
        console.log('[Gemini] Testing connection...', { model: this.model, baseUrl: this.baseUrl });

        const response = await fetch(
            `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'Hello! Just testing the connection. Reply with "OK".'
                        }]
                    }],
                    generationConfig: {
                        maxOutputTokens: 100
                    }
                })
            }
        );

        console.log('[Gemini] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini] API Error:', errorText);
            let errorObj;
            try {
                errorObj = JSON.parse(errorText);
            } catch (e) {
                errorObj = { message: errorText };
            }

            // Friendly error messages
            let errorMessage = errorObj.error?.message || errorObj.message || errorText;
            if (response.status === 400) {
                errorMessage = `🔑 API key veya model hatası: ${errorMessage}`;
            } else if (response.status === 404) {
                errorMessage = `❌ Model "${this.model}" bulunamadı. API versiyonunu kontrol edin.`;
            } else if (response.status === 429) {
                errorMessage = '⚠️ Rate limit aşıldı. 15 istek/dakika limitine ulaştınız. Biraz bekleyin.';
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('[Gemini] Test successful!', data);
        return {
            success: true,
            model: this.model,
            response: data.candidates[0].content.parts[0].text
        };
    }

    async analyze(prompt) {
        const response = await fetch(
            `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        maxOutputTokens: 8192
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${error}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIManager, ClaudeAdapter, OpenAIAdapter, GeminiAdapter };
}

/**
 * Default organize prompt — deliberately explicit about output contract.
 * Users can override it in AI settings; {{BOOKMARKS}} is the injection
 * point for the JSON bookmark list and MUST survive any custom edit.
 */
AIManager.DEFAULT_ORGANIZE_PROMPT = `You organize browser bookmarks into a small, sensible folder structure.

Rules:
- Create 4-10 topic groups. Prefer broad, durable categories (e.g. "Development", "Finance", "Recipes") over hyper-specific ones.
- Every bookmark id you were given must appear in exactly ONE group.
- Folder names: 1-3 words, in the dominant language of the bookmark titles.
- Do not invent bookmarks; only use the ids provided.

Return ONLY a JSON array (no prose, no markdown fences) with this exact shape:
[
  {
    "topic": "Topic Name",
    "description": "One short sentence",
    "bookmarkIds": ["id1", "id2"],
    "suggestedFolder": "Folder Name"
  }
]

Bookmarks:
{{BOOKMARKS}}`;

/**
 * Folio included AI (AI Pro plan) — calls the folio-ai worker, which runs
 * Workers AI server-side and meters the advertised monthly quota. No user
 * API key involved; the license key IS the credential.
 */
class FolioAdapter {
    constructor(config) { this.config = config || {}; }

    async _post(prompt) {
        const licenseKey = (typeof FolioLicense !== 'undefined') ? await FolioLicense.getKey() : null;
        if (!licenseKey) throw new Error('folio_ai_requires_license');
        const res = await fetch('https://ai.folio.daiquiri.dev/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, prompt }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) {
            const err = new Error('quota_exhausted');
            err.quota = { used: data.used, limit: data.limit, month: data.month };
            throw err;
        }
        if (res.status === 403) throw new Error('folio_ai_requires_ai_pro');
        if (res.status === 429) throw new Error('rate_limited');
        if (!res.ok) throw new Error(data.error || ('folio_ai_' + res.status));
        if (typeof FolioLicense !== 'undefined' && data.limit) {
            FolioLicense.recordAiUsage(data.used, data.limit).catch(() => {});
        }
        return data.text || '';
    }

    async analyze(prompt) { return this._post(prompt); }

    async test() {
        const health = await fetch('https://ai.folio.daiquiri.dev/health').then(r => r.ok).catch(() => false);
        if (!health) throw new Error('folio_ai_unreachable');
        const licenseKey = (typeof FolioLicense !== 'undefined') ? await FolioLicense.getKey() : null;
        if (!licenseKey) throw new Error('folio_ai_requires_license');
        return true;
    }
}

