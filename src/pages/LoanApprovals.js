import { useEffect, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { approveLoan, listLoanApprovals, rejectLoan, getMe } from '../api';
import { printLoanDisbursementReceipt } from '../state/ops';
import { showError, showSuccess } from '../components/Toaster';
import Pager from '../components/Pager';

export default function LoanApprovals() {
  const allowed = hasPermission(PERMISSIONS.LOANS_APPROVALS_VIEW);
  const [rows, setRows] = useState([]);
  const [loanFilter, setLoanFilter] = useState('');
  const [askCodeFor, setAskCodeFor] = useState(null);
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [my, setMy] = useState(null);
  const load = async () => {
    try {
      const res = await listLoanApprovals();
      setRows(res);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { if (!allowed) return; load(); }, [allowed]);
  useEffect(() => { if (!allowed) return; (async () => { try { setMy(await getMe()); } catch {} })(); }, [allowed]);
  const approve = async (id) => { setAskCodeFor(id); setCode(''); setShow(false); };
  const reject = async (id) => {
    try { await rejectLoan(id, {}); showSuccess('Loan rejected'); }
    catch { showError('Reject failed'); }
    await load();
  };
  const pending = rows.filter(r => r.status === 'Pending' && (!loanFilter || String(r.id || '').includes(loanFilter.trim())));
  const processed = rows.filter(r => r.status !== 'Pending' && (!loanFilter || String(r.id || '').includes(loanFilter.trim())));
  const [pPage, setPPage] = useState(1);
  const [pSize, setPSize] = useState(10);
  const [dPage, setDPage] = useState(1);
  const [dSize, setDSize] = useState(10);
  const pRows = pending.slice((pPage-1)*pSize, (pPage-1)*pSize + pSize);
  const dRows = processed.slice((dPage-1)*dSize, (dPage-1)*dSize + dSize);
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Loan Approvals</h1>
      <div className="card">
        <div className="row" style={{ marginBottom: 12, gap: 12 }}>
          <label style={{ width: 280 }}>
            Loan ID
            <input className="input" placeholder="e.g. L0000123" value={loanFilter} onChange={(e) => setLoanFilter(e.target.value)} />
          </label>
        </div>
        <h3>Pending</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Account</th>
              <th>Principal</th>
              <th>Rate (%)</th>
              <th>Months</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pRows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.accountNumber}</td>
                <td>{r.principal}</td>
                <td>{r.rate}</td>
                <td>{r.termMonths}</td>
                <td>
                  <button className="btn btn-primary" onClick={() => approve(r.id)}>Approve</button>{' '}
                  <button className="btn" onClick={() => reject(r.id)}>Reject</button>
                </td>
              </tr>
            ))}
            {!pending.length && (
              <tr><td colSpan="6">No pending loans.</td></tr>
            )}
          </tbody>
        </table>
        <Pager total={pending.length} page={pPage} pageSize={pSize} onPageChange={setPPage} onPageSizeChange={(n) => { setPSize(n); setPPage(1); }} />
      </div>
      <div className="card">
        <h3>Processed</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Account</th>
              <th>Principal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dRows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.accountNumber}</td>
                <td>{r.principal}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {!processed.length && (
              <tr><td colSpan="4">No processed loans.</td></tr>
            )}
          </tbody>
        </table>
        <Pager total={processed.length} page={dPage} pageSize={dSize} onPageChange={setDPage} onPageSizeChange={(n) => { setDSize(n); setDPage(1); }} />
      </div>
      {askCodeFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setAskCodeFor(null)}>
          <div className="card" style={{ width: 420, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>Enter Approval Code</div>
              <button className="btn" onClick={() => setAskCodeFor(null)}>Close</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Approval code is 6 digits. It renews daily at 00:00 UTC.</div>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" type={show ? 'text' : 'password'} value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="******" style={{ flex: 1 }} />
                <button className="btn" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
              </div>
              {my && my.approvalCode && <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Hint: Find your code in My Account.</div>}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn" onClick={() => setAskCodeFor(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={async () => {
                  try {
                    const loan = await approveLoan(askCodeFor, { approvalCode: code });
                    showSuccess('Loan approved and disbursed');
                    try { printLoanDisbursementReceipt(loan, { copies: 2 }); } catch {}
                    setAskCodeFor(null);
                    await load();
                  } catch (e) {
                    if (e.status === 401 || String(e.message).includes('approval_code')) showError('Invalid approval code');
                    else showError('Approve failed');
                  }
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
