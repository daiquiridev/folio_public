// Test Cloudflare Worker locally
// IMPORTANT: Replace the placeholder credentials below with your actual Raindrop.io API credentials
// Do NOT commit real credentials to Git! Use environment variables in production.
const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Environment variables - Replace with your actual credentials
const RAINDROP_CLIENT_ID = 'your_raindrop_client_id_here';
const RAINDROP_CLIENT_SECRET = 'your_raindrop_client_secret_here';
const SESSION_SECRET = 'your_session_secret_here'; // Generate a random 32+ character string

// In-memory session store (for testing)
const sessions = new Map();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check endpoint
app.get('/env-ok', (req, res) => {
  res.json({
    hasClientId: !!RAINDROP_CLIENT_ID,
    hasClientSecret: !!RAINDROP_CLIENT_SECRET,
    hasSessionSecret: !!SESSION_SECRET,
    version: '1.0.0-test',
    responseFormat: 'standard'
  });
});

// Start OAuth flow
app.get('/auth/start', (req, res) => {
  try {
    const extRedirect = req.query.ext_redirect;
    if (!extRedirect) {
      return res.status(400).json({ error: 'missing_ext_redirect' });
    }

    console.log('🚀 Starting OAuth flow for extension:', extRedirect);

    // Generate session code
    const sessionCode = crypto.randomBytes(32).toString('hex');

    // Store session with extension redirect
    sessions.set(sessionCode, {
      extRedirect,
      timestamp: Date.now()
    });

    console.log('📝 Generated session code:', sessionCode);

    // Build Raindrop OAuth URL
    const raindropAuthUrl = new URL('https://raindrop.io/oauth/authorize');
    raindropAuthUrl.searchParams.set('client_id', RAINDROP_CLIENT_ID);
    raindropAuthUrl.searchParams.set('redirect_uri', `http://localhost:3000/auth/callback`);
    raindropAuthUrl.searchParams.set('response_type', 'code');
    raindropAuthUrl.searchParams.set('state', sessionCode);

    console.log('🔗 Redirecting to Raindrop:', raindropAuthUrl.toString());

    // Redirect to Raindrop
    res.redirect(raindropAuthUrl.toString());

  } catch (error) {
    console.error('❌ Error in /auth/start:', error);
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});

// OAuth callback from Raindrop
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    console.log('🔄 OAuth callback received:', { code: code?.substring(0, 10) + '...', state, error });

    if (error) {
      return res.status(400).json({ error: 'oauth_error', details: error });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'missing_parameters' });
    }

    // Get session
    const session = sessions.get(state);
    if (!session) {
      return res.status(400).json({ error: 'invalid_session' });
    }

    console.log('📋 Session found for state:', state);

    // Exchange code for token
    const tokenResponse = await fetch('https://raindrop.io/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: RAINDROP_CLIENT_ID,
        client_secret: RAINDROP_CLIENT_SECRET,
        code: code,
        redirect_uri: 'http://localhost:3000/auth/callback',
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
      return res.status(500).json({ error: 'token_exchange_failed', details: errorText });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful:', { access_token: tokenData.access_token?.substring(0, 10) + '...' });

    // Store tokens in session
    session.tokens = tokenData;
    sessions.set(state, session);

    // Redirect back to extension with session code
    const redirectUrl = new URL(session.extRedirect);
    redirectUrl.searchParams.set('session_code', state);

    console.log('🔙 Redirecting back to extension:', redirectUrl.toString());
    res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('❌ Error in /auth/callback:', error);
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});

// Fetch tokens using session code
app.get('/auth/fetch', (req, res) => {
  try {
    const sessionCode = req.query.session_code;

    console.log('📤 Token fetch request for session:', sessionCode);

    if (!sessionCode) {
      return res.status(400).json({ error: 'missing_session_code' });
    }

    const session = sessions.get(sessionCode);
    if (!session) {
      return res.status(400).json({ error: 'invalid_session_code' });
    }

    if (!session.tokens) {
      return res.status(400).json({ error: 'no_tokens_available' });
    }

    console.log('✅ Returning tokens for session:', sessionCode);

    // Return tokens in the expected format
    res.json({
      access_token: session.tokens.access_token,
      refresh_token: session.tokens.refresh_token,
      expires_in: session.tokens.expires_in || 3600,
      token_type: session.tokens.token_type || 'Bearer'
    });

    // Clean up session after use
    sessions.delete(sessionCode);

  } catch (error) {
    console.error('❌ Error in /auth/fetch:', error);
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});

// Token refresh endpoint
app.post('/token/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'missing_refresh_token' });
    }

    console.log('🔄 Token refresh request');

    const refreshResponse = await fetch('https://raindrop.io/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: RAINDROP_CLIENT_ID,
        client_secret: RAINDROP_CLIENT_SECRET,
        refresh_token: refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error('❌ Token refresh failed:', refreshResponse.status, errorText);
      return res.status(500).json({ error: 'refresh_failed', details: errorText });
    }

    const tokenData = await refreshResponse.json();
    console.log('✅ Token refresh successful');

    res.json(tokenData);

  } catch (error) {
    console.error('❌ Error in /token/refresh:', error);
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Test Worker running on http://localhost:${PORT}`);
  console.log(`📋 Environment check: http://localhost:${PORT}/env-ok`);
  console.log(`🔗 Auth start: http://localhost:${PORT}/auth/start?ext_redirect=YOUR_EXTENSION_REDIRECT`);
});