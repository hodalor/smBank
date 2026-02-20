import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchByAccount from '../components/SearchByAccount';
import { hasPermission, PERMISSIONS } from '../state/ops';

export default function ClientsList() {
  const navigate = useNavigate();
  const [query, setQuery] = useState({ type: 'account', value: '' });
  const data = useMemo(
    () => [
      { accountNumber: '4839201746', name: 'Jane Doe', nationalId: 'NID12345', phone: '0712345678', status: 'Active' },
      { accountNumber: '7392046158', name: 'John Smith', nationalId: 'NID98765', phone: '0798765432', status: 'Active' }
    ],
    []
  );
  const filtered = useMemo(() => {
    const v = query.value.trim().toLowerCase();
    if (!v) return data;
    if (query.type === 'account') return data.filter(d => d.accountNumber.includes(v));
    if (query.type === 'name') return data.filter(d => d.name.toLowerCase().includes(v));
    if (query.type === 'nationalId') return data.filter(d => d.nationalId.toLowerCase().includes(v));
    return data;
  }, [data, query]);
  const onSearch = ({ type, value }) => setQuery({ type, value });
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
            {filtered.map(row => (
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
      </div>
    </div>
  );
}
