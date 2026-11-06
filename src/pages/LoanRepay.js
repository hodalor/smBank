import { useEffect, useState } from 'react';
import { getCurrentUserName, hasPermission, PERMISSIONS } from '../state/ops';
import { createLoanRepayment, directoryLookup, listClients, listLoanRepayPosted, listLoanRepayPending, listLoans } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';
import { IconPlus, IconSearch, IconSend } from '../components/Icons';
import Modal from '../components/Modal';
import Pager from '../components/Pager';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRepay() {
  const allowed = hasPermission(PERMISSIONS.LOANS_REPAY_CREATE);
  const [account, setAccount] = useState('');
  const [loanId, setLoanId] = useState('');
  const [mode, setMode] = useState('full'); // full | partial | writeoff
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const [loan, setLoan] = useState(null);
  const [outstanding, setOutstanding] = useState(0);
  const [paidToDate, setPaidToDate] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const loadRows = async () => {
    try {
      const [pending, posted] = await Promise.all([
        listLoanRepayPending().catch(() => []),
        listLoanRepayPosted({}),
      ]);
      const mapped = [
        ...(pending || []).map((r) => ({ ...r, status: r.status || 'Pending' })),
        ...(posted || []).map((r) => ({ ...r, status: r.status || 'Approved' })),
      ];
      setRows(mapped);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { if (allowed) loadRows(); }, [allowed]);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!loanId) { setLoan(null); setOutstanding(0); return; }
      try {
        let loans = [];
        if (account && /^\d{10}$/.test(account)) {
          loans = await listLoans({ accountNumber: account, status: 'Active' });
        } else {
          loans = await listLoans({ status: 'Active' });
        }
        const found = loans.find(l => l.id === loanId) || null;
        if (!mounted) return;
        setLoan(found);
        if (found) {
          const posted = await listLoanRepayPosted({ accountNumber: found.accountNumber });
          const totalRepaid = posted.filter(r => r.loanId === loanId && r.mode !== 'writeoff').reduce((s, r) => s + Number(r.amount || 0), 0);
          const totalWriteOff = posted.filter(r => r.loanId === loanId && r.mode === 'writeoff').reduce((s, r) => s + Number(r.amount || 0), 0);
          const base = Number((found.totalDue ?? (Number(found.principal || 0) + Number(found.totalInterest || 0))) || 0);
          setOutstanding(Math.max(base - totalRepaid - totalWriteOff, 0));
          setPaidToDate(totalRepaid);
        } else {
          setOutstanding(0);
          setPaidToDate(0);
        }
      } catch {
        if (!mounted) return;
        setLoan(null);
        setOutstanding(0);
        setPaidToDate(0);
      }
    };
    run();
    return () => { mounted = false; };
  }, [loanId, account]);

  const [client, setClient] = useState(null);
  const lookup = () => {
    const q = (account || '').trim();
    if (!q) return;
    (async () => {
      try {
        if (/^\d{10}$/.test(q)) {
          const info = await directoryLookup(q);
          setClient(info);
          return;
        }
        const res = await listClients({ q });
        if (res && res.length) {
          const acct = res[0].accountNumber;
          setAccount(acct);
          const info = await directoryLookup(acct);
          setClient(info);
          return;
        }
        setClient(null);
        showWarning('No matching client found');
      } catch (e) {
        setClient(null);
        if (e && e.status === 404) showError('Account not found');
        else showError('Lookup failed');
      }
    })();
  };
  const submit = (e) => {
    e.preventDefault();
    if (!allowed) {
      showError('Not authorized to create loan repayments');
      return;
    }
    if (!loanId || !account) {
      showWarning('Enter account and loan ID');
      return;
    }
    if (mode !== 'full' && !amount) return showWarning('Enter amount for partial or write-off');
    const finalAmount = mode === 'full' ? outstanding : Number(amount);
    (async () => {
      try {
        await createLoanRepayment(loanId, { mode, amount: finalAmount, initiatorName: getCurrentUserName() });
        showSuccess('Loan repayment submitted for approval');
        setAmount('');
        setNote('');
        setShowForm(false);
        await loadRows();
      } catch {
        showError('Failed to submit loan repayment');
      }
    })();
  };

  const pageRows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Repay Loan</h1>
        <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}><IconPlus /><span>Add Repayment</span></button>
      </div>
      <div className="card">
        <h3>Repayment Records</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Loan ID</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.loanId}</td>
                <td>{r.accountNumber}</td>
                <td>{gh(r.amount)}</td>
                <td>{r.mode || '—'}</td>
                <td>{r.status || 'Pending'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="6">No repayments yet. Click Add Repayment to create one.</td></tr>}
          </tbody>
        </table>
        <Pager total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
      </div>
      <Modal open={showForm} title="Repay Loan" subtitle="Repayments are submitted for approval" onClose={() => setShowForm(false)}>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Account Number
            <div className="row">
              <input className="input" value={account} onChange={(e) => setAccount(e.target.value)} onBlur={lookup} placeholder="Account / Name / ID" required />
              <button className="btn" type="button" onClick={lookup}><IconSearch /><span>Lookup</span></button>
            </div>
          </label>
          <label>
            Loan ID
            <input className="input" value={loanId} onChange={(e) => setLoanId(e.target.value)} placeholder="e.g. L0000123" required />
          </label>
          <label>
            Mode
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="full">Full Repayment</option>
              <option value="partial">Partial Repayment</option>
              <option value="writeoff">Write Off</option>
            </select>
          </label>
          <label>
            Loan Balance
            <input className="input" value={loan ? gh(outstanding) : '—'} readOnly />
          </label>
          <label>
            Amount Paid (To Date)
            <input className="input" value={loan ? gh(paidToDate) : '—'} readOnly />
          </label>
        </div>
        {client && (
          <div className="row" style={{ gap: 24 }}>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{client.name}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{client.nationalId}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB</div><div>{client.dob}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{client.phone}</div></div>
          </div>
        )}
        {mode !== 'full' && (
          <label>
            {mode === 'partial' ? 'Amount Paying' : 'Amount to Write Off'}
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
        )}
        <label>
          Notes
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
        <div className="row">
          <button className="btn btn-primary" type="submit"><IconSend /><span>Submit for Approval</span></button>
        </div>
      </form>
      </Modal>
      <div className="card">
        <h3>Policy</h3>
        <ul>
          <li>Full repayment clears outstanding and counts as revenue.</li>
          <li>Partial repayment reduces outstanding and counts as revenue.</li>
          <li>Write off clears outstanding but is not counted as revenue and is tracked separately.</li>
        </ul>
      </div>
    </div>
  );
}
