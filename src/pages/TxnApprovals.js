import { useEffect, useState } from 'react';
import { approvePendingTransaction, listPendingTransactions, rejectPendingTransaction } from '../api';
import { showError, showSuccess } from '../components/Toaster';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function TxnApprovals() {
  const [rows, setRows] = useState([]);
  const load = async () => {
    try {
      const res = await listPendingTransactions({ type: 'deposit,withdraw' });
      setRows(res);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { load(); }, []);
  const approve = async (id) => {
    try { await approvePendingTransaction(id, {}); showSuccess('Transaction approved'); }
    catch { showError('Approve failed'); }
    await load();
  };
  const reject = async (id) => {
    try { await rejectPendingTransaction(id, {}); showSuccess('Transaction rejected'); }
    catch { showError('Reject failed'); }
    await load();
  };
  const filtered = rows;
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
            {filtered.map(r => (
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
      </div>
      <div className="card">
        <p>This queue covers Deposits and Withdrawals only. Loan repayments are handled in Loans → Repay Approvals.</p>
      </div>
    </div>
  );
}
