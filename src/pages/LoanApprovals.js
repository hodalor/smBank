import { useEffect, useState } from 'react';
import { approveLoan, listLoanApprovals, rejectLoan } from '../api';
import { showError, showSuccess } from '../components/Toaster';

export default function LoanApprovals() {
  const [rows, setRows] = useState([]);
  const load = async () => {
    try {
      const res = await listLoanApprovals();
      setRows(res);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { load(); }, []);
  const approve = async (id) => {
    try { await approveLoan(id); showSuccess('Loan approved and disbursed'); }
    catch { showError('Approve failed'); }
    await load();
  };
  const reject = async (id) => {
    try { await rejectLoan(id, {}); showSuccess('Loan rejected'); }
    catch { showError('Reject failed'); }
    await load();
  };
  const pending = rows.filter(r => r.status === 'Pending');
  const processed = rows.filter(r => r.status !== 'Pending');
  return (
    <div className="stack">
      <h1>Loan Approvals</h1>
      <div className="card">
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
            {pending.map(r => (
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
            {processed.map(r => (
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
      </div>
    </div>
  );
}
