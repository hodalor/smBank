import { useEffect, useMemo, useState } from 'react';
import { approvePendingTxn, getPendingTxns, onPendingUpdate, rejectPendingTxn } from '../state/ops';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRepayApprovals() {
  const [rows, setRows] = useState(getPendingTxns());
  useEffect(() => onPendingUpdate(setRows), []);
  const repayRows = useMemo(() => rows.filter(r => r.type === 'Loan Repayment'), [rows]);
  const approve = (id) => approvePendingTxn(id);
  const reject = (id) => rejectPendingTxn(id);
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
                <td>{r.client?.name || '—'}</td>
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
