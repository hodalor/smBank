import { useMemo, useState } from 'react';
import { findAccount, lookupAccountBasic } from '../state/ops';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRecords() {
  const [account, setAccount] = useState('');

  const loans = useMemo(
    () => [
      { id: 'LN-1001', account: '4839201746', principal: 5000, rate: 10, months: 6, start: '2026-02-01', due: '2026-08-01', status: 'Active' },
      { id: 'LN-1003', account: '4839201746', principal: 1200, rate: 8, months: 3, start: '2025-11-10', due: '2026-01-10', status: 'Completed' },
      { id: 'LN-1002', account: '7392046158', principal: 3000, rate: 9, months: 4, start: '2026-03-01', due: '2026-07-01', status: 'Pending' }
    ],
    []
  );

  const filtered = useMemo(
    () => loans.filter(l => !account || l.account === account),
    [loans, account]
  );

  const countPerClient = useMemo(() => {
    const map = new Map();
    filtered.forEach(l => {
      map.set(l.account, (map.get(l.account) || 0) + 1);
    });
    return map;
  }, [filtered]);

  return (
    <div className="stack">
      <h1>Loan Records</h1>
      <div className="card" style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <label>
          Client Account
          <div className="row">
            <input className="input" placeholder="Account / Name / ID" value={account} onChange={(e) => setAccount(e.target.value)} />
            <button className="btn" type="button" onClick={() => {
              const q = account.trim();
              if (!q) return;
              if (/^\\d{10}$/.test(q)) return;
              const found = findAccount(q);
              if (found) setAccount(found.accountNumber);
            }}>Find</button>
          </div>
        </label>
        {/^\\d{10}$/.test(account) && (
          <div className="row" style={{ gap: 24 }}>
            {(() => { const c = lookupAccountBasic(account); return c ? (
              <>
                <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{c.name}</div></div>
                <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{c.nationalId}</div></div>
                <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB</div><div>{c.dob}</div></div>
                <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{c.phone}</div></div>
              </>
            ) : null; })()}
          </div>
        )}
        <div>
          <strong>Total Loans for Client:</strong> {account ? (countPerClient.get(account) || 0) : '—'}
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Account</th>
              <th>Principal</th>
              <th>Rate</th>
              <th>Months</th>
              <th>Start</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{l.account}</td>
                <td>{gh(l.principal)}</td>
                <td>{l.rate}%</td>
                <td>{l.months}</td>
                <td>{l.start}</td>
                <td>{l.due}</td>
                <td>{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
