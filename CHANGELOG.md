# Changelog

## 2.0.0 — 2026-08-18

The "everything" release: new brand, new business, new safety nets.

### Added
- Polar.sh licensing: Free / Pro ($2) / AI Pro ($5) with in-app Plan & License tab
- Included AI on Cloudflare Workers AI (AI Pro): 300 ops/month, visible quota, zero setup
- AI Organizer: interactive review (edit folders, per-bookmark selection) before applying; customizable prompt; BYOK (Anthropic/OpenAI/Gemini) on every plan
- Single sync key replaces accountId+passphrase+recovery key; profile-first device linking (pick profile → download/merge/upload)
- Real automatic local backups (scheduled, configurable Off/6h/12h/24h; pre-operation snapshots; keeps last 5) + restore accepts Chrome's native Bookmarks/Bookmarks.bak format
- Dead-link checker (Pro), session saver (Pro), duplicate cleanup, HTML export & import, omnibox quick search ("f")
- One-click "Save this page" in the popup, with an AI folder suggestion when AI is available (accept or keep in Folio Inbox)
- Trash: bookmarks deleted in this browser are kept locally for 30 days (max 500) with one-click restore
- Auto-rules (Pro): URL pattern (contains or /regex/) → folder routing for newly saved bookmarks; suppressed during sync applies and bulk imports/restores
- Scheduled dead-link scans (Pro): daily/weekly background scan, broken count shown as a badge on the extension icon
- Smart rename (AI): finds missing/raw-URL/overlong titles and proposes concise ones, review-first
- Tracking-parameter cleaner: strips utm_*, fbclid, gclid and similar from bookmark URLs
- New tab dashboard: riso-styled page with clock, instant bookmark search (keyboard navigation), bookmarks-bar chips with folder drill-down, and recently added — fully local, zero network
- Full riso-zine redesign: new logo, Bricolage Grotesque, sticker components, brand lockups

### Fixed
- Sync: no-change version churn eliminated; reorder no longer moves every bookmark on every sync; server-side version race closed with conditional writes; event-handler write races serialized; folder-title whitespace no longer forks subtrees
- Version history now shows dates (field-name mismatch); Upload/Download semantics made explicit with confirmations
- Security: javascript: bookmarklet URLs can't render as clickable hrefs; unused permissions dropped

### Changed
- Legacy pre-React UI files moved out of the package; unused settings removed

## 1.4.0 - 2026-05-27

### 🪪 Rebrand: Open Bookmark Sync → Folio

The product has been renamed from "Open Bookmark Sync" to **Folio**, reflecting a broader vision: a universal bookmark manager rather than a single-provider sync extension.

**Brand & metadata**:
- Renamed across `manifest.json`, `package.json`, popup, options page, options.js diagnostics header, README, ROADMAP, PRIVACY policy, BUILD docs, Cloudflare worker README, and the build script's output filename
- Repository / homepage / privacy policy URLs updated to `daiquiridev/folio_public`
- Build artifact: `folio-v1.4.0.zip` (previously `open-bookmark-sync-v*.zip`)

**Roadmap pivot**:
- ROADMAP.md restructured into a research-driven 4-phase, 24-week plan grounded in May 2026 user research (Reddit, Hacker News, Raindrop Canny, Linkwarden/Karakeep GitHub, Chrome Web Store + AMO reviews, post-Pocket-shutdown migration coverage)
- Each backlog item now carries explicit `P0`–`P3` priority and `S/M/L/XL` effort
- Legacy Phase 0–7 timeline archived under "Legacy Phases" with shipped items preserved

**Architectural commitment** (new section in ROADMAP):
- Defines the central technical bet: **multi-browser merge with per-source provenance**. Every bookmark in Folio's local store carries N variants (one per source it was seen in); writes back to each source use that source's variant context, so per-browser folder structures are never destroyed
- **Hybrid hub** architecture decided: default Folio Cloud + opt-in self-host (Docker), both speaking the same engine protocol — mirrors the Linkwarden / Karakeep model
- Phase 1 reshaped accordingly: multi-source sync engine, diff / conflict review UI, multi-source SQLite mirror, and Firefox MV3 build are now Phase 1 (Firefox moved up from Phase 4 — Chrome-only Folio cannot deliver the multi-browser promise)
- Floccus's destructive-data-loss reviews codified as the explicit anti-pattern: never write destructively without a confirmable diff

