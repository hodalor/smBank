import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getLoan } from '../api';
import { displayUserName } from '../state/ops';
import { showError } from '../components/Toaster';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!id) return;
    getLoan(id).then(setData).catch(() => showError('Failed to load loan'));
  }, [id]);
  if (!data) return <div className="card">Loading…</div>;
  const { loan, client, repayments, summary } = data;
  const fees = (loan.totalFees ?? 0);
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Loan {loan.id}</h1>
        <Link className="btn" to="/loans/records">Back to Records</Link>
      </div>
      <div className="card row" style={{ gap: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Account</div>
          <div style={{ fontWeight: 700 }}>{loan.accountNumber}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Principal</div>
          <div style={{ fontWeight: 700 }}>{gh(loan.principal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Rate / Term</div>
          <div style={{ fontWeight: 700 }}>{loan.rate}% · {loan.termMonths} months</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Interest</div>
          <div style={{ fontWeight: 700 }}>{gh(loan.totalInterest)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Fees</div>
          <div style={{ fontWeight: 700 }}>{gh(fees)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Total Payable</div>
          <div style={{ fontWeight: 700 }}>{gh(loan.totalDue)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Status</div>
          <div style={{ fontWeight: 700 }}>{loan.status}</div>
        </div>
      </div>
      <div className="card">
        <h3>Borrower Info</h3>
        <div className="row" style={{ gap: 24 }}>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{client?.fullName || client?.companyName || '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{client?.nationalId || client?.registrationNumber || '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB/Reg Date</div><div>{client?.dob || client?.registrationDate || '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{client?.phone || client?.companyPhone || '—'}</div></div>
        </div>
      </div>
      <div className="card">
        <h3>Timeline & Actors</h3>
        <div className="row" style={{ gap: 24 }}>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Initiated</div><div>{loan.createdAt ? new Date(loan.createdAt).toLocaleString() : '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Initiator</div><div>{displayUserName(loan.initiatorName) || '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Approved</div><div>{loan.approvedAt ? new Date(loan.approvedAt).toLocaleString() : '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Approver</div><div>{displayUserName(loan.approverName) || '—'}</div></div>
        </div>
      </div>
      <div className="card">
        <h3>Schedule & Overdue</h3>
        <div className="row" style={{ gap: 24 }}>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Due Date</div><div>{summary?.dueDate ? new Date(summary.dueDate).toLocaleDateString() : '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Days to Due</div><div>{summary?.daysToDue != null ? String(summary.daysToDue) : '—'}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Overdue Days</div><div>{summary?.overdueDays || 0}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Grace Days</div><div>{summary?.graceDays || 0}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Penalty Rate</div><div>{(summary?.overdueDailyRate ?? 0)}%/day</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Penalty Accrued</div><div style={{ fontWeight: 700 }}>{gh(summary?.penaltyAccrued || 0)}</div></div>
        </div>
      </div>
      <div className="card">
        <h3>Loan Attachments</h3>
        {(Array.isArray(loan.attachments) && loan.attachments.length > 0) ? (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {loan.attachments.map((a, i) => (
              <div key={i} className="card" style={{ padding: 8, width: 220 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{a.tag || a.name || 'file'}</div>
                {String(a.contentType || '').startsWith('image/') ? (
                  <img src={a.url} alt={a.name || a.tag || 'attachment'} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                ) : (
                  <div style={{ fontSize: 12, color: '#64748b' }}>{a.contentType || 'document'}</div>
                )}
                <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
                  <a className="btn" href={a.url} target="_blank" rel="noreferrer">Open</a>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{Math.round((Number(a.size || 0) / 1024) * 10) / 10} KB</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>No loan attachments.</div>
        )}
      </div>
      <div className="card">
        <h3>Client Attachments</h3>
        {(() => {
          const catts = Array.isArray(client?.attachments) ? client.attachments : (Array.isArray(client?.data?.attachments) ? client.data.attachments : []);
          if (!catts.length) return null;
          return (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {catts.map((a, i) => (
              <div key={i} className="card" style={{ padding: 8, width: 220 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{a.tag || a.name || 'file'}</div>
                {String(a.contentType || '').startsWith('image/') ? (
                  <img src={a.url} alt={a.name || a.tag || 'attachment'} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                ) : (
                  <div style={{ fontSize: 12, color: '#64748b' }}>{a.contentType || 'document'}</div>
                )}
                <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
                  <a className="btn" href={a.url} target="_blank" rel="noreferrer">Open</a>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{Math.round((Number(a.size || 0) / 1024) * 10) / 10} KB</div>
                </div>
              </div>
            ))}
          </div>
          );
        })() || <div>No client attachments.</div>}
      </div>
      <div className="card">
        <h3>Repayments</h3>
        <div className="row" style={{ gap: 24 }}>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Total Repaid</div><div style={{ fontWeight: 700 }}>{gh(summary?.totalRepaid || 0)}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Outstanding</div><div style={{ fontWeight: 700 }}>{gh(summary?.outstanding ?? Math.max(0, Number(loan.totalDue || 0) - Number(summary?.totalRepaid || 0)))}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Outstanding + Penalty</div><div style={{ fontWeight: 700 }}>{gh((summary?.outstandingWithPenalty ?? 0))}</div></div>
        </div>
        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Repay ID</th>
              <th>Amount</th>
              <th>Initiator</th>
              <th>Initiated</th>
              <th>Approver</th>
              <th>Approved</th>
            </tr>
          </thead>
          <tbody>
            {(repayments || []).map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{gh(r.amount)}</td>
                <td>{displayUserName(r.initiatorName) || '—'}</td>
                <td>{r.initiatedAt ? new Date(r.initiatedAt).toLocaleString() : '—'}</td>
                <td>{displayUserName(r.approverName) || '—'}</td>
                <td>{r.approvedAt ? new Date(r.approvedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {(!repayments || repayments.length === 0) && <tr><td colSpan="6">No repayments posted.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
