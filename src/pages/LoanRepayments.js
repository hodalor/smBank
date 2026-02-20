import { useEffect, useMemo, useState } from 'react';
import { directoryLookup, listClients, listLoanRepayPosted } from '../api';
import { showError, showWarning } from '../components/Toaster';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRepayments() {
  const [account, setAccount] = useState('');
  const [loanId, setLoanId] = useState('');
  const [txnId, setTxnId] = useState('');
  const [client, setClient] = useState(null);

  const [repayments, setRepayments] = useState([]);
  useEffect(() => {
    const run = async () => {
      try {
        const q = {};
        if (account && /^\d{10}$/.test(account)) q.accountNumber = account;
        if (txnId) q.id = txnId.trim();
        const res = await listLoanRepayPosted(q);
        setRepayments(res.map(r => ({ id: r.id, loanId: r.loanId, account: r.accountNumber, amount: r.amount, date: r.approvedAt || r.initiatedAt })));
      } catch {
        setRepayments([]);
      }
    };
    run();
  }, [account, txnId]);

  const filtered = useMemo(
    () => repayments.filter(r =>
      (!account || r.account === account) &&
      (!loanId || r.loanId === loanId) &&
      (!txnId || String(r.id || '').includes(txnId.trim()))
    ),
    [repayments, account, loanId, txnId]
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
              listClients({ q }).then(list => {
                if (list && list.length) setAccount(list[0].accountNumber);
                else showWarning('No matching client found');
              }).catch(() => { showError('Lookup failed'); });
              }}>Find</button>
            </div>
          </label>
          <label>
            Loan ID
            <input className="input" placeholder="e.g. L0000123" value={loanId} onChange={(e) => setLoanId(e.target.value)} />
          </label>
          <label>
            Transaction ID
            <input className="input" placeholder="Repayment ID" value={txnId} onChange={(e) => setTxnId(e.target.value)} />
          </label>
        </div>
        {/^\\d{10}$/.test(account) && (() => {
          if (!client || client.accountNumber !== account) {
            directoryLookup(account).then(setClient).catch((e) => {
              setClient(null);
              if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed');
            });
            return null;
          }
          return (
            <div className="row" style={{ gap: 24 }}>
              <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{client.name}</div></div>
              <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{client.nationalId}</div></div>
              <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB</div><div>{client.dob}</div></div>
              <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{client.phone}</div></div>
            </div>
          );
        })()}
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
