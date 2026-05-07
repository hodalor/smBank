function ensureExtension(filename, ext) {
  const name = String(filename || 'download').trim() || 'download';
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8;') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
    if (link.parentNode) link.parentNode.removeChild(link);
  }, 1000);
}

export function downloadCsvFile(filename, columns, rows) {
  const cols = Array.isArray(columns) ? columns : [];
  const csvRows = [cols.join(',')];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    csvRows.push(cols.map((col) => JSON.stringify(row && row[col] != null ? row[col] : '')).join(','));
  });
  downloadTextFile(ensureExtension(filename, '.csv'), csvRows.join('\n'), 'text/csv;charset=utf-8;');
}
