// Edge-compatible helpers

export function normalizeUrl(loc, { includeQuery = false, dropTrailingSlash = true } = {}) {
  try {
    const u = new URL(loc);
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    if (!includeQuery) u.search = '';
    let out = u.toString();
    if (dropTrailingSlash) out = out.replace(/\/$/, '');
    return out;
  } catch {
    return null;
  }
}

export function ageDays(lastmod) {
  if (!lastmod) return null;
  const d = new Date(lastmod);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function ensureArray(x) {
  return Array.isArray(x) ? x : (x ? [x] : []);
}

export function extractUrlEntries(parsed) {
  const raw = parsed?.urlset?.url ?? [];
  const list = ensureArray(raw);
  return list.map((item) => ({
    loc: typeof item?.loc === 'string' ? item.loc : (item?.loc?.['#text'] ?? ''),
    lastmod: item?.lastmod ?? null,
    changefreq: item?.changefreq ?? null,
    priority: item?.priority ?? null
  }));
}

export function makeMatchRegex(match, { caseInsensitive = true } = {}) {
  // escape string to literal regex
  const esc = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc, caseInsensitive ? 'i' : '');
}

export function derivePageNameFromUrl(u) {
  try {
    const { pathname } = new URL(u);

    // last segment, no trailing slash
    let seg = pathname.replace(/\/+$/, '');
    if (!seg) return ''; // root
    seg = seg.split('/').pop() || '';

    // decode percent-encoded, best-effort
    try { seg = decodeURIComponent(seg); } catch {}

    // strip from first dot (remove extensions / version suffixes)
    seg = seg.split('.')[0];

    // replace hyphens with spaces, collapse whitespace, trim
    seg = seg.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

    // Title Case
    seg = seg
      .toLowerCase()
      .split(' ')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');

    return seg;
  } catch {
    return '';
  }
}


