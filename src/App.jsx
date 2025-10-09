import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';

import DownloadCSV from './components/DownloadCSV.jsx';

const STORAGE_KEY = 'vri-selected-resort-ids:v1';

export default function App() {
  const [domains, setDomains] = useState([]);                 // [{ id, resort, domain }]
  const [selectedIds, setSelectedIds] = useState(new Set());  // Set<number>
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);               // { [domain]: urls[] }
  const [error, setError] = useState('');

  const selectAllRef = useRef(null);

  // Lock page scroll while loading
  useEffect(() => {
    if (loading) document.body.classList.add('no-scroll');
    else document.body.classList.remove('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [loading]);

  // Load saved selection
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSelectedIds(new Set(JSON.parse(raw)));
    } catch { }
  }, []);

  // Load domains.json
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/domains.json');
        const list = await res.json();
        setDomains(list);
      } catch (e) {
        console.error(e);
        setError('Failed to load domains.json');
      }
    })();
  }, []);

  // Indeterminate state for "Select All"
  useEffect(() => {
    if (!selectAllRef.current) return;
    const total = domains.length;
    const selected = selectedIds.size;
    selectAllRef.current.indeterminate = selected > 0 && selected < total;
  }, [domains.length, selectedIds.size]);

  // Persist selection
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedIds]));
    } catch { }
  }, [selectedIds]);

  // Prune stale ids when domains change
  useEffect(() => {
    if (domains.length === 0) return;
    setSelectedIds(prev => {
      const allowed = new Set(domains.map(d => d.id));
      const next = new Set([...prev].filter(id => allowed.has(id)));
      return next.size !== prev.size ? next : prev;
    });
  }, [domains]);

  const allSelected = useMemo(
    () => domains.length > 0 && selectedIds.size === domains.length,
    [domains.length, selectedIds.size]
  );

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(domains.map(d => d.id)));
  };

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = useMemo(
    () =>
      domains
        .filter(d => selectedIds.has(d.id))
        .map(d => ({ domain: d.domain, resort: d.resort })),
    [domains, selectedIds]
  );

  const fetchSelectedSitemaps = async () => {
    if (selectedItems.length === 0) return;
    try {
      setError('');
      setLoading(true);

      const res = await fetch('/api/sitemaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status} ${txt}`);
      }

      const json = await res.json();
      console.log('Sitemap fetch result:', json);

      // shape into { [domain]: urls[] }
      const map = {};
      (json.sitemaps || []).forEach(({ domain, urls }) => {
        map[domain] = urls || [];
      });
      setResults(map);
    } catch (e) {
      console.error('Fetch error:', e);
      setError('Failed to fetch selected sitemaps');
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  return (
    <>
      <section className={`${loading ? 'content-disabled' : ''}`} inert={loading}>
        <h1>SRS Active URL Fetcher</h1>
        <p>Returns all active SRS URL data for the selected resorts based on the resort sitemaps.</p>

        {error && <div className="alert">{error}</div>}

        {/* Selection controls */}
        <div className="controls">
          <label className="label-inline">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
            />
            <span style={{ fontWeight: 600 }}>Select All</span>
          </label>

          <span className="muted">
            {selectedIds.size} selected / {domains.length} total
          </span>

          <div className="controls__right">
            <button title='Clear Selection' onClick={clearSelection} disabled={selectedItems.length === 0}>
              Clear Selection
            </button>
            <button
              onClick={fetchSelectedSitemaps}
              disabled={selectedItems.length === 0 || loading}
              title={selectedItems.length === 0 ? 'Select at least one resort' : 'Fetch'}
            >
              Fetch Selected ({selectedItems.length})
            </button>

            <DownloadCSV
              domains={domains}
              selectedIds={selectedIds}
              results={results}
              loading={loading}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="resort-grid">
          {domains.map(({ id, resort, domain }) => (
            <label key={id} className="resort-card">
              <input
                type="checkbox"
                checked={selectedIds.has(id)}
                onChange={() => toggleOne(id)}
              />
              <div>
                <div className="resort-card__name">{resort}</div>
                <div className="resort-card__domain">{domain}</div>
              </div>
            </label>
          ))}
        </div>
      </section>
      <section className={`${loading ? 'content-disabled' : ''}`} inert={loading}>

        {/* Results */}
        <ul className="results list-reset">
          {domains
            .filter(d => selectedIds.has(d.id))
            .map(({ resort, domain }) => {
              const urls = results?.[domain] || [];

              // core first, then specific
              const order = { core: 0, specific: 1 };
              const urlsSorted = urls.slice().sort(
                (a, b) => (order[a.category] ?? 2) - (order[b.category] ?? 2)
              );

              return (
                <li key={domain} className="resort-result">
                  <div className="resort-result__header">
                    <strong>{resort}</strong>
                    <code className="resort-card__domain">{domain}</code>
                    <span className={!results || !results[domain] ? 'badge badge-inactive' : 'badge'}>
                      {(results && results[domain]) && (
                        <>
                          {urlsSorted.length} active page{urlsSorted.length === 1 ? '' : 's'}
                        </>
                      )}
                      {(!results || !results[domain]) && (loading ? 'Loading…' : 'Fetch to View Data')}
                    </span>
                  </div>

                  {urlsSorted.length > 0 && (
                    <div className="url-section">
                      <ul className="url-list">
                        {urlsSorted.map((u) => (
                          <li key={u.loc} className="url-item">
                            <a href={u.loc} target="_blank" rel="noreferrer">{u.pageName}</a>
                            {u.category && <span className="url-meta">[{u.category === "core" ? "Core" : "Resort Specific"}]</span>}
                            {u.lastmod && <span className="url-meta">(lastmod: {u.lastmod})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      </section>


      {/* Full-screen overlay while loading */}
      {loading && (
        <div className="overlay" role="status" aria-live="polite" aria-busy="true">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="spinner" />
            <div className="loader-label">Fetching URLs...</div>
          </div>
        </div>
      )}
    </>
  );
}
