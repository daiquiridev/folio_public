# Folio — Privacy Policy

_Last updated: 2026-08-18 (v2.0.0)_

Folio is a bookmark manager. This policy explains exactly what data the
extension touches, where it goes, and what never leaves your device.

## The short version

- **No analytics, no tracking, no ads.** Folio contains no telemetry of any kind.
- **Your bookmarks are yours.** Cloud sync is end-to-end encrypted — our server
  stores only ciphertext it cannot read.
- **Nothing is sent anywhere without a feature you explicitly enabled.**

## Data handling by feature

### Bookmarks (core)
Read and modified locally via Chrome's bookmarks API. Stored by your browser.
Local automatic backups (if enabled) are stored in the extension's local
storage on your device only.

### Encrypted Cloud Sync (optional)
When you enable cloud sync, your bookmarks are encrypted **on your device**
with a key derived from your sync key (AES-256-GCM; the key never leaves your
device) and the resulting ciphertext is stored on our server
(`sync.folio.daiquiri.dev`, Cloudflare R2). We cannot decrypt your data. The
server keeps up to 20 encrypted versions for history/restore. Deleting your
account data ("Discard backup & start over") permanently removes all of it.

### Raindrop.io integration (optional)
If you connect Raindrop.io, Folio talks to the Raindrop API
(`api.raindrop.io`) with an OAuth token to read/write your Raindrop
collections. The managed sign-in flow exchanges OAuth codes through our helper
service (`oauth.folio.daiquiri.dev`); your Raindrop password is never seen by
Folio. Raindrop's own privacy policy applies to data stored there.

### AI Organizer (optional)
Only when you explicitly run an AI action, the **titles and URLs** of your
bookmarks (nothing else — no page contents, no browsing history) are sent to
one AI provider to produce grouping suggestions:

- **Included AI (AI Pro plan):** sent to our metered service
  (`ai.folio.daiquiri.dev`), which runs the model on Cloudflare Workers AI.
  Your license key authenticates the request. We do not store the bookmark
  data; usage counters store only a hash of your license key.
- **Your own API key:** sent directly from your browser to the provider you
  configured (Anthropic, OpenAI, or Google Gemini) under their privacy terms.
  Your API key is stored locally in extension storage.

Suggestions are shown for your review; nothing is applied without your click.

### Licensing (paid plans, optional)
When you activate a license, the key and your activation are validated with
Polar.sh (`api.polar.sh`), our merchant of record. Purchases themselves happen
on Polar's checkout under Polar's privacy policy.

### Sessions & tools
Session saver reads the open tabs of the current window (title + URL) only at
the moment you click "Save current session", and writes them as bookmarks
locally. The dead-link checker makes connection checks to your bookmarks'
hosts from your device. The extension-list backup (Pro) reads your installed
extension names/ids via the management API and includes them ONLY inside your
end-to-end encrypted sync blob.

## What we never do

- Sell, share, or monetize any user data
- Collect browsing history or page contents
- Run analytics/telemetry of any kind
- Store plaintext bookmark data on any server

## Contact

Questions: https://github.com/daiquiridev/folio_public/issues
