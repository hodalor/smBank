import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getLoan } from '../api';
import { displayUserName, hasPermission, PERMISSIONS } from '../state/ops';
import { showError } from '../components/Toaster';
import { IconDownload } from '../components/Icons';
import { openBrandedPrintWindow } from '../utils/printLayouts';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanDetails() {
  const allowed = hasPermission(PERMISSIONS.LOANS_RECORDS_VIEW);
  const { id } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!allowed || !id) return;
    getLoan(id).then(setData).catch(() => showError('Failed to load loan'));
  }, [allowed, id]);
  if (!allowed) return <div className="card">Not authorized.</div>;
  if (!data) return <div className="card">Loading…</div>;
  const { loan, client, repayments, summary } = data;
  const fees = (loan.totalFees ?? 0);
  const exportPdf = () => {
    openBrandedPrintWindow({
      title: `Loan ${loan.id}`,
      subtitle: 'Loan detail sheet',
      badges: [loan.status || 'Pending', `Account ${loan.accountNumber}`],
      summaryCards: [
        { label: 'Principal', value: gh(loan.principal) },
        { label: 'Interest', value: gh(loan.totalInterest) },
        { label: 'Total Payable', value: gh(loan.totalDue) },
        { label: 'Outstanding', value: gh(summary?.outstanding ?? Math.max(0, Number(loan.totalDue || 0) - Number(summary?.totalRepaid || 0))) },
      ],
      sections: [
        {
          title: 'Borrower Info',
          rows: [
            ['Name', client?.fullName || client?.companyName || '—'],
            ['National ID', client?.nationalId || client?.registrationNumber || '—'],
            ['DOB/Reg Date', client?.dob || client?.registrationDate || '—'],
            ['Phone', client?.phone || client?.companyPhone || '—'],
          ],
        },
        {
          title: 'Timeline & Portfolio',
          rows: [
            ['Initiated', loan.createdAt ? new Date(loan.createdAt).toLocaleString() : '—'],
            ['Initiator', displayUserName(loan.initiatorName) || '—'],
            ['Approved', loan.approvedAt ? new Date(loan.approvedAt).toLocaleString() : '—'],
            ['Approver', displayUserName(loan.approverName) || '—'],
            ['Due Date', summary?.dueDate ? new Date(summary.dueDate).toLocaleDateString() : '—'],
            ['Penalty Accrued', gh(summary?.penaltyAccrued || 0)],
          ],
        },
      ],
      tables: [{
        title: 'Repayments',
        columns: [
          { key: 'id', label: 'Repay ID' },
          { key: 'amount', label: 'Amount' },
          { key: 'initiator', label: 'Initiator' },
          { key: 'initiatedAt', label: 'Initiated' },
          { key: 'approver', label: 'Approver' },
          { key: 'approvedAt', label: 'Approved' },
        ],
        rows: (repayments || []).map((r) => ({
          id: r.id,
          amount: gh(r.amount),
          initiator: displayUserName(r.initiatorName) || '—',
          initiatedAt: r.initiatedAt ? new Date(r.initiatedAt).toLocaleString() : '—',
          approver: displayUserName(r.approverName) || '—',
          approvedAt: r.approvedAt ? new Date(r.approvedAt).toLocaleString() : '—',
        })),
        emptyText: 'No repayments posted.',
      }],
    });
  };
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>Loan {loan.id}</h1>
          <div className="dashboard-subtitle">Branded loan detail view with portfolio summary and borrower information.</div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={exportPdf}><IconDownload /><span>Export PDF</span></button>
          <Link className="btn" to="/loans/records">Back to Records</Link>
        </div>
      </div>
      <div className="card client-sheet">
        <div className="client-sheet-brand">
          <div className="client-sheet-branding">
            <img src="/logo512.png" alt="smBank" className="client-sheet-logo" />
            <div>
              <div className="client-sheet-brand-title">Loan Detail Sheet</div>
              <div className="client-sheet-brand-subtitle">Account {loan.accountNumber}</div>
            </div>
          </div>
          <div className="client-sheet-muted">Status {loan.status}</div>
        </div>
        <div className="client-sheet-body">
          <div className="client-sheet-summary">
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Principal</div><div className="client-sheet-stat-value">{gh(loan.principal)}</div></div>
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Rate / Term</div><div className="client-sheet-stat-value">{loan.rate}% · {loan.termMonths} months</div></div>
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Interest + Fees</div><div className="client-sheet-stat-value">{gh(Number(loan.totalInterest || 0) + Number(fees || 0))}</div></div>
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Outstanding</div><div className="client-sheet-stat-value">{gh(summary?.outstanding ?? Math.max(0, Number(loan.totalDue || 0) - Number(summary?.totalRepaid || 0)))}</div></div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Borrower Info</h3>
        <div className="client-sheet-grid">
          <div className="client-sheet-item"><div className="client-sheet-item-label">Name</div><div className="client-sheet-item-value">{client?.fullName || client?.companyName || '—'}</div></div>
          <div className="client-sheet-item"><div className="client-sheet-item-label">National ID</div><div className="client-sheet-item-value">{client?.nationalId || client?.registrationNumber || '—'}</div></div>
          <div className="client-sheet-item"><div className="client-sheet-item-label">DOB/Reg Date</div><div className="client-sheet-item-value">{client?.dob || client?.registrationDate || '—'}</div></div>
          <div className="client-sheet-item"><div className="client-sheet-item-label">Phone</div><div className="client-sheet-item-value">{client?.phone || client?.companyPhone || '—'}</div></div>
        </div>
      </div>
      <div className="card">
        <h3>Timeline & Actors</h3>
        <div className="client-sheet-grid">
          <div className="client-sheet-item"><div className="client-sheet-item-label">Initiated</div><div className="client-sheet-item-value">{loan.createdAt ? new Date(loan.createdAt).toLocaleString() : '—'}</div></div>
          <div className="client-sheet-item"><div className="client-sheet-item-label">Initiator</div><div className="client-sheet-item-value">{displayUserName(loan.initiatorName) || '—'}</div></div>
          <div className="client-sheet-item"><div className="client-sheet-item-label">Approved</div><div className="client-sheet-item-value">{loan.approvedAt ? new Date(loan.approvedAt).toLocaleString() : '—'}</div></div>
          <div className="client-sheet-item"><div className="client-sheet-item-label">Approver</div><div className="client-sheet-item-value">{displayUserName(loan.approverName) || '—'}</div></div>
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
