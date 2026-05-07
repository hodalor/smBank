import { useEffect, useState } from 'react';
import { getSuperBin, restoreFromSuperBin, purgeFromSuperBin, hasPermission, PERMISSIONS } from '../state/ops';
import { listSuperBin, restoreSuperBin, deleteSuperBin } from '../api';
import { confirm } from '../components/Confirm';
import { showWarning } from '../components/Toaster';
import { IconRotateCcw, IconTrash, IconDownload } from '../components/Icons';
import { downloadCsvFile, downloadJsonFile } from '../utils/downloads';

export default function SuperBin() {
  const [rows, setRows] = useState(getSuperBin());
  const [forbidden, setForbidden] = useState(false);
  useEffect(() => {
    const pull = () => {
      listSuperBin().then(setRows).catch((e) => {
        if (e && e.status === 403) {
          setForbidden(true);
          showWarning('Super Bin requires Super Admin access');
          return;
        }
        setRows(getSuperBin());
      });
    };
    pull();
    const id = setInterval(pull, 2000);
    return () => clearInterval(id);
  }, []);
  const restore = (id) => {
    restoreSuperBin(id).then(() => {
      listSuperBin().then(setRows).catch((e) => {
        if (e && e.status === 403) { setForbidden(true); return; }
        setRows(getSuperBin());
      });
    }).catch((e) => {
      if (e && e.status === 403) { setForbidden(true); return; }
      restoreFromSuperBin(id);
      setRows(getSuperBin());
    });
  };
  const purge = async (id) => {
    const ok = await confirm('Permanently delete this item?');
    if (!ok) return;
    deleteSuperBin(id).then(() => {
      listSuperBin().then(setRows).catch((e) => {
        if (e && e.status === 403) { setForbidden(true); return; }
        setRows(getSuperBin());
      });
    }).catch((e) => {
      if (e && e.status === 403) { setForbidden(true); return; }
      purgeFromSuperBin(id);
      setRows(getSuperBin());
    });
  };
  const exportOne = (row) => {
    downloadJsonFile(`${row.id}.json`, row);
  };
  const exportAllCSV = () => {
    downloadCsvFile('superbin.csv', ['id', 'kind', 'deletedAt', 'by', 'payload'], rows.map((r) => ({
      id: r.id || '',
      kind: r.kind || '',
      deletedAt: r.deletedAt || '',
      by: r.by || '',
      payload: JSON.stringify(r.payload || {}),
    })));
  };
  if (!hasPermission(PERMISSIONS.SUPERBIN_VIEW) || forbidden) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Super Bin</h1>
      <div className="row">
        <button className="btn" onClick={exportAllCSV}><IconDownload /><span>Export All (CSV)</span></button>
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
                  <button className="btn" onClick={() => restore(r.id)}><IconRotateCcw /><span>Restore</span></button>{' '}
                  <button className="btn" onClick={() => purge(r.id)}><IconTrash /><span>Delete</span></button>{' '}
                  <button className="btn" onClick={() => exportOne(r)}><IconDownload /><span>Export</span></button>
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
