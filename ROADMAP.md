# Folio — Product Roadmap

**Last Updated**: 2026-05-27
**Current Version**: v1.4.0
**Status**: Active Development — pivoting to a research-driven 4-phase plan

---

## 🎯 Vision & Mission

**Mission**: Make bookmark management frictionless across every browser, capture surface, and platform — without forcing users to organize, search, or remember on their own.

**Vision**: Become the universal bookmark layer. Cross-browser, AI-organized, retrieval-first, and platform-agnostic. The user's saved web doesn't live in a graveyard; it comes back to them when they need it.

---

## 🔍 Research Context (May 2026)

The 4-phase plan below is grounded in a broad sweep of user research: Reddit (r/bookmarks, r/PKMS, browser subs), Hacker News, Raindrop's Canny board, Linkwarden / Karakeep GitHub issues, Chrome Web Store + Firefox Add-ons reviews, ProductHunt + G2, and post-Pocket-shutdown migration coverage (TabMark, WebCull, Pinnzo, DEV.to, Zapier, TechCrunch, 9to5Mac).

**Headline findings**:

- **Pocket's July 2025 shutdown** is the largest disruption in the category. Refugees demand offline access, page archival, and explicit data portability.
- **Raindrop's #1 9-year open Canny request: offline support.** Voters say they'd pay significantly more for it.
- **The bookmark graveyard is consensus**: ~30–40% link-rot in 3-year-old libraries (Harvard / Internet Archive data); users estimate <5% of saves are ever revisited.
- **Cross-browser sync silos** are the structural pain. Floccus is the leading bridge but has 1-star reviews citing destructive data loss — clean opening for a safer alternative.
- **The save flow is a friction point**, not just retrieval: "extension aç → tıkla → klasör seç → kaydet" (4-5 steps) makes users give up and fall back to chaotic native bookmarks.
- **Market has bifurcated** into AI auto-organization (mymind, Markwise, Karakeep) and self-hosted privacy (Linkwarden, Karakeep, Shaarli, Wallabag). Raindrop sits awkwardly between them.
- **Raindrop-specific gaps**: shallow AI tagging (reads title/URL only, not full page content), lossy restore (folder icons and hierarchy disappear), iOS share-sheet freezes Safari, no real tag hierarchies for power users with 10k+ items, single-developer / single-cloud anxiety.

---

## 🧭 Core Architectural Commitment: Multi-Browser Merge with Provenance

This is the central technical bet that makes Folio different from any existing bookmark manager. Every item in the 4-phase plan below is in service of it.

### The Promise

A single Folio identity that you log into from every browser you use. Folio reads your bookmarks from each browser **continuously** (not as a one-off import), merges them into a unified view, and writes changes back to every source — **without losing the unique structure each browser has**.

This is what Floccus tries to do via WebDAV / cloud sync, and why its 1-star reviews cite destructive data loss: it merges without preserving per-source context, then writes back lossy. Folio fixes this with first-class provenance tracking and a mandatory diff before any destructive write.

### Data Model: Per-Source Provenance

Every bookmark in Folio's local store carries N variants, one per source it was seen in:

```
bookmark {
  canonical_url
  variants: [
    { source: "chrome:Profile1",  folder_path: ["Work", "Tools"], title: "X",    date_added, last_seen },
    { source: "firefox:default",  folder_path: ["Saved"],         title: "X v2", date_added, last_seen },
    { source: "raindrop",         collection: "#col42",           tags: [...],   date_added, last_seen },
  ]
  unified: { title, primary_folder, tags }  // user-editable; default derived from variants
}
```

When Folio writes back to a source, it uses **that source's variant context** — Chrome gets the Chrome path, Firefox gets the Firefox path. A bookmark deleted in only one source becomes a one-variant deletion, not a global delete.

### The Hub: Hybrid Architecture

Browser extensions can't talk to each other directly — a hub is required as the merge authority.

| Mode | Who runs it | When |
|------|-------------|------|
| **Folio Cloud** (default) | Folio infrastructure | Out of the box; one-click "log in with Folio" on each browser. |
| **Self-Hosted** (opt-in) | The user, via Docker | For the privacy-first / single-cloud-anxiety cohort. Same engine, same protocol. |

