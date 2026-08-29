# Folio

![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Compliant-brightgreen.svg)

> Universal bookmark manager. Today: syncs your Raindrop.io collections with Chrome / Brave bookmarks. Tomorrow: cross-browser bridge, AI-organized library, retrieval-first — see the [Roadmap](ROADMAP.md).

**Links**: [Privacy Policy](PRIVACY.md) · [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md) · [Releases](https://github.com/daiquiridev/folio_public/releases) · [Issues](https://github.com/daiquiridev/folio_public/issues) · [Support](https://buymeacoffee.com/daiquiri)

## What's New in v1.4.0

- **Rebranded to Folio** with a new universal-bookmark-manager direction
- Roadmap pivoted to a research-driven 4-phase plan (Foundation → AI Organization → Retrieval & Reminders → Platform Expansion)
- Repository cleanup: clipboard scratch removed, `.gitignore` tightened, release notes consolidated into `CHANGELOG.md` + GitHub Releases
- Reduced-motion accessibility support (`prefers-reduced-motion`) added to the UI

[View full changelog →](CHANGELOG.md)

## Current Capabilities (v1.4.0)

- **Flexible sync modes**: one-way, two-way additions-only, or full mirror
- **Smart organization**: creates collection-named folders in your bookmarks bar
- **Automatic scheduling**: configurable sync intervals (1–60+ minutes)
- **Secure OAuth2**: Chrome identity API with automatic token refresh
- **Backup & restore**: automatic backups; JSON + HTML export (Netscape Bookmark Format)
- **Cleanup tools**: URL parameter cleaning, duplicate detection, empty folder removal
- **Quiet hours + conditional sync**: pauses on low battery, metered network, or during quiet hours
- **Activity log + sync history**: searchable; exportable
- **Accessibility**: respects `prefers-reduced-motion`

## Where Folio is Heading

See [ROADMAP.md](ROADMAP.md) for the full 24-week plan. Headline directions:

- **Phase 1 — Foundation**: frictionless 1-click capture, universal importer (Chrome/Firefox/Safari/Edge/Pocket), local SQLite mirror, full-text search, bidirectional sync with conflict-resolution diff UI
- **Phase 2 — AI Organization**: full-page-content auto-tagging, optional local AI via Ollama/WebLLM, smart foldering, natural-language search
- **Phase 3 — Retrieval & Reminders**: spaced-repetition resurfacing, dead-link detection with Wayback fallback, local archive-on-save with reader mode + highlights
- **Phase 4 — Platform Expansion**: Firefox MV3, Safari port, iOS share, send-to-PKM (Obsidian / Notion / Readwise), non-browser capture, optional self-host

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open `chrome://extensions` (or Brave equivalent) and enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Pin the extension to your toolbar for quick access

### Chrome Web Store

Currently under review. Releases are published to [GitHub Releases](https://github.com/daiquiridev/folio_public/releases) in the meantime.

## Setup

### 1. OAuth Setup (Raindrop.io)

1. Create an app at [Raindrop.io Developer Portal](https://raindrop.io/developer)
2. Set Redirect URI: `https://<EXTENSION_ID>.chromiumapp.org/`
3. Copy your Client ID and Client Secret
4. Open the extension's **Options** → **Connect** tab
5. Enter credentials and click **Authenticate**

### 2. Configure Sync

1. Go to **Sync Settings** tab
2. Select target bookmark folder
3. Choose collections to sync
4. Set sync mode (`additions_only` recommended for safety)
5. Enable automatic sync

## Usage

- **Popup**: one-click sync, view status, quick settings
- **Options**: full configuration, backup management, cleanup tools

### Sync Modes

| Mode | Direction | Notes |
|------|-----------|-------|
| One-way (Raindrop → Browser) | Import only | No changes to Raindrop |
| Additions Only | Two-way | Only adds new items (safest) |
| Mirror | Two-way | Full sync with deletions — use with caution |
| Upload Only | Browser → Raindrop | One-way upload |

## How It Works

- Collections → folders; Raindrops → bookmarks
- ID mapping saved locally to prevent loops
- Background alarms schedule sync; API calls paced with backoff
- No official Raindrop rate quotas published; configurable RPM (default 60) + `Retry-After` / exponential backoff

## Permissions

`bookmarks`, `storage`, `alarms`, `identity`, plus host permissions for `raindrop.io`. See [PRIVACY.md](PRIVACY.md) for the full breakdown.

## Privacy & Compliance

Privacy-first by design:

- **No data collection**: zero telemetry, analytics, or tracking
- **Local-only storage**: all data stays in Chrome's local storage
- **Minimal permissions**: only what's required for sync
- **Transparent**: open source, comprehensive privacy policy
- **Chrome Web Store compliant**: meets all CWS developer-program policies

See [PRIVACY.md](PRIVACY.md) for the complete privacy policy.

## Development

Key files:

- `extension/manifest.json` — extension metadata + permissions
- `extension/background.js` — service worker, sync scheduler
- `extension/oauth.js` — Raindrop.io OAuth flow
- `extension/options.html` / `options.js` — settings UI
- `extension/popup.html` / `popup.js` — toolbar popup
- `extension/modern-ui.css` — shared styling
- `cloudflare/worker.js` — optional OAuth proxy (managed mode)
- `scripts/build.js` — packages `extension/` into `dist/folio-vX.Y.Z.zip`

### Releasing

See [BUILD.md](BUILD.md). Single source of truth for release notes is [CHANGELOG.md](CHANGELOG.md); pushing a `v*` tag triggers the GitHub Release workflow.

## Troubleshooting

- Ensure Redirect URI matches `https://<EXTENSION_ID>.chromiumapp.org/`
- Check service-worker logs in `chrome://extensions`
- Use **Copy Diagnostics** in the options page when filing an issue

## License

MIT