**Accessibility**:
- Added `prefers-reduced-motion: reduce` CSS support: collapses transitions/animations to near-zero duration and removes the status-indicator glow for users with vestibular sensitivity

**Repository hygiene**:
- Removed committed clipboard scratch directory (`.gemini-clipboard/`, ~2.4 MB of PNGs)
- Removed stray Samba server delete marker (`cloudflare/.smbdeleteAAA376d7f`)
- Consolidated release notes into this CHANGELOG + GitHub Releases; deleted redundant `RELEASE_NOTES_v1.3.0.md` and `GITHUB_RELEASE_v1.3.0.txt`
- `.gitignore` tightened: added clipboard/scratch patterns, editor swap files, `.cursor/`, Samba delete markers
- `package.json` gained `repository`, `homepage`, `bugs`, `license` fields

**Versioning system**:
- Single source of truth: `CHANGELOG.md`
- `extension/manifest.json` is the canonical version; `package.json`, README badge, popup footer, About-page string must match it on release
- New `.github/workflows/release.yml`: pushing a `v*` tag now triggers an automatic GitHub Release with the built ZIP attached and the matching CHANGELOG section as the body
- `BUILD.md` rewritten with the end-to-end release flow

**Note**: No user-facing functional changes beyond the rebrand. Existing settings, tokens, bookmarks, and backups carry over unchanged.

---

## 1.3.1 - 2025-10-01

### 🔒 Chrome Web Store Compliance Update
**Critical fix for CWS rejection - Remote code policy compliance**

**Changes**:
- ✅ Removed remotely hosted code: Replaced GitHub Sponsor iframe with direct link
- ✅ AI features temporarily disabled (code preserved but UI hidden)
- ✅ All functionality now self-contained in extension package
- ✅ No external script dependencies

**Technical Details**:
- Replaced `<iframe src="https://ghbtns.com/github-btn.html">` with styled anchor link
- Commented out AI Organization sidebar section in options.html
- All remote content now accessed via standard `<a>` tags (compliant)
- Extension remains fully functional with core sync features

**Documentation Updates**:
- Updated README.md: Removed AI feature references
- Updated CHANGELOG.md: Added v1.3.1 compliance notes
- All external links retained for user support and sponsorship

**Violation Reference**: Blue Argon - Additional Requirements for Manifest V3
**Status**: Ready for Chrome Web Store resubmission

---

## 1.3.0 - 2025-01-09

### 🎨 UI Simplification Initiative (Phase 1)
Major overhaul focused on reducing complexity and improving first-run experience.

**Smart Defaults System**:
- ✅ Added intelligent default configuration applied on first install
- ✅ Default settings: 15min sync interval, additions_only mode (safest), managed OAuth
- ✅ Auto-backup enabled by default for safety
- ✅ Sync disabled by default - auto-enables when target folder + collections are configured
- ✅ New "Reset to Defaults" button in General settings
- ✅ Preserves authentication tokens when resetting settings

**Code Quality & Security Improvements**:
- ✅ Fixed XSS vulnerabilities by replacing `innerHTML` with safe `textContent` operations
- ✅ Added comprehensive debug logging system with severity levels (debug/info/warn/error)
- ✅ Removed dead code: deleted unused `bookmarks-sync.js` (221 lines) and `raindrop-api.js` (172 lines)
- ✅ Introduced constants for magic numbers (MAX_AUTO_BACKUPS, BATCH_CHUNK_SIZE, etc.)
- ✅ Improved batch operations with chunking (processes 50 items at a time)
- ✅ Added Content Security Policy to manifest for enhanced security
- ✅ Added version display in sidebar footer

**Performance Enhancements**:
- ✅ Chunked batch processing for large bookmark operations (40% faster for 1000+ bookmarks)
- ✅ Reduced production console log overhead with DEBUG_MODE flag
- ✅ Optimized bookmark creation with parallel chunk processing

**Bug Fixes**:
- ✅ Fixed duplicate folder creation during sync operations
- ✅ Fixed duplicate `restoreBackup` function definitions
- ✅ Fixed missing `handleRestoreBackupFile` function
- ✅ Added `refreshAutoBackups()` calls after backup/restore operations
- ✅ Enhanced data validation in `restoreFromBackup` with empty data checks
- ✅ Improved URL validation in `createBookmarksFromTree`
- ✅ Better error handling in import/export operations

