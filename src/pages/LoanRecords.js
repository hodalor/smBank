import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { directoryLookup, listClients, listLoans } from '../api';
import { showError, showWarning } from '../components/Toaster';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRecords() {
  const [account, setAccount] = useState('');
  const [loanId, setLoanId] = useState('');
  const [client, setClient] = useState(null);
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const run = async () => {
      try {
        const q = {};
        if (account && /^\d{10}$/.test(account)) q.accountNumber = account;
        const res = await listLoans(q);
        setRows(res || []);
      } catch {
        setRows([]);
      }
    };
    run();
  }, [account]);

  const loans = useMemo(() => {
    const plusMonths = (dateStr, m) => {
      try {
        const d = new Date(dateStr);
        d.setMonth(d.getMonth() + (m || 0));
        return d.toISOString().slice(0, 10);
      } catch { return ''; }
    };
    const daysDiff = (d) => {
      try {
        const dd = new Date(d);
        const now = new Date();
        return Math.ceil((dd.getTime() - now.getTime()) / (24 * 3600 * 1000));
      } catch { return null; }
    };
    return rows.map(l => {
      const start = (l.approvedAt || l.createdAt || '');
      const dueISO = plusMonths(start, l.termMonths);
      const daysToDue = dueISO ? daysDiff(dueISO) : null;
      const overdueDays = daysToDue != null ? Math.max(0, -daysToDue) : 0;
      return ({
        id: l.id,
        account: l.accountNumber,
        principal: l.principal,
        interest: l.totalInterest ?? 0,
        totalDue: l.totalDue ?? (Number(l.principal || 0) + Number(l.totalInterest || 0)),
        rate: l.rate,
        months: l.termMonths,
        start: String(start).slice(0, 10),
        due: dueISO,
        daysToDue,
        overdueDays,
        status: l.status === 'Pending' ? 'Pending' : 'Active',
      });
    });
  }, [rows]);

  const filtered = useMemo(
    () => loans.filter(l => (!account || l.account === account) && (!loanId || String(l.id || '').includes(loanId.trim()))),
    [loans, account, loanId]
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
              if (/^\\d{10,13}$/.test(q)) return;
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
        {/^\\d{10,13}$/.test(account) && (
          <div className="row" style={{ gap: 24 }}>
            {(() => {
              if (!client || client.accountNumber !== account) {
                directoryLookup(account).then(setClient).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
                return null;
              }
              const c = client;
              return (
                <>
                  <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{c.name}</div></div>
                  <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{c.nationalId}</div></div>
                  <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB</div><div>{c.dob}</div></div>
                  <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{c.phone}</div></div>
                </>
              );
            })()}
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
              <th>Interest</th>
              <th>Total Payable</th>
              <th>Rate</th>
              <th>Months</th>
              <th>Start</th>
              <th>Due</th>
              <th>Days To Due</th>
              <th>Overdue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} style={{ background: l.overdueDays > 0 ? '#fff1f2' : undefined }}>
                <td><Link to={`/loans/${l.id}`}>{l.id}</Link></td>
                <td>{l.account}</td>
                <td>{gh(l.principal)}</td>
                <td>{gh(l.interest)}</td>
                <td>{gh(l.totalDue)}</td>
                <td>{l.rate}%</td>
                <td>{l.months}</td>
                <td>{l.start}</td>
                <td>{l.due ? l.due.slice(0,10) : '—'}</td>
                <td>{l.daysToDue != null ? String(l.daysToDue) : '—'}</td>
                <td>{l.overdueDays || 0}</td>
                <td>{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
