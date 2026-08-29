Cloudflare Worker — OAuth Proxy for Folio

What this does
- Provides a managed OAuth flow for Raindrop.io without exposing the client secret in the extension.
- Endpoints:
  - GET /auth/start?ext_redirect=<chrome_identity_redirect>
  - GET /auth/callback
  - GET /auth/fetch?session_code=<code>
  - POST /token/refresh { refresh_token }

Environment variables (Secrets)
- RAINDROP_CLIENT_ID — from https://raindrop.io/developer
- RAINDROP_CLIENT_SECRET — from https://raindrop.io/developer
- SESSION_SECRET — any random long string to sign one-time session codes

Redirect URI to register at Raindrop
- Use your worker callback URL: https://<your-worker>.<account>.workers.dev/auth/callback
- If you bind a custom domain, use https://<your-domain>/auth/callback

Deploy from Git (Dashboard)
1) Workers & Pages → Create → Worker → Deploy from Git → choose this repo
2) Root directory: cloudflare
3) Build command: (leave empty)
4) Build output directory: (leave empty)
5) Variables → add the three secrets above
6) Deploy → note the Workers.dev URL

CLI deploy (alternative)
1) npm i -g wrangler
2) cd cloudflare
3) wrangler login
4) wrangler deploy
5) Add secrets in Dashboard → Settings → Variables

How the flow works (managed mode)
1) Extension opens chrome.identity.launchWebAuthFlow to GET /auth/start?ext_redirect=<identity URL>
2) Worker redirects to Raindrop authorize with redirect back to /auth/callback
3) Worker exchanges code for tokens, signs them into a session_code, and redirects to ext_redirect with ?session_code=...
4) Extension calls GET /auth/fetch to receive the tokens JSON
5) Later, extension uses POST /token/refresh to refresh using the worker

Note
- The extension ships with managed mode disabled by default. When you are ready, enable “managedOAuth” in extension settings and set the base URL to your Worker’s URL.

