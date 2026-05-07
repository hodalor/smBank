import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { listTxnRecords, listPostedTransactions, directoryLookup } from '../api';
import { displayUserName } from '../state/ops';
import Pager from '../components/Pager';

export default function TxnRecords() {
  const allowed = hasPermission(PERMISSIONS.TXN_RECORDS_VIEW);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('All');
  const [kind, setKind] = useState('All');
  const [accountNumber, setAccountNumber] = useState('');
  const [txnId, setTxnId] = useState('');
  const [selected, setSelected] = useState(null);
  const [client, setClient] = useState(null);
  useEffect(() => {
    if (!allowed) return;
    const run = async () => {
      try {
        const q = {};
        if (accountNumber) q.accountNumber = accountNumber;
        if (kind !== 'All') q.kind = kind === 'Deposit' ? 'deposit' : 'withdraw';
        if (status !== 'All') q.status = status;
        if (txnId) q.id = txnId.trim();
        const data = await listTxnRecords(q);
        if (Array.isArray(data) && data.length) {
          setRows(data);
        } else {
          const pq = {};
          if (accountNumber) pq.accountNumber = accountNumber;
          if (kind !== 'All') pq.type = kind === 'Deposit' ? 'deposit' : 'withdraw';
          if (txnId) pq.id = txnId.trim();
          const posted = await listPostedTransactions(pq);
          setRows((posted || []).map(p => ({ ...p, status: 'Approved' })));
        }
      } catch {
        try {
          const pq = {};
          if (accountNumber) pq.accountNumber = accountNumber;
          if (kind !== 'All') pq.type = kind === 'Deposit' ? 'deposit' : 'withdraw';
          if (txnId) pq.id = txnId.trim();
          const posted = await listPostedTransactions(pq);
          setRows((posted || []).map(p => ({ ...p, status: 'Approved' })));
        } catch {
          setRows([]);
        }
      }
    };
    run();
  }, [allowed, status, kind, accountNumber, txnId]);
  useEffect(() => {
    if (!allowed) return;
    (async () => {
      if (!selected || !selected.accountNumber) { setClient(null); return; }
      try {
        const c = await directoryLookup(selected.accountNumber);
        setClient(c || null);
      } catch {
        setClient(null);
      }
    })();
  }, [allowed, selected]);
  const view = useMemo(() => {
    const mapped = rows.map(r => ({
      id: r.id,
      account: r.accountNumber,
      type: r.kind === 'deposit' ? 'Deposit' : 'Withdrawal',
      amount: Number(r.amount || 0),
      status: r.status || 'Pending',
      initiator: displayUserName(r.initiatorName) || '',
      approver: displayUserName(r.approverName) || '',
      initiatedAt: r.initiatedAt || '',
      approvedAt: r.approvedAt || r.rejectedAt || '',
      meta: r.meta || {},
    }));
    return mapped.filter(r => status === 'All' || r.status === status);
  }, [rows, status]);
  const toCurrency = (n) => {
    try { return Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' }); } catch { return `GHS ${Number(n || 0).toFixed(2)}`; }
  };
  const metaLines = (r) => {
    if (!r || !r.meta) return [];
    const m = r.meta || {};
    const lines = [];
    if (m.notes) lines.push(`Notes: ${m.notes}`);
    if (r.type === 'Deposit') {
      if (m.depositorName) lines.push(`Depositor: ${m.depositorName}`);
      if (m.depositorAddress) lines.push(`Address: ${m.depositorAddress}`);
      if (m.incomeSource) lines.push(`Income Source: ${m.incomeSource}`);
      if (m.method) lines.push(`Method: ${String(m.method).toUpperCase()}`);
    } else {
      if (m.withdrawerName) lines.push(`Withdrawer: ${m.withdrawerName}`);
      if (m.withdrawerIdNumber) lines.push(`Withdrawer ID: ${m.withdrawerIdNumber}`);
      if (m.withdrawerPhone) lines.push(`Withdrawer Phone: ${m.withdrawerPhone}`);
      if (m.withdrawerAddress) lines.push(`Withdrawer Address: ${m.withdrawerAddress}`);
    }
    return lines;
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const start = (page - 1) * pageSize;
  const pageRows = view.slice(start, start + pageSize);
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Transaction Records</h1>
      <div className="card row" style={{ gap: 12, alignItems: 'end' }}>
        <label style={{ flex: 1 }}>
          Status
          <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
            <option>All</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Type
          <select className="input" value={kind} onChange={e => setKind(e.target.value)}>
            <option>All</option>
            <option>Deposit</option>
            <option>Withdrawal</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Account Number
          <input className="input" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Filter by account" />
        </label>
        <label style={{ flex: 1 }}>
          Transaction ID
          <input className="input" value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="Search by ID" />
        </label>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Initiated</th>
              <th>Approved/Rejected</th>
              <th>Initiator</th>
              <th>Approver</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(r => (
              <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                <td>{r.id}</td>
                <td>{r.type}</td>
                <td><span style={{ padding: '2px 8px', borderRadius: 999, background: r.status === 'Approved' ? '#dcfce7' : r.status === 'Rejected' ? '#fee2e2' : '#e2e8f0', color: '#0f172a' }}>{r.status}</span></td>
                <td>{r.account}</td>
                <td>{toCurrency(r.amount)}</td>
                <td>{r.initiatedAt || '—'}</td>
                <td>{r.approvedAt || '—'}</td>
                <td>{r.initiator || '—'}</td>
                <td>{r.approver || '—'}</td>
              </tr>
            ))}
            {!view.length && (
              <tr>
                <td colSpan="9">No records.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager total={view.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
      </div>
      {selected && (
        <div className="detail-modal-overlay" onClick={() => setSelected(null)}>
          <div className="card detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-modal-header">
              <div>
                <div className="detail-modal-title">{selected.type} Details</div>
                <div className="detail-modal-subtitle">Transaction ID: {selected.id}</div>
              </div>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="detail-modal-grid" style={{ marginBottom: 12 }}>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Status</div>
                <div>
                  <span className="detail-modal-pill" style={{ background: selected.status === 'Approved' ? '#dcfce7' : selected.status === 'Rejected' ? '#fee2e2' : '#e2e8f0', color: '#0f172a' }}>{selected.status}</span>
                </div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Account</div>
                <div className="detail-modal-value">{selected.account}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Amount</div>
                <div className="detail-modal-value">{toCurrency(selected.amount)}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Customer</div>
                <div className="detail-modal-value">{client ? client.name : '—'}</div>
              </div>
            </div>
            <div className="detail-modal-grid" style={{ marginBottom: 12 }}>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Initiator</div>
                <div>{selected.initiator || '—'}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Approver</div>
                <div>{selected.approver || '—'}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Initiated</div>
                <div>{selected.initiatedAt || '—'}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Approved/Rejected</div>
                <div>{selected.approvedAt || '—'}</div>
              </div>
            </div>
            {metaLines(selected).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="detail-modal-label" style={{ marginBottom: 8 }}>Details</div>
                <div className="detail-modal-notes">
                  {metaLines(selected).map((line, idx) => (<div key={idx}>{line}</div>))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
