import { XMLParser } from 'fast-xml-parser'; 
import { maybeEnforceApiKey } from '../lib/edge/auth.js';
import {
  extractUrlEntries,
  normalizeUrl,
  ageDays,
  makeMatchRegex
} from '../lib/edge/urlUtils.js';
import { loadCoreFragments, categorizeByCore } from '../lib/edge/coreCatalog.js';
import { derivePageNameFromUrl } from '../lib/edge/urlUtils.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const auth = maybeEnforceApiKey(req);
  if (auth) return auth;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST with { domains: [] } or { items: [{domain,resort}] }' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json().catch(() => ({}));
  const {
    domains,
    items,
    match = 'ski-and-ride-lessons',
    includeQuery = false,
    caseInsensitive = true
  } = body || {};

  const worklist = Array.isArray(items)
    ? items.map(({ domain, resort }) => ({ domain, resort: resort || null }))
    : (Array.isArray(domains) ? domains.map((d) => ({ domain: d, resort: null })) : []);

  if (worklist.length === 0) {
    return new Response(JSON.stringify({ error: 'Provide { domains: [...] } or { items: [...] }' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Load core fragments once
  const coreFragments = await loadCoreFragments(req);
  const parser = new XMLParser();
  const pattern = makeMatchRegex(match, { caseInsensitive });

  // Small helper for per-request timeout (Edge-safe)
  async function fetchWithTimeout(url, ms = 15000, init) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(id);
    }
  }

  const results = await Promise.allSettled(
    worklist.map(async ({ domain, resort }) => {
      const upstream = `https://${domain}/contentsitemap.xml`;
      const r = await fetchWithTimeout(upstream, 30000, {
        headers: { 'User-Agent': 'ViteVercelEdge/1.0 (+https://example.com)' },
      });
      if (!r.ok) throw new Error(`${domain}: ${r.status} ${r.statusText}`);

      const xml = await r.text();
      const parsed = parser.parse(xml);

      const seen = new Set();
      const urls = extractUrlEntries(parsed)
        .map((e) => {
          const norm = normalizeUrl(e.loc, { includeQuery, dropTrailingSlash: true });
          if (!norm) return null;
          const category = categorizeByCore(norm, coreFragments);
          return {
            loc: norm,
            pageName: derivePageNameFromUrl(norm),
            lastmod: e.lastmod,
            changefreq: e.changefreq,
            priority: e.priority,
            ageDays: ageDays(e.lastmod),
            category // "core" | "specific"
          };
        })
        .filter((e) => e && pattern.test(e.loc))
        .filter((e) => {
          if (seen.has(e.loc)) return false;
          seen.add(e.loc);
          return true;
        });

      // NEW: quick category counts at the parent level
      const coreCount = urls.reduce((n, u) => n + (u.category === 'core' ? 1 : 0), 0);
      const specificCount = urls.length - coreCount;

      return { domain, resort, count: urls.length, coreCount, specificCount, urls };
    })
  );

  const sitemaps = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed   = results.filter(r => r.status === 'rejected').map(r => String(r.reason));
  const totalMatches = sitemaps.reduce((sum, d) => sum + (d?.count || 0), 0);

  return new Response(JSON.stringify({
    match, includeQuery, caseInsensitive,
    totalDomains: sitemaps.length,
    totalMatches,
    sitemaps,
    failed
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
