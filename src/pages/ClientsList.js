import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchByAccount from '../components/SearchByAccount';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { listClients } from '../api';
import Pager from '../components/Pager';
import { IconPlus, IconExternal, IconDownload } from '../components/Icons';

export default function ClientsList() {
  const navigate = useNavigate();
  const allowed = hasPermission(PERMISSIONS.CLIENTS_VIEW);
  const [query, setQuery] = useState({ type: 'account', value: '' });
  const [data, setData] = useState([]);
  const [exportCols, setExportCols] = useState({ accountNumber: true, phone: false, name: false, nationalId: false, status: false });
  useEffect(() => {
    if (!allowed) return;
    let mounted = true;
    const run = async () => {
      try {
        const v = query.value.trim();
        if (!v) {
          const res = await listClients({});
          if (mounted) setData(res);
          return;
        }
        if (query.type === 'account' && /^\d{10}$/.test(v)) {
          const res = await listClients({ accountNumber: v });
          if (mounted) setData(res);
          return;
        }
        const res = await listClients({ q: v });
        if (mounted) setData(res);
      } catch {
        if (mounted) setData([]);
      }
    };
    run();
    return () => { mounted = false; };
  }, [allowed, query]);
  const filtered = useMemo(() => {
    return data.map(c => {
      const name = c.fullName || c.companyName || '';
      const nationalId = c.nationalId || c.registrationNumber || '';
      const phone = c.phone || c.contactPhone || '';
      return { accountNumber: c.accountNumber, name, nationalId, phone, status: c.status || 'Active' };
    });
  }, [data]);
  const onSearch = ({ type, value }) => setQuery({ type, value });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const toggleCol = (k) => setExportCols(prev => ({ ...prev, [k]: !prev[k] }));
  const downloadCSV = () => {
    const cols = Object.keys(exportCols).filter(k => exportCols[k]);
    if (cols.length === 0) return;
    const header = cols.join(',');
    const rows = filtered.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Clients</h1>
        {hasPermission(PERMISSIONS.CLIENTS_CREATE) && (
          <button className="btn btn-primary" onClick={() => navigate('/clients/new')}><IconPlus /><span>New Client</span></button>
        )}
      </div>
      <div className="card">
        <SearchByAccount onSearch={onSearch} />
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ color: '#64748b' }}>Export columns</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={exportCols.accountNumber} onChange={() => toggleCol('accountNumber')} /> Account</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={exportCols.phone} onChange={() => toggleCol('phone')} /> Phone</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={exportCols.name} onChange={() => toggleCol('name')} /> Name</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={exportCols.nationalId} onChange={() => toggleCol('nationalId')} /> ID</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={exportCols.status} onChange={() => toggleCol('status')} /> Status</label>
          <button className="btn btn-primary" onClick={downloadCSV}><IconDownload /><span>Export CSV</span></button>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Account Number</th>
              <th>Name</th>
              <th>National ID</th>
              <th>Phone</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr key={row.accountNumber}>
                <td>{row.accountNumber}</td>
                <td>{row.name}</td>
                <td>{row.nationalId}</td>
                <td>{row.phone}</td>
                <td>{row.status}</td>
                <td>
                  <button className="btn" onClick={() => navigate(`/clients/${row.accountNumber}`)}><IconExternal /><span>Open</span></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </div>
  );
}
