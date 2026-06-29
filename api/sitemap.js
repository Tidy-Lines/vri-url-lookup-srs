import { XMLParser } from 'fast-xml-parser';
import { maybeEnforceApiKey } from '../lib/edge/auth.js';
import { enforceFetchPassword } from '../lib/edge/auth.js';
import {
  extractUrlEntries,
  normalizeUrl,
  ageDays,
  makeMatchRegex
} from '../lib/edge/urlUtils.js';
import { loadCoreFragments, categorizeByCore } from '../lib/edge/coreCatalog.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const passwordAuth = enforceFetchPassword(req);
  if (passwordAuth) return passwordAuth;

  const auth = maybeEnforceApiKey(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const domain = url.searchParams.get('domain');
  const match = url.searchParams.get('match') || 'ski-and-ride-lessons';
  const includeQuery = url.searchParams.get('includeQuery') === 'true';
  const caseInsensitive = url.searchParams.get('caseInsensitive') !== 'false';

  if (!domain) {
    return new Response(JSON.stringify({ error: 'Missing ?domain=' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // NEW: load core fragments once
  const coreFragments = await loadCoreFragments(req);

  const upstream = `https://${domain}/contentsitemap.xml`;
  const parser = new XMLParser();
  const pattern = makeMatchRegex(match, { caseInsensitive });

  try {
    const r = await fetch(upstream, {
      headers: { 'User-Agent': 'ViteVercelEdge/1.0 (+https://example.com)' },
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `Upstream error: ${r.status} ${r.statusText}` }), {
        status: r.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const xml = await r.text();
    const parsed = parser.parse(xml);

    const seen = new Set();
    const urls = extractUrlEntries(parsed)
      .map((e) => {
        const norm = normalizeUrl(e.loc, { includeQuery, dropTrailingSlash: true });
        if (!norm) return null;
        const category = categorizeByCore(norm, coreFragments); // ← NEW
        return {
          loc: norm,
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

    return new Response(JSON.stringify({
      domain,
      match, includeQuery, caseInsensitive,
      count: urls.length,
      urls
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
