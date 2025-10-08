import { useEffect, useState } from 'react';

export default function App() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load domains.json on mount
  useEffect(() => {
    (async () => {
      const res = await fetch('/domains.json');
      const list = await res.json();
      setDomains(list);
    })();
  }, []);

  const fetchAllSitemaps = async () => {
    try {
      setLoading(true);
      const payload = { domains: domains.map(d => d.domain) };
      const res = await fetch('/api/sitemaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      console.log('Sitemap fetch result:', json); // 👉 console log the API result
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Sitemap Fetcher</h1>
      <p>Below is the list of Resorts from <code>domains.json</code>. Click the button to fetch all sitemaps and check the console.</p>

      <ul>
        {domains.map((d) => (
          <li key={d.domain}>
            <strong>{d.resort}</strong> — <code>{d.domain}</code>
          </li>
        ))}
      </ul>

      <button onClick={fetchAllSitemaps} disabled={loading || domains.length === 0}>
        {loading ? 'Fetching…' : 'Fetch All Sitemaps (Check Console)'}
      </button>
    </div>
  );
}