Both modes speak the same engine protocol. A user can migrate Cloud → Self-Hosted (or vice versa) by re-pointing each extension. Mirrors the [Linkwarden / Karakeep](https://github.com/karakeep-app/karakeep) model that the research identified as the self-hosted category leader.

### Conflict Resolution = First-Class UX

Multi-source merge produces continuous conflicts (rename in browser A, move in browser B, delete in C). Floccus's mistake was hiding this. Folio surfaces every non-trivial conflict in a **diff review UI** before any destructive write, with three options: accept-one-side, accept-both-as-variants, or skip.

### Open Architectural Questions

- **Engine protocol shape**: REST + websockets vs. CRDT-based sync? (CRDT solves conflicts at the data layer but is materially harder to ship correctly.)
- **Cloud vs self-host launch order**: ship cloud first (faster to user value) or self-host first (OSS-first community momentum)?
- **Pricing**: cloud hub free with paid tier (AI / larger libraries)? Self-host free forever?
- **Browser support order**: Chrome + Firefox first (≈75% of users), then Safari, Edge, Brave, Arc, Zen as fast-follow — confirmed?

---

## 🗺️ Active Roadmap (24-week plan)

**Priority legend**: `P0` ship-critical · `P1` next-up · `P2` important · `P3` nice-to-have
**Effort legend**: `S` days · `M` ~1 week · `L` 2–3 weeks · `XL` 4+ weeks

---

### Phase 1 — Foundation (Weeks 1–4)

**Goal**: Make capture frictionless, make import lossless, make data searchable everywhere.

- [ ] **1-Click Save (frictionless capture)** · `P0` · `M`
  Right-click → save. Collapse the popup to a single action. Organize-later workflow. Addresses the #1 friction complaint in Raindrop reviews.
- [ ] **Universal Bookmark Importer** · `P0` · `L`
  Chrome / Firefox / Safari / Edge / Pocket export, in one flow. Preserve folder hierarchy, icons, and order — Raindrop's own restore loses these, which is the wedge for new-user acquisition.
- [ ] **Fuzzy duplicate detection on import** · `P0` · `M`
  URL canonicalization + title similarity + redirect-chain resolution. Most existing dedupers match raw URL only and miss the noisy overlaps when users combine multi-browser exports.
- [ ] **Local SQLite mirror with multi-source provenance** · `P0` · `L`
  Kept fresh in the background. Stores N variants per bookmark, one per source (Raindrop + each connected browser). Prerequisite for the merge engine, offline access, full-text search, dead-link checks, and bulk operations. Also closes the 9-year-old Raindrop Canny offline-support ticket as a side effect.
- [ ] **Multi-source sync engine with per-source variant tracking** · `P0` · `XL`
  The heart of the [Core Architectural Commitment](#-core-architectural-commitment-multi-browser-merge-with-provenance). Continuous bidirectional ingest from each connected source (Raindrop + N browsers). Writes back use that source's variant context — Chrome path stays Chrome, Firefox path stays Firefox. No lossy merge.
- [ ] **Diff / conflict review UI before destructive writes** · `P0` · `L`
  Every non-trivial conflict (rename / move / delete divergence between sources) is surfaced for review. Three actions per conflict: accept-one-side, accept-both-as-variants, or skip. The Floccus-avoidance pillar — its destructive-data-loss reviews are the cautionary tale that drives this requirement.
- [ ] **Firefox MV3 build — first non-Chrome source for the merge engine** · `P0` · `L`
  Chrome-only Folio cannot deliver the multi-browser promise. Firefox covers the next-largest user base and validates the engine's source-agnostic design. (Moved from Phase 4 — the architectural commitment makes this a Phase 1 precondition.)
- [ ] **Universal full-text search** · `P0` · `L`
  Index page content, not just titles. Local-first; runs against the multi-source SQLite mirror. Chrome bookmark search is title-only; Raindrop full-text is Pro-tier.
- [ ] **Tab-group capture** · `P1` · `S`
  Right-click a Chrome / Edge tab group → Raindrop collection of the same name. Highly upvoted Raindrop Canny ticket; small, contained shipping unit.

---

### Phase 2 — AI Organization Layer (Weeks 5–10)

**Goal**: Stop forcing users to manage tags and folders themselves. Manual tagging fatigue is what kills Raindrop usage.

- [ ] **AI auto-tagging from full page content** · `P1` · `L`
  Reads the page, not just title/URL. User accepts/rejects suggestions. Raindrop's Stella reads only metadata — this is its biggest open AI complaint.
- [ ] **Local AI option (Ollama / WebLLM)** · `P1` · `M`
  Privacy-first alternative to cloud AI. Mirrors Karakeep's killer differentiator and answers the self-hosted cohort's primary objection to cloud bookmark managers.
- [ ] **AI smart foldering** · `P1` · `L`
  Learn the user's existing folder structure; route new saves to the right place automatically. Distinct from tagging; addresses the "I have 50 folders and don't know where to put this" problem.
- [ ] **Natural-language search** · `P1` · `M`
  Semantic queries like "geçen hafta kaydettiğim python makaleleri." Runs over the mirror + page-content index.
- [ ] **Auto page summary** · `P1` · `M`
  Short AI summary per link. Shown on hover and in detail view. Helps users decide what to revisit without re-reading the whole page.
- [ ] **Bulk "tag my entire library"** · `P2` · `M`
  One-click AI pass over the whole mirror. Directly addresses the bulk-tagging request on Raindrop's AI Canny ticket. Requires Phase 1 mirror.
- [ ] **Tag hierarchy & merge UI** · `P2` · `M`
  Real parent / child trees with merging and aliasing, layered on top of Raindrop's slash-tag syntax. For users with 1k+ tags (one Canny voter reported 16k bookmarks / 1.5k tags).

---

### Phase 3 — Retrieval & Reminders (Weeks 11–16)

**Goal**: Resurrect the graveyard. Saved content has to come back to the user, or it's just storage.

- [ ] **Spaced-repetition resurfacing** · `P1` · `M`
  "Bunu 3 ay önce kaydetmiştin." Surface neglected saves on a schedule. Category-defining feature; almost no one in the bookmark space does this.
- [ ] **Read-later vs reference toggle + Inbox surface** · `P1` · `S`
  Pocket refugees explicitly want this distinction. Cheap to ship as a flag + UI convention.
- [ ] **Broken-link detector** · `P2` · `M`
  Background sweep of the mirror; flag dead links. ~30–40% of links die within 3 years.
- [ ] **One-click Wayback Machine substitution** · `P2` · `S`
  When a link is dead, swap in the closest archived version. No major tool does this automatically today.
- [ ] **"Archive on save" — local offline HTML + readability copy** · `P2` · `L`
  Snapshot every saved page locally. Pocket-refugee table stake; also a hedge if Raindrop ever disappears. Privacy-first because the archive lives on the user's disk.
- [ ] **Clean reader mode with highlights** · `P2` · `M`
  Reader-mode rendering of the archived copy, with text highlighting that persists. Pocket refugees' explicit ask; Readwise Reader's strongest feature. Builds on top of Archive on save.
- [ ] **Collection & project view (kanban / board)** · `P2` · `M`
  Project-based grouping beyond flat folders. For users running research projects across collections.

---

### Phase 4 — Platform Expansion (Weeks 17–24)

**Goal**: Bring every remaining surface into the merge engine — Safari, iOS, non-browser sources, PKM destinations, and the self-host backend. (Chrome + Firefox already in via Phase 1.)

- [ ] **Safari Web Extension port — additional source for the merge engine** · `P2` · `L`
  Mac / iOS ecosystem. Brings native bookmarks from Safari into the multi-source engine. Required for the iOS share-extension companion below.
- [ ] **Edge / Brave / Arc / Zen extension validation** · `P2` · `M`
  Chromium-derivatives largely come free with the Chrome MV3 build; this item covers per-browser packaging, manifest tweaks, and validation in each store / sideload flow.
- [ ] **iOS Share-extension companion** · `P2` · `L`
  PWA share_target or thin native wrapper. Mobile capture quality is table stakes for Pocket refugees; Raindrop's iOS share-sheet is the most-complained-about bug.
- [ ] **YouTube / Twitter / Instagram capture** · `P2` · `XL`
  Cross-platform hub. Pulls saves from non-browser surfaces into the same library. This is the move from "browser extension" to "universal bookmark layer."
- [ ] **Newsletter ingestion (email-to-bookmark)** · `P2` · `M`
  Dedicated inbox address per user; newsletters arriving there become saves with reader-mode rendering. Pocket / Omnivore-era expectation; recurring ask from PKM users.
- [ ] **"Send to Obsidian / Notion / Readwise"** · `P2` · `M`
  PKM workflow integration. Obsidian via local vault write, Notion via API. Repeatedly requested across PKM threads.
- [ ] **One-click portable export (Markdown + browser-bookmarks HTML)** · `P2` · `S`
  "Pocket-proof your library." Marketable line post-Pocket-shutdown.
- [ ] **Optional bridge to Linkwarden / Karakeep** · `P3` · `M`
  Multi-backend write target. Hedges against single-cloud anxiety; bridges the Raindrop user base and the self-hosted cohort.
- [ ] **API + Zapier / n8n integration** · `P3` · `M`
  Power-user automation surface.
- [ ] **Sharing & collaboration** · `P3` · `L`
  Share collections, team workspaces.
- [ ] **Self-host option (Docker)** · `P3` · `XL`
  Addresses single-cloud anxiety; serves the Linkwarden / Karakeep cohort directly. Requires a server component, which is itself a platform decision.

---

## 📊 Impact × Effort Matrix

|                    | **Low Effort**                                                                                                                        | **High Effort**                                                                                                                                                                                |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **High Impact**    | 🚀 **Do now**: 1-Click Save · Tab-group capture · Read-later/reference toggle · Wayback substitution · Portable export                | 📅 **Plan**: **Multi-source sync engine** · **Diff / conflict review UI** · **Firefox MV3** · Multi-source SQLite mirror · Universal importer · Full-text search · AI auto-tagging · Local AI · Archive on save · Reader mode |
| **Low Impact**     | ✨ **Small wins**: Auto page summary · Broken-link detector · Spaced repetition (prototype) · Collection view · Newsletter ingestion  | 🤔 **Long-term**: YouTube/Twitter/Instagram capture · Self-host · API & Zapier · Sharing & collaboration                                                                                       |

**Recommended starting order** (architectural commitment first):
1. Multi-source SQLite mirror with provenance (data model foundation)
2. Multi-source sync engine — start with Chrome + Raindrop, prove the engine
3. Diff / conflict review UI — must ship before any destructive write
4. Firefox MV3 build — validates source-agnostic design with a real second browser
5. 1-Click Save (frictionless capture)
6. Universal Importer + fuzzy dedup (bulk-ingest path for new sources)
7. Universal full-text search
8. AI auto-tagging (cloud first, then local Ollama option)
9. Spaced-repetition resurfacing

---

## 🎯 Open Questions Before Locking In

Decided (see [Core Architectural Commitment](#-core-architectural-commitment-multi-browser-merge-with-provenance)):
- ~~Platform direction~~ → **Hybrid hub** (Folio Cloud default + opt-in self-host); browser extensions in each browser talk to the hub. Phase 4's `iOS Share-extension companion` and `Self-host option (Docker)` are the two surfaces of this.

Still open:
- **Engine protocol shape**: REST + websockets vs. CRDT-based sync? CRDT solves conflicts at the data layer but is materially harder to ship correctly and harder to audit.
- **Cloud vs self-host launch order**: ship cloud first (faster to user value) or self-host first (OSS-first community momentum, hedges single-developer anxiety from day 1)?
- **AI default**: cloud-first (easier, faster, higher quality) or local-first (privacy, runs without the hub being up)?
- **Pricing model**: cloud hub free + paid tier (AI / larger libraries / team sharing)? Self-host free forever? Affects what we build first.
- **Browser support order after Chrome + Firefox**: Safari (Mac/iOS reach) vs Edge/Brave/Arc/Zen (largely free off Chrome MV3)? Different effort/value curves.

---

## 🤝 How to Contribute

We welcome contributions!

1. **Pick a task** from any phase (preferably `P0` or `P1`)
2. **Create a branch**: `feature/task-name`
3. **Implement & test** thoroughly
4. **Submit PR** with:
   - Screenshots / GIFs of changes
   - Test results
   - Updated checkbox in this roadmap
5. **Get review** and merge!

---

## 📞 Feedback & Discussions

- **GitHub Issues**: Report bugs or request features
- **GitHub Discussions**: Share ideas and get help
- **Buy Me a Coffee**: Support development

---

## 📈 Success Metrics & KPIs

### User Experience
- Time to first sync: **< 1 minute**
- Setup abandonment rate: **< 10%**
- Save-flow steps (capture friction): **≤ 2 clicks** (Phase 1 goal)
- User satisfaction (NPS): **> 8/10**

### Technical
- Code coverage: **> 80%**
- Performance (1000 bookmarks sync): **< 10 seconds**
- Memory usage: **< 50MB**
- Crash rate: **< 0.1%**
- Full-text search latency (10k items): **< 200ms** (Phase 1 goal)

### Adoption
- Active users: **10,000+ by end of 2026**
- Chrome Web Store rating: **> 4.5/5**
- GitHub stars: **> 500 by end of 2026**
- Cross-browser install share: **≥ 30% non-Chrome by end of Phase 4**

---

## 📜 Legacy Phases (pre-pivot, archived for context)

The phases below describe the v1.0 → v1.3.1 trajectory before the May 2026 research-driven pivot. Checked items are shipped and live in the current extension; unchecked items have been folded into the 4-phase plan above where they still apply.

### ✅ Phase 0: Foundation & Stability (COMPLETED — Dec 2024)

- [x] OAuth2 authentication with Raindrop.io
- [x] Basic Raindrop ↔ Browser sync
- [x] Multiple sync modes (mirror, additions_only, upload_only, one-way)
- [x] Collection filtering and sorting
- [x] Rate-limited API with exponential backoff
- [x] Chrome Web Store compliance (privacy policy, manifest v3)
- [x] Automatic backup system before destructive operations
- [x] Emergency restore functionality
- [x] Duplicate detection and cleanup
- [x] Safe defaults (one-way sync by default)
- [x] Fixed XSS vulnerabilities (innerHTML → textContent)
- [x] Added debug logging system
- [x] Removed dead code (bookmarks-sync.js, raindrop-api.js)
- [x] Added constants for magic numbers
- [x] Improved batch operations with chunking (50 items/chunk)
- [x] Added Content Security Policy

### ✅ Phase 1 (legacy): UI Simplification (COMPLETED — Jan 2025)

- [x] Smart defaults implementation (auto-apply on first install)
- [x] "Reset to Defaults" button in settings
- [x] Popup simplification (removed settings dropdowns, single sync button)
- [x] Tab renaming for clarity (emoji icons, clearer names)
- [x] Collapsible sidebar sections
- [x] First-run welcome screen with 3-step setup modal
- [x] Tab consolidation (9 → 6)
- [x] Theme-aware notification bar
- [x] Button size hierarchy
- [x] Semantic color system
- [x] Typography scale
- [x] Consistent spacing (4px base grid)

### 🟡 Phase 2 (legacy): Safety & Control Enhancements (PARTIAL)

- [x] Loading spinners for async operations
- [x] Next Sync countdown timer in header
- [x] Copy Diagnostics button for support
- [x] Retry button on sync failure
- [x] Sync Performance Metrics display
- [x] Keyboard Shortcuts (Ctrl+S, Ctrl+B)
- [x] Activity Log (last 10 operations)
- [x] Quiet Hours (pause sync during specified times)
- [x] Conditional Sync (pause on low battery/metered)
- [x] Real-time Progress Bar for sync operations
- [x] Quick Status Badges in header
- [x] Backup versioning (last 10, visual history viewer with restore)
- [x] Export/import settings as JSON
- [x] Reduced motion option (`prefers-reduced-motion` CSS)
- _Folded into the active 4-phase plan_: dry-run / preview system, automatic snapshot before sync, "Undo last sync", backup compression, no-delete safe mode

### 📜 Phase 3–7 (legacy): folded into the active plan above

Per-collection controls, advanced filtering, performance & resilience, multi-provider support, cloud-storage backends, multi-profile, accessibility, localization, mobile, AI organization, collaboration, analytics — all of these are reorganized into the active 4-phase plan or moved into Phase 4 (Platform Expansion). The original detailed list is preserved in git history (see `ROADMAP.md` before commit `7dfa6e7`).

---

**Note**: This roadmap is a living document and will be updated based on user feedback, technical constraints, and changing priorities.
