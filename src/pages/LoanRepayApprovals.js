import { useEffect, useMemo, useState } from 'react';
import { approveLoanRepayPending, listLoanRepayPending, rejectLoanRepayPending } from '../api';
import { showError, showSuccess } from '../components/Toaster';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRepayApprovals() {
  const [rows, setRows] = useState([]);
  const load = async () => {
    try {
      const res = await listLoanRepayPending();
      setRows(res);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { load(); }, []);
  const repayRows = useMemo(() => rows, [rows]);
  const approve = async (id) => {
    try { await approveLoanRepayPending(id); showSuccess('Repayment approved'); }
    catch { showError('Approve failed'); }
    await load();
  };
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
    </div>
  );
}
