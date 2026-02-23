import { useEffect, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { approvePendingTransaction, listPendingTransactions, rejectPendingTransaction, getMe } from '../api';
import { printTxnReceipt } from '../state/ops';
import { showError, showSuccess } from '../components/Toaster';
import Pager from '../components/Pager';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function TxnApprovals() {
  const allowed = hasPermission(PERMISSIONS.TXN_APPROVALS_VIEW);
  const [rows, setRows] = useState([]);
  const [askCodeFor, setAskCodeFor] = useState(null);
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [my, setMy] = useState(null);
  const load = async () => {
    try {
      const res = await listPendingTransactions({ type: 'deposit,withdraw' });
      setRows(res);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { if (!allowed) return; load(); }, [allowed]);
  useEffect(() => { if (!allowed) return; (async () => { try { setMy(await getMe()); } catch {} })(); }, [allowed]);
  const approve = async (id) => { setAskCodeFor(id); setCode(''); setShow(false); };
  const reject = async (id) => {
    try { await rejectPendingTransaction(id, {}); showSuccess('Transaction rejected'); }
    catch { showError('Reject failed'); }
    await load();
  };
  const filtered = rows;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Deposit & Withdrawal Approvals</h1>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Account</th>
              <th>Initiator</th>
              <th>Amount</th>
              <th>Initiated</th>
              <th>Notes</th>
              <th>Client</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.kind === 'deposit' ? 'Deposit' : 'Withdrawal'}</td>
                <td>{r.accountNumber}</td>
                <td>{r.initiatorName || '—'}</td>
                <td>{r.amount ? gh(r.amount) : '—'}</td>
                <td>{r.initiatedAt || '—'}</td>
                <td>{r.meta?.notes || ''}</td>
                <td>—</td>
                <td>
                  <button className="btn btn-primary" onClick={() => approve(r.id)}>Approve</button>{' '}
                  <button className="btn" onClick={() => reject(r.id)}>Reject</button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan="8">No pending transactions.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
      </div>
      <div className="card">
        <p>This queue covers Deposits and Withdrawals only. Loan repayments are handled in Loans → Repay Approvals.</p>
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
              {my && my.approvalCode && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Hint: Find your code in My Account.</div>
              )}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn" onClick={() => setAskCodeFor(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={async () => {
                  try {
                    const posted = await approvePendingTransaction(askCodeFor, { approvalCode: code });
                    showSuccess('Transaction approved');
                    try { printTxnReceipt(posted, { copies: 2 }); } catch {}
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
