import { safeEqual } from './safeEqual.js';

// Returns `null` if OK (no auth needed / passed), or a Response if blocked.
export function maybeEnforceApiKey(req, {
  enforceIn = ['production'],   // environments to enforce in
  allowSameOrigin = true,       // let your own pages call without key
  allowedOrigins = []           // optional explicit allowlist (hosts)
} = {}) {
  const env = process.env.VERCEL_ENV || 'development';
  const shouldEnforce = enforceIn.includes(env);
  if (!shouldEnforce) return null;

  // Determine if request is same-origin (browser fetch from your own site)
  const requestUrl = new URL(req.url);
  const reqHost = requestUrl.host;

  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();

  const hostFrom = (value) => {
    try { return value ? new URL(value).host : ''; } catch { return ''; }
  };

  const isSameOrigin =
    secFetchSite === 'same-origin' ||
    hostFrom(origin) === reqHost ||
    hostFrom(referer) === reqHost ||
    (allowedOrigins.length > 0 && allowedOrigins.includes(hostFrom(origin)));

  if (allowSameOrigin && isSameOrigin) {
    // Let your own frontend call this in prod without a key
    return null;
  }

  // Otherwise require the API key
  const EXPECTED = process.env.API_KEY;
  if (!EXPECTED) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const provided = req.headers.get('x-api-key') || '';
  if (!safeEqual(provided, EXPECTED)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  return null;
}

// Returns `null` if password auth passes, or a Response if blocked.
export function enforceFetchPassword(req, {
  envVarName = 'FETCH_PASSWORD',
  headerName = 'x-fetch-password'
} = {}) {
  const expected = process.env[envVarName];
  if (!expected) {
    return new Response(JSON.stringify({ error: `Server misconfigured: missing ${envVarName}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const provided = req.headers.get(headerName) || '';
  if (!safeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return null;
}
