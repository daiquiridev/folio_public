# Chrome Web Store Başvuru Kiti — Folio v2.0.0

Başvuru formunu doldururken buradan kopyala.

## Store description (EN)

**Kısa (özet):**
Bookmark manager with end-to-end encrypted cross-browser sync, Raindrop.io
integration, AI-powered organization, and powerful cleanup tools.

**Uzun:**
Folio keeps your bookmarks organized, synced, and clean — without ever giving
up your privacy.

🔐 END-TO-END ENCRYPTED SYNC
Sync bookmarks across Chrome, Brave, Edge and any Chromium browser with ONE
sync key. Your data is encrypted on your device — our servers only ever see
ciphertext. Multiple profiles (Work / Personal / per-browser) can share a
single account, with version history and restore.

💧 RAINDROP.IO INTEGRATION
Two-way sync between your browser bookmarks and Raindrop.io collections.

✨ AI ORGANIZER
Let AI group your bookmarks into sensible folders — then review, edit and
approve every suggestion before anything moves. Smart rename fixes missing or
ugly titles. One-click save suggests the right folder for each new bookmark.
Use the built-in AI (AI Pro plan, zero setup) or bring your own
Anthropic/OpenAI/Gemini API key on any plan. The prompt is fully customizable.

🧹 CLEANUP TOOLS
Duplicate finder with safe one-click cleanup, dead-link checker with scheduled
scans, empty-folder cleaner, tracking-parameter stripper (utm, fbclid…),
session saver, HTML import, and standard HTML export (your data is never
locked in).

🗑️ TRASH & AUTO-RULES
Deleted bookmarks are kept locally for 30 days with one-click restore. Route
new bookmarks into folders automatically with URL pattern rules.

🗂 NEW TAB DASHBOARD
Every new tab becomes your bookmark hub: a clock, instant full-text bookmark
search (arrow keys + Enter), your bookmarks bar as one-click chips, and your
most recently added bookmarks. No feeds, no ads, no tracking — just your own
stuff, loaded locally and instantly.

⚡ QUICK SEARCH
Type "f" + space in the address bar to search your bookmarks instantly.

FREE, forever: bookmark manager, new tab dashboard, one-click save, Raindrop sync, encrypted
cloud sync (single profile), AI with your own key, duplicate cleanup, trash,
tracking cleaner, HTML import/export, quick search.
PRO ($2/mo): multiple profiles, version history & restore, dead-link checker
with scheduled scans, auto-rules, session saver, extension-list backup.
AI PRO ($5/mo): everything plus 300 built-in AI operations per month
(organize, folder suggestions, smart rename) with zero setup.

No analytics. No tracking. No ads. Open development:
https://github.com/daiquiridev/folio_public

## Category / dil

- Category: **Productivity → Tools**
- Language: English

## Privacy practices sekmesi — izin gerekçeleri

| Permission | Justification (EN — forma yapıştır) |
|---|---|
| `bookmarks` | Core purpose: reading and organizing the user's bookmarks. |
| `storage` | Stores settings, local automatic backups, and the encrypted sync state. |
| `alarms` | Schedules periodic sync and automatic local backups. |
| `identity` | Used only for the optional Raindrop.io OAuth sign-in (launchWebAuthFlow). |
| `management` | Powers the optional "extension list backup" feature: reads installed extension names/ids and stores them ONLY inside the user's end-to-end encrypted backup. Never transmitted in plaintext. |
| `tabs` | Powers the optional "session saver" (bookmarks the current window's open tabs on explicit click) and opening results from the omnibox quick search. |
| Host: `api.raindrop.io`, `raindrop.io` | Optional Raindrop.io integration (user-initiated OAuth + API). |
| Host: `*.daiquiri.dev` | First-party services: encrypted sync storage, OAuth helper, metered AI endpoint. |
| Host: `api.polar.sh` | License key activation/validation for paid plans (merchant of record). |
| Host: `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` | Bring-your-own-key AI providers; contacted only when the user configures a key and runs an AI action. |
| `chrome_url_overrides.newtab` | Replaces the new tab page with a dashboard of the user's own bookmarks (clock, instant search, bookmarks-bar shortcuts, recently added). Directly serves the extension's single purpose of bookmark management; loads only local data, makes no network requests, shows no ads or feeds. |

**Single purpose:** Bookmark management (organizing, syncing, and cleaning
the user's bookmarks).

**Data use bildirimi:** "Website content" toplanmıyor; "User activity"
toplanmıyor; "Personally identifiable information" toplanmıyor. Bookmarks =
"User-provided content", yalnız kullanıcının açtığı sync özelliğiyle,
şifreli olarak işleniyor → formda: *data is encrypted in transit and at
rest; not sold; not used for unrelated purposes; not used for creditworthiness*.

**Privacy policy URL:** form herkese açık URL zorunlu tutar. Hazır seçenek:
`https://github.com/daiquiridev/folio_public/blob/main/PRIVACY.md`
(repo public olduğu sürece geçerli; ileride bubblenet.dev/folio/privacy'ye taşınabilir).

## Görsel gereksinimleri (senin hazırlaman gerekenler)

- **Screenshot** (zorunlu, 1–5 adet): 1280×800 veya 640×400 PNG.
  Önerilen kareler: Options ana görünüm (riso tema), AI review ekranı,
  Cloud Sync profil seçimi, Tools (duplicate/dead-link), popup.
- **Small promo tile** (440×280) — zorunlu değil ama önerilir.
- Store icon: `extension/icon128.png` hazır (branding/logo.svg'den).

## Yükleme

```bash
npm run build            # dist/folio-v2.0.0.zip üretir
```
Zip'i https://chrome.google.com/webstore/devconsole adresinden yükle.
İlk yayın incelemesi tipik olarak 1–3 iş günü sürer; `management`, `tabs`
ve özellikle `chrome_url_overrides` (yeni sekme değiştirme) ek inceleme
tetikleyebilir — gerekçe metinleri yukarıda hazır. Yeni sekme sayfası,
listing açıklamasında ve ekran görüntülerinde açıkça gösterilmeli ki
kullanıcı sürpriz yaşamasın (kötü yorumların 1 numaralı kaynağı budur).
