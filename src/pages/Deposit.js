import { useEffect, useState } from 'react';
import { getCurrentUserName, hasPermission, PERMISSIONS } from '../state/ops';
import { createDeposit, directoryLookup, listClients, listPostedTransactions, listLoanRepayPosted, listLoans, listTxnRecords } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';
import { IconPlus, IconSearch, IconSend } from '../components/Icons';
import Modal from '../components/Modal';
import Pager from '../components/Pager';

export default function Deposit() {
  const allowed = hasPermission(PERMISSIONS.DEPOSIT_CREATE);
  const [form, setForm] = useState({
    accountNumber: '',
    depositorName: '',
    depositorAddress: '',
    incomeSource: '',
    amount: '',
    date: '',
    method: 'cash',
    notes: ''
  });
  const [client, setClient] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [accountBal, setAccountBal] = useState(0);
  const [loanBal, setLoanBal] = useState(0);
  const [initiatedAt] = useState(new Date().toLocaleString());
  const [accountStatus, setAccountStatus] = useState('Active');
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const loadRows = async () => {
    try {
      const data = await listTxnRecords({ kind: 'deposit' });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      try {
        const posted = await listPostedTransactions({ type: 'deposit' });
        setRows((posted || []).map((p) => ({ ...p, status: 'Approved' })));
      } catch {
        setRows([]);
      }
    }
  };
  useEffect(() => { if (allowed) loadRows(); }, [allowed]);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const toCurrency = (n) => {
    const num = Number(n || 0);
    try { return num.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' }); } catch { return `GHS ${num.toFixed(2)}`; }
  };
  const computeBalances = async (acct) => {
    setLoadingBal(true);
    try {
      const [tx, rep, loans] = await Promise.all([
        listPostedTransactions({ accountNumber: acct }),
        listLoanRepayPosted({ accountNumber: acct }),
        listLoans({ accountNumber: acct }),
      ]);
      const deposits = (tx || []).filter(t => t.kind === 'deposit').reduce((s, t) => s + Number(t.amount || 0), 0);
      const withdrawals = (tx || []).filter(t => t.kind === 'withdraw').reduce((s, t) => s + Number(t.amount || 0), 0);
      // Main account balance excludes all loan transactions
      setAccountBal(deposits - withdrawals);
      // Loan outstanding = sum(totalDue of active loans) - repayments - write‑offs
      const activeLoans = (loans || []).filter(l => !l.status || l.status === 'Active');
      const totalDue = activeLoans.reduce((s, l) => s + Number((l.totalDue ?? (Number(l.principal || 0) + Number(l.totalInterest || 0))) || 0), 0);
      const repaid = (rep || []).reduce((s, r) => s + Number(r.amount || 0), 0); // includes write-offs
      setLoanBal(Math.max(0, totalDue - repaid));
    } catch {
      setAccountBal(0);
      setLoanBal(0);
    } finally {
      setLoadingBal(false);
    }
  };
  const lookup = () => {
    const q = (form.accountNumber || '').trim();
    if (!q) return;
    (async () => {
      try {
        if (/^\d{10}$/.test(q)) {
          const info = await directoryLookup(q);
          setClient(info);
          setAccountStatus(info.status || 'Active');
          await computeBalances(q);
          return;
        }
        const res = await listClients({ q });
        if (res && res.length) {
          const acct = res[0].accountNumber;
          setForm(f => ({ ...f, accountNumber: acct }));
          const info = await directoryLookup(acct);
          setClient(info);
          setAccountStatus(info.status || 'Active');
          await computeBalances(acct);
          return;
        }
        setClient(null);
        setAccountBal(0);
        setLoanBal(0);
      } catch {
        setClient(null);
        setAccountBal(0);
        setLoanBal(0);
      }
    })();
  };
  const submit = (e) => {
    e.preventDefault();
    (async () => {
      try {
        if (!allowed) {
          showError('Not authorized to create deposits');
          return;
        }
        if (!form.accountNumber || !form.amount) {
          showWarning('Enter account and amount');
          return;
        }
        if (accountStatus === 'Inactive') {
          showError('Account is Inactive. Cannot deposit.');
          return;
        }
        await createDeposit({
          accountNumber: form.accountNumber,
          amount: Number(form.amount),
          initiatorName: getCurrentUserName(),
          meta: {
            depositorName: form.depositorName,
            depositorAddress: form.depositorAddress,
            incomeSource: form.incomeSource,
            method: form.method,
            notes: form.notes,
          },
        });
        showSuccess('Deposit submitted for approval');
        setForm({ accountNumber: '', depositorName: '', depositorAddress: '', incomeSource: '', amount: '', date: '', method: 'cash', notes: '' });
        setClient(null);
        setShowForm(false);
        await loadRows();
      } catch {
        showError('Failed to submit deposit');
      }
    })();
  };
  const toMoney = (n) => {
    try { return Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' }); } catch { return `GHS ${Number(n || 0).toFixed(2)}`; }
  };
  const pageRows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Deposit</h1>
        <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}><IconPlus /><span>Add Deposit</span></button>
      </div>
      <div className="card">
        <h3>Deposit Records</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Initiated</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.accountNumber}</td>
                <td>{toMoney(r.amount)}</td>
                <td>{r.status || 'Pending'}</td>
                <td>{r.initiatedAt || r.createdAt || '—'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="5">No deposits yet. Click Add Deposit to create one.</td></tr>}
          </tbody>
        </table>
        <Pager total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
      </div>
      <Modal open={showForm} title="New Deposit" subtitle="Deposits are submitted for approval" onClose={() => setShowForm(false)}>
      <form onSubmit={submit} className="form">
        <label>
          Account Number
          <div className="row">
            <input className="input" name="accountNumber" value={form.accountNumber} onChange={change} onBlur={lookup} placeholder="Account / Name / ID" required />
            <button className="btn" type="button" onClick={lookup}><IconSearch /><span>Lookup</span></button>
          </div>
        </label>
        {client && (
          <div className="row" style={{ gap: 24 }}>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{client.name}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{client.nationalId}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB</div><div>{client.dob}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{client.phone}</div></div>
          </div>
        )}
        {client && (
          <div className="row" style={{ gap: 24 }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Account Status</div>
              <div style={{ fontWeight: 600 }}>{accountStatus}</div>
            </div>
          </div>
        )}
        {client && (
          <div className="row" style={{ gap: 24 }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Account Balance</div>
              <div>{loadingBal ? 'Loading…' : toCurrency(accountBal)}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Loan Balance</div>
              <div>{loadingBal ? 'Loading…' : toCurrency(loanBal)}</div>
            </div>
          </div>
        )}
        <label>
          Depositor Name
          <input className="input" name="depositorName" value={form.depositorName} onChange={change} required />
        </label>
        <label>
          Depositor Address
          <input className="input" name="depositorAddress" value={form.depositorAddress} onChange={change} />
        </label>
        <label>
          Source of Income
          <select className="input" name="incomeSource" value={form.incomeSource} onChange={change} required>
            <option value="">Select source</option>
            <option value="Salary">Salary</option>
            <option value="Business">Business</option>
            <option value="Farming">Farming</option>
            <option value="Remittance">Remittance</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label>
          Amount
          <input className="input" type="number" name="amount" value={form.amount} onChange={change} required />
        </label>
        <label>
          Initiation Time
          <input className="input" value={initiatedAt} readOnly />
        </label>
        <label>
          Payment Method
          <select className="input" name="method" value={form.method} onChange={change}>
            <option value="cash">Cash</option>
            <option value="mobile">Mobile Money</option>
            <option value="bank">Bank</option>
          </select>
        </label>
        <label>
          Notes
          <input className="input" name="notes" value={form.notes} onChange={change} placeholder="Optional" />
        </label>
        <button className="btn btn-primary" type="submit"><IconSend /><span>Submit for Approval</span></button>
      </form>
      </Modal>
    </div>
  );
}
