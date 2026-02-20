import { useMemo, useState } from 'react';

export default function LoanApprovals() {
  const initial = useMemo(
    () => [
      { id: 'LN-1001', accountNumber: '4839201746', principal: 500, rate: 10, months: 6, status: 'Pending' },
      { id: 'LN-1002', accountNumber: '7392046158', principal: 300, rate: 8, months: 4, status: 'Pending' }
    ],
    []
  );
  const [rows, setRows] = useState(initial);
  const approve = (id) => setRows(list => list.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
  const reject = (id) => setRows(list => list.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
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
                <td>{r.months}</td>
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
