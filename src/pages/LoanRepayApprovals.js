import { useEffect, useMemo, useState } from 'react';
import { approveLoanRepayPending, listLoanRepayPending, rejectLoanRepayPending, getMe } from '../api';
import { showError, showSuccess } from '../components/Toaster';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRepayApprovals() {
  const [rows, setRows] = useState([]);
  const [askCodeFor, setAskCodeFor] = useState(null);
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [my, setMy] = useState(null);
  const load = async () => {
    try {
      const res = await listLoanRepayPending();
      setRows(res);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { (async () => { try { setMy(await getMe()); } catch {} })(); }, []);
  const repayRows = useMemo(() => rows, [rows]);
  const approve = async (id) => { setAskCodeFor(id); setCode(''); setShow(false); };
  const reject = async (id) => {
    try { await rejectLoanRepayPending(id, {}); showSuccess('Repayment rejected'); }
    catch { showError('Reject failed'); }
    await load();
  };
  return (
    <div className="stack">
      <h1>Repay Loan Approvals</h1>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Loan ID</th>
              <th>Account</th>
              <th>Initiator</th>
              <th>Mode</th>
              <th>Amount</th>
              <th>Initiated</th>
              <th>Client</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {repayRows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.loanId}</td>
                <td>{r.accountNumber}</td>
                <td>{r.initiatorName || '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.mode}</td>
                <td>{gh(r.amount)}</td>
                <td>{r.initiatedAt || '—'}</td>
                <td>—</td>
                <td>{r.note || ''}</td>
                <td>
                  <button className="btn btn-primary" onClick={() => approve(r.id)}>Approve</button>{' '}
                  <button className="btn" onClick={() => reject(r.id)}>Reject</button>
                </td>
              </tr>
            ))}
            {!repayRows.length && (
              <tr>
                <td colSpan="9">No pending loan repayments.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card">
        <p>Approving Full or Partial repayments posts revenue. Approving Write‑Off posts a non‑revenue write‑off entry.</p>
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
                    await approveLoanRepayPending(askCodeFor, { approvalCode: code });
                    showSuccess('Repayment approved');
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
