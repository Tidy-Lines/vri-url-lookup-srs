export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const domain = url.searchParams.get('domain');
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Missing ?domain=' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const upstream = `https://${domain}/contentsitemap.xml`;

  try {
    const r = await fetch(upstream, {
      headers: { 'User-Agent': 'ViteVercelEdge/1.0 (+https://example.com)' },
      next: { revalidate: 3600 }
    });

    if (!r.ok) {
      return new Response(`Upstream error: ${r.status} ${r.statusText}`, { status: r.status });
    }

    const xml = await r.text();
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
