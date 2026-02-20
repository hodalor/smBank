import { useMemo, useState } from 'react';
import { findAccount, lookupAccountBasic } from '../state/ops';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRepayments() {
  const [account, setAccount] = useState('');
  const [loanId, setLoanId] = useState('');

  const repayments = useMemo(
    () => [
      { id: 'RP-001', loanId: 'LN-1001', account: '4839201746', amount: 120, date: '2026-02-28' },
      { id: 'RP-002', loanId: 'LN-1001', account: '4839201746', amount: 150, date: '2026-03-15' },
      { id: 'RP-003', loanId: 'LN-1001', account: '4839201746', amount: 120, date: '2026-03-28' },
      { id: 'RP-004', loanId: 'LN-1002', account: '7392046158', amount: 200, date: '2026-04-01' }
    ],
    []
  );

  const filtered = useMemo(
    () => repayments.filter(r => (!account || r.account === account) && (!loanId || r.loanId === loanId)),
    [repayments, account, loanId]
  );

  const totalsByLoan = useMemo(() => {
    const map = new Map();
    filtered.forEach(r => map.set(r.loanId, (map.get(r.loanId) || 0) + r.amount));
    return map;
  }, [filtered]);

  return (
    <div className="stack">
      <h1>Loan Repayment Records</h1>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="form-grid">
          <label>
            Account
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
          <label>
            Loan ID
            <input className="input" placeholder="e.g. LN-1001" value={loanId} onChange={(e) => setLoanId(e.target.value)} />
          </label>
        </div>
        {/^\\d{10}$/.test(account) && (() => { const c = lookupAccountBasic(account); return c ? (
          <div className="row" style={{ gap: 24 }}>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{c.name}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{c.nationalId}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB</div><div>{c.dob}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{c.phone}</div></div>
          </div>
        ) : null; })()}
        {loanId && (
          <div><strong>Total Paid on {loanId}:</strong> {gh(totalsByLoan.get(loanId) || 0)}</div>
        )}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Repayment ID</th>
              <th>Loan ID</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.loanId}</td>
                <td>{r.account}</td>
                <td>{gh(r.amount)}</td>
                <td>{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Notes</h3>
        <p>Repayments are recorded independently of savings deposits. Partial payments are listed by loan ID.</p>
      </div>
    </div>
  );
}
