import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchByAccount from '../components/SearchByAccount';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { listClients } from '../api';
import Pager from '../components/Pager';

export default function ClientsList() {
  const navigate = useNavigate();
  const [query, setQuery] = useState({ type: 'account', value: '' });
  const [data, setData] = useState([]);
  useEffect(() => {
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
  }, [query]);
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
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Clients</h1>
        {hasPermission(PERMISSIONS.CLIENTS_CREATE) && (
          <button className="btn btn-primary" onClick={() => navigate('/clients/new')}>New Client</button>
        )}
      </div>
      <div className="card">
        <SearchByAccount onSearch={onSearch} />
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
                  <button className="btn" onClick={() => navigate(`/clients/${row.accountNumber}`)}>Open</button>
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
