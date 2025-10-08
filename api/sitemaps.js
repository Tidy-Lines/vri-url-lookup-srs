export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST with { domains: [] }' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { domains } = await req.json().catch(() => ({}));
  if (!Array.isArray(domains) || domains.length === 0) {
    return new Response(JSON.stringify({ error: 'Provide { domains: [...] }' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const url = `https://${domain}/contentsitemap.xml`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'ViteVercelEdge/1.0 (+https://example.com)' },
        next: { revalidate: 3600 }
      });
      if (!r.ok) throw new Error(`${domain}: ${r.status} ${r.statusText}`);
      const xml = await r.text();
      return { domain, xml };
    })
  );

  const sitemaps = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = results.filter(r => r.status === 'rejected').map(r => String(r.reason));

  return new Response(JSON.stringify({ sitemaps, failed }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
