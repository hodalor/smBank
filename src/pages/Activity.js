import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listActivity, getClient, listUsers, listPostedTransactions, listLoans, listLoanRepayPosted } from '../api';
import { hasPermission, PERMISSIONS, displayUserName } from '../state/ops';
import { showError } from '../components/Toaster';

export default function Activity() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [viewTitle, setViewTitle] = useState('');
  const [viewSections, setViewSections] = useState([]);
  const [viewRaw, setViewRaw] = useState(null);
  const modalRef = useRef(null);
  const [quick, setQuick] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const canView = hasPermission(PERMISSIONS.ACTIVITY_VIEW);
  const advParams = useMemo(() => ({ actor, action, entity, from, to, limit: 200 }), [actor, action, entity, from, to]);
  const [debouncedQuick, setDebouncedQuick] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuick(quick.trim()), 400);
    return () => clearTimeout(id);
  }, [quick]);
  const queryParams = useMemo(() => {
    if (debouncedQuick) return { q: debouncedQuick, limit: 200 };
    return advParams;
  }, [debouncedQuick, advParams]);
  useEffect(() => {
    if (!canView) return;
    let stopped = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listActivity(queryParams);
        if (!stopped) setRows(data || []);
      } catch (e) {
        showError(e.message || 'Failed to load activity');
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => { stopped = true; };
  }, [canView, queryParams]);
  // Modal open/close is handled via explicit overlay click and Close button to avoid event races
  const openDetails = async (r) => {
    setOpen(true);
    setViewLoading(true);
    setViewError('');
    setViewTitle('Details');
    setViewSections([]);
    setViewRaw(null);
    try {
      if (r.entityType === 'client' && r.entityId) {
        const c = await getClient(r.entityId);
        const isCompany = !!c.companyName;
        setViewTitle(isCompany ? 'Company Client Details' : 'Individual Client Details');
        const base = [
          ['Account Number', c.accountNumber || ''],
          ['Name', isCompany ? (c.companyName || '') : (c.fullName || '')],
          ['Phone', c.phone || c.companyPhone || ''],
          ['National ID', c.nationalId || c.companyRegistrationNumber || ''],
        ];
        const extra = [];
        if (isCompany) {
          if (c.registrationDate) extra.push(['Registration Date', c.registrationDate]);
          if (Array.isArray(c.directors)) extra.push(['Directors', String(c.directors.length)]);
          if (Array.isArray(c.signatories)) extra.push(['Signatories', String(c.signatories.length)]);
        } else {
          if (c.dob) extra.push(['Date of Birth', c.dob]);
          if (c.email) extra.push(['Email', c.email]);
          if (c.address) extra.push(['Address', c.address]);
          if (c.nok1Name || c.nok1Phone) extra.push(['Next of Kin', [c.nok1Name, c.nok1Phone].filter(Boolean).join(' · ')]);
        }
        extra.push(['Created', c.createdAt || '']);
        setViewSections([...base, ...extra]);
        setViewRaw(c);
      } else if (r.entityType === 'user' && r.entityId) {
        const res = await listUsers({ q: r.entityId });
        const u = Array.isArray(res) ? res.find(x => x.username === r.entityId) : null;
        setViewTitle('User Details');
        if (u) {
          const sec = [
            ['Username', u.username || ''],
            ['Role', u.role || ''],
            ['Department', u.department || ''],
            ['Employee No', u.employeeNumber || ''],
          ];
          if (u.fullName) sec.push(['Full Name', u.fullName]);
          if (u.email) sec.push(['Email', u.email]);
          if (u.phone) sec.push(['Phone', u.phone]);
          sec.push(['Enabled', String(u.enabled)]);
          setViewSections(sec);
          setViewRaw(u);
        } else {
          setViewSections([['Username', r.entityId], ['Info', 'User record not found']]);
          setViewRaw(null);
        }
      } else if (r.entityType === 'transaction') {
        const acct = r.details && r.details.accountNumber;
        const docs = acct ? await listPostedTransactions({ accountNumber: acct }) : [];
        const t = Array.isArray(docs) ? docs.find(x => x.id === r.entityId) : null;
        setViewTitle('Transaction Details');
        if (t) {
          setViewSections([
            ['ID', t.id],
            ['Type', t.kind],
            ['Account Number', t.accountNumber],
            ['Amount', String(t.amount)],
            ['Status', t.status],
            ['Initiator', displayUserName(t.initiatorName)],
            ['Approver', displayUserName(t.approverName) || ''],
            ['Initiated At', t.initiatedAt || ''],
            ['Approved At', t.approvedAt || ''],
          ]);
          setViewRaw(t);
        } else {
          const det = r.details || {};
          setViewSections([
            ['ID', r.entityId || ''],
            ['Account Number', det.accountNumber || ''],
            ['Amount', det.amount != null ? String(det.amount) : ''],
            ['Note', 'Transaction record not found in statements'],
          ]);
          setViewRaw(r.details || null);
        }
      } else if (r.entityType === 'loan') {
        const acct = r.details && r.details.accountNumber;
        const list = acct ? await listLoans({ accountNumber: acct }) : [];
        const loan = Array.isArray(list) ? list.find(x => x.id === r.entityId) : null;
        setViewTitle('Loan Details');
        if (loan) {
          setViewSections([
            ['ID', loan.id],
            ['Account Number', loan.accountNumber],
            ['Principal', String(loan.principal)],
            ['Status', loan.status],
            ['Initiator', displayUserName(loan.initiatorName) || ''],
            ['Approver', displayUserName(loan.approverName) || ''],
            ['Initiated At', loan.initiatedAt || ''],
            ['Approved At', loan.approvedAt || ''],
          ]);
          setViewRaw(loan);
        } else {
          setViewSections([
            ['ID', r.entityId || ''],
            ['Account Number', acct || ''],
            ['Amount', r.details && r.details.amount != null ? String(r.details.amount) : ''],
            ['Note', 'Loan record not found'],
          ]);
          setViewRaw(r.details || null);
        }
      } else if (r.entityType === 'loan_repay') {
        const acct = r.details && r.details.accountNumber;
        const list = acct ? await listLoanRepayPosted({ accountNumber: acct }) : [];
        const item = Array.isArray(list) ? list.find(x => x.id === r.entityId) : null;
        setViewTitle('Loan Repayment Details');
        if (item) {
          setViewSections([
            ['ID', item.id],
            ['Account Number', item.accountNumber],
            ['Mode', item.mode],
            ['Amount', String(item.amount)],
            ['Status', item.status],
            ['Initiator', displayUserName(item.initiatorName)],
            ['Approver', displayUserName(item.approverName) || ''],
            ['Initiated At', item.initiatedAt || ''],
            ['Approved At', item.approvedAt || ''],
          ]);
          setViewRaw(item);
        } else {
          setViewSections([
            ['ID', r.entityId || ''],
            ['Account Number', acct || ''],
            ['Amount', r.details && r.details.amount != null ? String(r.details.amount) : ''],
            ['Note', 'Repayment record not found'],
          ]);
          setViewRaw(r.details || null);
        }
      } else if (r.entityType === 'config') {
        setViewTitle('Config Update');
        setViewSections([
          ['Path', r.path || ''],
          ['Method', r.method || ''],
        ]);
        setViewRaw(r.details || null);
      } else {
        setViewTitle('Details');
        setViewSections([
          ['Action', r.action || ''],
          ['Entity', r.entityType || ''],
          ['Entity ID', r.entityId || ''],
        ]);
        setViewRaw(r.details || null);
      }
    } catch (e) {
      setViewError(e.message || 'Failed to load details');
    } finally {
      setViewLoading(false);
    }
  };
  if (!canView) return <div>Not authorized.</div>;
  return (
    <div>
      <h2>Activity</h2>
      <div className="card" style={{ marginBottom: 16, display: 'grid', gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={quick} onChange={e => setQuick(e.target.value)} placeholder="Quick search: actor, action or entity (auto fetch)" style={{ flex: 1 }} />
          <button className="btn" onClick={() => setQuick('')}>Clear</button>
          <button className="btn" onClick={() => setShowAdvanced(v => !v)}>{showAdvanced ? 'Hide Advanced' : 'Advanced'}</button>
        </div>
        {showAdvanced && (
          <div className="form-row">
            <div className="form-group">
              <label>Actor</label>
              <input value={actor} onChange={e => setActor(e.target.value)} placeholder="username" />
            </div>
            <div className="form-group">
              <label>Action</label>
              <input value={action} onChange={e => setAction(e.target.value)} placeholder="e.g. user.create" />
            </div>
            <div className="form-group">
              <label>Entity</label>
              <input value={entity} onChange={e => setEntity(e.target.value)} placeholder="e.g. user, client" />
            </div>
            <div className="form-group">
              <label>From</label>
              <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setDebouncedQuick('')}>Search</button>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Time</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Path</th>
                <th>Method</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={9}>No activity.</td></tr>}
              {!loading && rows.map((r, i) => (
                <tr key={`${r._id || i}-${r.ts}`}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatTs(r.ts)}</td>
                  <td>{r.actor}</td>
                  <td>
                    <button onClick={() => openDetails(r)} style={{ background: 'none', border: 'none', padding: 0, color: '#0ea5e9', cursor: 'pointer' }}>
                      {r.role}
                    </button>
                  </td>
                  <td>{r.action}</td>
                  <td>{r.entityType}</td>
                  <td>{r.entityId}</td>
                  <td>{r.path}</td>
                  <td>{r.method}</td>
                  <td><code style={{ whiteSpace: 'pre' }}>{fmtDetails(r.details)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setOpen(false)}>
          <div ref={modalRef} className="card" style={{ width: 720, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{viewTitle}</div>
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
            </div>
            {viewLoading && <div>Loading…</div>}
            {viewError && <div style={{ color: '#dc2626' }}>{viewError}</div>}
            {!viewLoading && !viewError && (
              <>
                <table className="table">
                  <tbody>
                    {viewSections.map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <ModalLinks sections={viewSections} navigate={navigate} />
                </div>
                {viewRaw != null && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Raw</div>
                    <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
                      {safeJSONStringify(viewRaw)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalLinks({ sections, navigate }) {
  const get = (label) => sections.find(([k]) => k === label)?.[1] || '';
  const acct = get('Account Number');
  const username = get('Username');
  const id = get('ID');
  const rows = [];
  if (acct) rows.push(['Open Client Profile', () => navigate(`/clients/${acct}`)]);
  if (acct) rows.push(['Open Statements', () => navigate(`/statements?accountNumber=${encodeURIComponent(acct)}`)]);
  if (username) rows.push(['Open Users', () => navigate('/users')]);
  if (id && String(id).startsWith('L-')) rows.push(['Open Loans Records', () => navigate('/loans/records')]);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map(([label, action]) => (
        <button key={label} className="btn" onClick={action}>{label}</button>
      ))}
    </>
  );
}

function formatTs(ts) {
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleString();
    return String(ts);
  } catch {
    return String(ts);
  }
}
function fmtDetails(d) {
  try {
    if (!d) return '';
    return JSON.stringify(d);
  } catch {
    return '';
  }
}
function safeJSONStringify(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}