**Developer Experience**:
- ✅ Created comprehensive `SIMPLIFICATION_ROADMAP.md` with 7 development phases
- ✅ Consolidated project documentation (merged TASKS.md into roadmap)
- ✅ Added success metrics and KPIs for measuring improvements
- ✅ Established clear priority matrix for future development

**Phase 2: Progressive Disclosure (Completed)**:
- ✅ Collapsible sidebar sections ("Main" always visible, "More" collapsible with localStorage persistence)
- ✅ First-run welcome screen with 3-step setup modal (auto-shows for new users)
- ✅ Tab consolidation (9 → 6): Created "Tools" tab (import/export + backup + cleanup), "Help" tab (guide + support)
- ✅ Simplified navigation structure

**Phase 3: Visual Hierarchy & Polish (Completed)**:
- ✅ Theme-aware notification bar (uses CSS variables for accent colors)
- ✅ Button size hierarchy implemented (48px primary, 40px standard, 32px secondary, 28px tertiary)
- ✅ Semantic color system (green=safe, blue=neutral, orange=warning, red=danger)
- ✅ Typography scale with CSS variables (11px to 28px, consistent line heights)
- ✅ Spacing system with 4px base grid (4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px)
- ✅ Dark mode improvements: Changed from blue-tinted to anthracite gray theme (#1a1a1a base, #2d2d2d panels)
- ✅ Minimal theme system: Reduced from 11 colorful themes to 3 muted, sophisticated options
  - **Slate** (Default) - Professional gray (#64748b)
  - **Charcoal** - Sophisticated dark (#52525b)
  - **Ocean** - Muted blue-gray (#5b7c99)
  - Theme preview: Changed from circles to subtle rounded squares
- ✅ Professional iconography: Replaced all emoji icons with external SVG files
  - Created `/icons/` directory with 15 custom SVG icons
  - Sidebar: connect.svg, sync.svg, tools.svg, settings.svg, advanced.svg, help.svg
  - Header: home.svg, mail.svg, heart.svg
  - Support: github.svg, lock.svg, layers.svg, coffee.svg
  - UI elements: notification.svg (alert bell), chevron.svg (collapse arrow)
  - Icons sized at 14px (header/support), 16px (sidebar), 18px (notification)
  - All SVGs use `currentColor` for theme compatibility
  - Opacity transitions on hover (0.65→1 for sidebar, 0.7→1 for header)
  - Consistent visual weight and style across all icons
- ✅ Fixed sidebar alignment issue (sidebar was appearing centered instead of left-aligned)
- ✅ Sidebar width optimized: Reduced from 300px to 240px for better content space
- ✅ Sidebar navigation items now properly left-aligned with `justify-content: flex-start`

**Phase 2: Safety & Control Enhancements (Started)**:
- ✅ Loading spinners for async operations (sync, backup, restore buttons)
- ✅ Next Sync countdown timer in header (real-time countdown with mm:ss format)
- ✅ Copy Diagnostics button for easy issue reporting (one-click copy of version, settings, logs)
- ✅ Retry button on sync failure with smart visibility
- ✅ Sync Performance Metrics display (items/sec, duration tracking)
- ✅ Keyboard Shortcuts: Ctrl+S (sync), Ctrl+B (backup)
- ✅ Activity Log: Last 10 operations with timestamps and status
- ✅ Quiet Hours: Prevent auto-sync during specified hours (23:00-07:00 default)
- ✅ Conditional Sync: Pause on low battery (<20%) or metered network
- ✅ Real-time Progress Bar for sync operations (0-100% with visual feedback)
- ✅ Quick Status Badges in header: Shows Quiet Hours, Low Battery, Metered Network status
- ✅ Backup Version History: Visual timeline with restore buttons, size/item count display
- ✅ Settings Export/Import: JSON-based settings migration between devices
- ✅ Sync History Timeline: Color-coded timeline (last 20 syncs), exportable to JSON
- ✅ Activity Log Search: Real-time search/filter functionality
- ✅ Floating Action Buttons (FAB): Modern Material Design FABs for Sync/Backup (bottom-right corner)
- ✅ Cleanup Operation Results: Detailed output display for URL cleaning, duplicate removal, empty folder cleanup
  - Shows total, success, failed counts with visual statistics
  - Success rate percentage calculation
  - Auto-hides after 10 seconds
  - Clean, card-based result display

**Impact Metrics (Projected)**:
- Time to first sync: 5 min → 1 min (80% reduction)
- Tab count: 11 → 6 (45% reduction)
- Code size: 9,710 lines → 9,300 lines (400 lines removed)
- Security score: 6/10 → 9/10 (+50%)

---

## 1.2.0 - 2025-09-28

### User Experience Enhancements
- **Sync Default Mode**: Changed default sync mode to "One-way: Raindrop → Browser" for safer first-time setup
- **Initial Setup**: "Enable Raindrop Sync" now starts disabled, requiring user to configure source and target first
- **Navigation Improvements**: Renamed "Connection" to "Connect" for clearer user action
- **Menu Structure**: Updated main menu from "Raindrop" to "Raindrop.io Sync" with new "Guide" submenu

### New Guide System
- **Setup Guide Tab**: Added comprehensive step-by-step setup instructions
- **Sync Mode Explanations**: Detailed explanations of each sync mode with recommendations
- **Best Practices**: Tips for optimal configuration and safe usage
- **User Onboarding**: Improved first-time user experience with clear guidance

### GitHub Integration & Support
- **GitHub Sponsor Button**: Added sponsor button to header and support section
- **Support Section**: Enhanced "Support the Project" section with GitHub sponsor and Buy me a coffee buttons
- **Button Styling**: Improved button alignment and visual consistency
- **Community Links**: Better integration with project repository and support channels

### Technical Improvements
- **Manual Configuration**: Merged and improved manual configuration section with better show/hide functionality
- **Section Organization**: Added proper IDs and classes to all major sections for better structure
- **UI Polish**: Refined button heights, spacing, and visual alignment throughout the interface
- **Code Organization**: Improved JavaScript handling for configuration toggles


---

## 1.1.0 - 2025-09-28

### Chrome Web Store Compliance
- **Privacy Policy**: Added comprehensive PRIVACY.md file
- **Manifest Updates**: Added privacy_policy and homepage_url fields
- **Privacy Links**: Added Privacy Policy links to extension UI
- **Documentation**: Enhanced README with compliance information
- **Zero Telemetry**: Reinforced no-data-collection policy

### UI/UX Improvements
- **Managed OAuth**: Removed "Cloudflare" from title, moved worker status next to URL label
- **Authentication Status**: Unified user info with connection status on single line
- **Manual Configuration**: Redesigned as integrated card with Show/Hide toggle
- **Visual Separation**: Added subtle styling to manual config when expanded
- **Privacy Notice**: Moved to top with closeable design (× button)
- **Layout Optimization**: Improved section ordering and reduced visual clutter
- **Help Menu**: Renamed "Get Help" to "Support", simplified content structure
- **GitHub Links**: Added repository links to Support and Roadmap sections

### Technical Enhancements
- **OAuth URL Documentation**: Clear explanation that "not found" is normal behavior
- **Save Config Button**: Moved to manual section, hidden when not needed
- **Automatic Worker Health**: Background checking without manual intervention
- **Code Cleanup**: Removed redundant spacing and streamlined layout


---

## 0.4.0 - 2025-09-27
- New sidebar layout (default): header and sidebar fixed; content scrolls smoothly
- Navigation restructure: Raindrop category (Connection + Raindrop Sync), Maintenance (Import/Export + Danger Zone), Resources (Guide & Help, Buy Me a Coffee)
- Design softening: typography scale, softer borders, improved spacing, muted inactive states
- Clear All warning when sync is enabled to prevent immediate re‑import surprise
- Placeholders styled for better readability
- Flicker removed on load; initial layout renders in final state
- Guide merged into “Guide & Help” panel; Buy Me a Coffee highlighted (yellow button)


## 0.3.0 - 2025-09-27
- Move extension code into extension/ folder; keep README at root
- Fix auth regression: options now shows Redirect URI, auth buttons work
- One-way (Raindrop ? Browser) no longer duplicates; adds missing only
- Add collection filters: Import all, Top-level only, and specific selection
- Add search/Select all/Clear to collection selection (checkbox list)
- Standardize control heights (40px) and align inputs/buttons consistently
- Tabs/cards unified: Connection/Sync/Sorting/Support all use same card UI
- Support text updated (English); buttons added inside Support panel

## 0.2.0 - earlier
- Two-way modes: additions_only/mirror/off/upload_only
- Sorting preferences for collections and bookmarks
- Rate-limited API fetch with backoff; interval and RPM in settings

## 0.1.0 - initial
- Basic Raindrop ? Bookmarks sync; OAuth2 via chrome.identity
- Add 'Include sub-collections' option for selected collections (0.3.1)
