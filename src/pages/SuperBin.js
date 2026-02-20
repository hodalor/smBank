import { useEffect, useState } from 'react';
import { getSuperBin, restoreFromSuperBin, purgeFromSuperBin, hasPermission } from '../state/ops';
import { listSuperBin, restoreSuperBin, deleteSuperBin } from '../api';

export default function SuperBin() {
  const allowed = hasPermission('superbin.view');
  const [rows, setRows] = useState(getSuperBin());
  useEffect(() => {
    const pull = () => {
      listSuperBin().then(setRows).catch(() => setRows(getSuperBin()));
    };
    pull();
    const id = setInterval(pull, 2000);
    return () => clearInterval(id);
  }, []);
  const restore = (id) => {
    restoreSuperBin(id).then(() => {
      listSuperBin().then(setRows).catch(() => setRows(getSuperBin()));
    }).catch(() => {
      restoreFromSuperBin(id);
      setRows(getSuperBin());
    });
  };
  const purge = (id) => {
    if (!window.confirm('Permanently delete this item?')) return;
    deleteSuperBin(id).then(() => {
      listSuperBin().then(setRows).catch(() => setRows(getSuperBin()));
    }).catch(() => {
      purgeFromSuperBin(id);
      setRows(getSuperBin());
    });
  };
  const exportOne = (row) => {
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${row.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportAllCSV = () => {
    const header = ['id','kind','deletedAt','by','payload'];
    const data = [header.join(',')].concat(rows.map(r =>
      [r.id, r.kind, r.deletedAt, r.by, JSON.stringify(r.payload).replace(/"/g,'""')].map(v => `"${v}"`).join(',')
    )).join('\n');
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'superbin.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Super Bin</h1>
      <div className="row">
        <button className="btn" onClick={exportAllCSV}>Export All (CSV)</button>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Kind</th>
              <th>Deleted At</th>
              <th>By</th>
              <th>Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.kind}</td>
                <td>{r.deletedAt}</td>
                <td>{r.by}</td>
                <td><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.payload, null, 0)}</pre></td>
                <td>
                  <button className="btn" onClick={() => restore(r.id)}>Restore</button>{' '}
                  <button className="btn" onClick={() => purge(r.id)}>Delete</button>{' '}
                  <button className="btn" onClick={() => exportOne(r)}>Export</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="6">Super Bin is empty.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
