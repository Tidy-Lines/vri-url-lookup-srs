import { useMemo } from 'react';

// Order "core" rows first in CSV
const ORDER = { core: 0, specific: 1 };

function tsForFilename(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;
}

function encodeCSV(rows) {
  return rows
    .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function DownloadCSV({ domains, selectedIds, results, loading }) {
  // Quick lookups & counts
  const domainToResort = useMemo(
    () => new Map(domains.map((d) => [d.domain, d.resort])),
    [domains]
  );

  const selectedDomains = useMemo(
    () => domains.filter((d) => selectedIds.has(d.id)).map((d) => d.domain),
    [domains, selectedIds]
  );

  const totalSelectedMatches = useMemo(() => {
    if (!results) return 0;
    return selectedDomains.reduce((sum, domain) => sum + ((results[domain] || []).length), 0);
  }, [results, selectedDomains]);

  const disabled = loading || !results || totalSelectedMatches === 0;

  function onDownload() {
    if (disabled) return;

    const rows = [
      ['Resort', 'Domain', 'Page Category', 'Page Name', 'Age (Days)', 'Last Modified', 'URL']
    ];

    selectedDomains.forEach((domain) => {
      const resort = domainToResort.get(domain) || '';
      const urls = results?.[domain] || [];

      const sorted = urls.slice().sort(
        (a, b) => (ORDER[a.category] ?? 2) - (ORDER[b.category] ?? 2)
      );

      sorted.forEach((u) => {
        rows.push([
          resort,
          domain,
          u.category ? (u.category[0].toUpperCase() + u.category.slice(1)) : '',
          u.pageName || '',
          typeof u.ageDays === 'number' ? String(u.ageDays) : '',
          u.lastmod || '',
          u.loc || ''
        ]);
      });
    });

    if (rows.length === 1) return; // nothing to export

    const csv = encodeCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `srs-active-pages_${tsForFilename()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={onDownload} disabled={disabled}
      title={disabled ? 'No results to export' : 'Download CSV'}>
      Download CSV
    </button>
  );
}
