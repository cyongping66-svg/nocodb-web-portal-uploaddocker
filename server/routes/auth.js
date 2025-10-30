const express = require('express');
const cookieParser = require('cookie-parser');
const { Issuer, generators } = require('openid-client');

const router = express.Router();

// Middleware for this router to ensure cookies are parsed
router.use(cookieParser(process.env.COOKIE_SECRET || 'dev-secret'));

// Basic env-based configuration
const OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI || 'http://localhost:8001/api/auth/callback';
const OIDC_SCOPES = process.env.OIDC_SCOPES || 'openid profile email';
const OIDC_INTROSPECT_URL = process.env.OIDC_INTROSPECT_URL || (OIDC_ISSUER_URL ? `${OIDC_ISSUER_URL.replace(/\/+$/,'')}/connect/introspect` : null);

let oidcClient = null;
let discoveryPromise = null;

async function getClient() {
  if (oidcClient) return oidcClient;
  if (!OIDC_ISSUER_URL || !OIDC_CLIENT_ID) {
    throw new Error('OIDC configuration missing: set OIDC_ISSUER_URL and OIDC_CLIENT_ID');
  }
  if (!discoveryPromise) {
    discoveryPromise = (async () => {
      const issuer = await Issuer.discover(OIDC_ISSUER_URL);
      oidcClient = new issuer.Client({
        client_id: OIDC_CLIENT_ID,
        client_secret: OIDC_CLIENT_SECRET,
        redirect_uris: [OIDC_REDIRECT_URI],
        response_types: ['code'],
      });
      return oidcClient;
    })();
  }
  return discoveryPromise;
}

// Helper: introspect an access token via OIDC introspection endpoint
async function introspectToken(accessToken) {
  if (!OIDC_INTROSPECT_URL) throw new Error('OIDC_INTROSPECT_URL is not configured');
  const params = new URLSearchParams();
  params.set('token', accessToken);
  params.set('token_type_hint', 'access_token');
  // 一些提供方（如 OpenIddict）在無 Basic 認證時要求在 body 內提供 client_id
  if (OIDC_CLIENT_ID) {
    params.set('client_id', OIDC_CLIENT_ID);
  }

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (OIDC_CLIENT_ID && OIDC_CLIENT_SECRET) {
    const basic = Buffer.from(`${OIDC_CLIENT_ID}:${OIDC_CLIENT_SECRET}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  }

  const resp = await fetch(OIDC_INTROSPECT_URL, {
    method: 'POST',
    headers,
    body: params.toString(),
  });
  let data = null;
  try { data = await resp.json(); } catch { data = null; }
  if (!resp.ok) {
    throw new Error(`Introspection failed: ${resp.status} ${data ? JSON.stringify(data) : ''}`);
  }
  return data;
}

// GET /api/auth/login
// Starts OIDC Authorization Code with PKCE flow and redirects to the provider
router.get('/login', async (req, res) => {
  try {
    const client = await getClient();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();

    const returnTo = req.query.return_to || (req.headers.referer || '/');

    // Store verifier/state/returnTo in httpOnly cookies
    res.cookie('oidc_state', state, { httpOnly: true, sameSite: 'lax' });
    res.cookie('oidc_verifier', codeVerifier, { httpOnly: true, sameSite: 'lax' });
    res.cookie('oidc_return_to', returnTo, { httpOnly: true, sameSite: 'lax' });

    const authorizationUrl = client.authorizationUrl({
      scope: OIDC_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    return res.redirect(authorizationUrl);
  } catch (e) {
    console.error('OIDC login error:', e);
    return res.status(500).json({ error: 'OIDC login initialization failed', details: e.message });
  }
});

// GET /api/auth/callback
// Handles the OIDC callback, exchanges code, creates a session cookie, and redirects back
router.get('/callback', async (req, res) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const stateCookie = req.cookies.oidc_state;
    const verifier = req.cookies.oidc_verifier;
    const returnTo = req.cookies.oidc_return_to || '/';

    if (!params.state || params.state !== stateCookie) {
      return res.status(400).send('Invalid state');
    }
    if (!verifier) {
      return res.status(400).send('Missing code verifier');
    }

    const tokenSet = await client.callback(OIDC_REDIRECT_URI, params, { code_verifier: verifier, state: stateCookie });
    const claims = tokenSet.claims();

    // Derive a display name
    const displayName = (
      claims.preferred_username ||
      claims.name ||
      claims.email ||
      (claims.sub ? String(claims.sub).slice(0, 8) : 'user')
    );

    const user = {
      sub: claims.sub,
      name: displayName,
      email: claims.email || null,
      preferred_username: claims.preferred_username || null,
      groups: claims.groups || [],
      raw: claims,
    };

    // Set a simple session cookie with user info (httpOnly; use secure in prod)
    res.cookie('session_user', JSON.stringify(user), { httpOnly: true, sameSite: 'lax' });

    // Clear transient cookies
    res.clearCookie('oidc_state');
    res.clearCookie('oidc_verifier');
    res.clearCookie('oidc_return_to');

    // Redirect back to the original page
    return res.redirect(returnTo);
  } catch (e) {
    console.error('OIDC callback error:', e);
    return res.status(500).send('OIDC callback failed: ' + e.message);
  }
});

// GET /api/auth/me
// Returns current user info from session cookie or via Bearer token introspection
router.get('/me', async (req, res) => {
  try {
    // 1) Try session cookie first
    const raw = req.cookies.session_user;
    if (raw) {
      let user;
      try { user = JSON.parse(raw); } catch { user = null; }
      if (!user) return res.status(401).json({ authenticated: false });
      return res.json({ authenticated: true, user });
    }

    // 2) Fallback: check Authorization Bearer token
    const auth = req.headers['authorization'] || '';
    const hasBearer = typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ');
    if (!hasBearer) return res.status(401).json({ authenticated: false });
    const token = auth.slice(7).trim();
    if (!token) return res.status(401).json({ authenticated: false });

    const data = await introspectToken(token);
    if (!data || data.active !== true) {
      return res.status(401).json({ authenticated: false });
    }

    // Build user info from introspection claims
    const claims = data;
    const displayName = (
      claims.preferred_username ||
      claims.name ||
      claims.email ||
      (claims.sub ? String(claims.sub).slice(0, 8) : 'user')
    );
    const user = {
      sub: claims.sub,
      name: displayName,
      email: claims.email || null,
      preferred_username: claims.preferred_username || null,
      groups: Array.isArray(claims.groups) ? claims.groups : [],
      scope: claims.scope || null,
      raw: claims,
    };

    return res.json({ authenticated: true, user });
  } catch (e) {
    console.error('auth/me error:', e);
    return res.status(500).json({ error: 'Failed to read session', details: String(e.message || e) });
  }
});

// POST /api/auth/introspect
// Introspects a Bearer token (from Authorization header or body/query token)
router.post('/introspect', async (req, res) => {
  try {
    const auth = req.headers['authorization'] || '';
    const hasBearer = typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ');
    let token = hasBearer ? auth.slice(7).trim() : null;
    token = token || req.body?.token || req.query?.token;
    if (!token) return res.status(400).json({ error: 'missing_token' });

    const result = await introspectToken(token);
    return res.json(result);
  } catch (e) {
    console.error('introspect error:', e);
    return res.status(500).json({ error: 'introspect_failed', details: String(e.message || e) });
  }
});

module.exports = router;