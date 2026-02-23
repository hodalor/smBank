import { useEffect, useMemo, useState } from 'react';
import { getCurrentUserName, hasPermission, PERMISSIONS } from '../state/ops';
import { createWithdraw, directoryLookup, listClients, listPostedTransactions, listLoanRepayPosted, listLoans, fetchConfig } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';
import { IconSearch, IconSend } from '../components/Icons';

export default function Withdraw() {
  const allowed = hasPermission(PERMISSIONS.WITHDRAW_CREATE);
  const [form, setForm] = useState({
    accountNumber: '',
    amount: '',
    notes: ''
  });
  const [initiatedAt] = useState(new Date().toLocaleString());
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const [client, setClient] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [accountBal, setAccountBal] = useState(0);
  const [loanBal, setLoanBal] = useState(0);
  const [cfg, setCfg] = useState({ withdrawalFeeRate: 0 });
  const [withdrawer, setWithdrawer] = useState({
    idNumber: '',
    phone: '',
    address: '',
  });
  const [accountStatus, setAccountStatus] = useState('Active');
  const toCurrency = (n) => {
    const num = Number(n || 0);
    try { return num.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' }); } catch { return `GHS ${num.toFixed(2)}`; }
  };
  useEffect(() => {
    fetchConfig().then(c => setCfg({ withdrawalFeeRate: Number(c.withdrawalFeeRate ?? 0) }))
      .catch(() => setCfg({ withdrawalFeeRate: 0 }));
  }, []);
  const feeCalc = useMemo(() => {
    const amt = Number(form.amount || 0);
    const fee = Math.round((amt * (Number(cfg.withdrawalFeeRate || 0) / 100)) * 100) / 100;
    const total = Math.round((amt + fee) * 100) / 100;
    return { fee, total };
  }, [form.amount, cfg.withdrawalFeeRate]);
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
        showWarning('No matching client found');
      } catch (e) {
        setClient(null);
        setAccountBal(0);
        setLoanBal(0);
        if (e && e.status === 404) showError('Account not found');
        else showError('Lookup failed');
      }
    })();
  };
  const submit = (e) => {
    e.preventDefault();
    (async () => {
      try {
        if (!allowed) {
          showError('Not authorized to create withdrawals');
          return;
        }
        if (!form.accountNumber || !form.amount) {
          showWarning('Enter account and amount');
          return;
        }
        if (accountStatus === 'Inactive' || accountStatus === 'Dormant' || accountStatus === 'NDS') {
          const msg = accountStatus === 'NDS' ? 'Account is Non‑Debit. Cannot withdraw.' : `Account is ${accountStatus}. Cannot withdraw.`;
          showError(msg);
          return;
        }
        if (!withdrawer.idNumber || !withdrawer.phone || !withdrawer.address) {
          showWarning('Enter withdrawer ID number, phone and address');
          return;
        }
        const amt = Number(form.amount);
        const total = Number(feeCalc.total || amt);
        if (total > Number(accountBal || 0)) {
          showWarning(`Insufficient balance. Max withdraw is ${toCurrency(accountBal)} (includes fees).`);
          return;
        }
        await createWithdraw({
          accountNumber: form.accountNumber,
          amount: amt,
          initiatorName: getCurrentUserName(),
          meta: {
            notes: form.notes,
            withdrawerIdNumber: withdrawer.idNumber,
            withdrawerPhone: withdrawer.phone,
            withdrawerAddress: withdrawer.address,
            feePreviewRate: Number(cfg.withdrawalFeeRate || 0),
            feePreviewAmount: Number(feeCalc.fee || 0),
          },
        });
        showSuccess('Withdrawal submitted for approval');
      } catch {
        showError('Failed to submit withdrawal');
      }
    })();
    setForm({ accountNumber: '', amount: '', notes: '' });
    setClient(null);
    setAccountBal(0);
    setLoanBal(0);
    setWithdrawer({ idNumber: '', phone: '', address: '' });
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Withdraw</h1>
      <form onSubmit={submit} className="form card" style={{ maxWidth: 520 }}>
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
          Amount
          <input className="input" type="number" name="amount" value={form.amount} onChange={(e) => {
            const v = e.target.value;
            setForm({ ...form, amount: v });
            const num = Number(v);
            const total = Math.round((num + Math.round((num * (Number(cfg.withdrawalFeeRate || 0) / 100)) * 100) / 100) * 100) / 100;
            if (!Number.isNaN(num) && total > Number(accountBal || 0)) {
              showWarning(`Amount + fee exceeds available balance of ${toCurrency(accountBal)}.`);
            }
          }} placeholder="Amount" required max={Math.max(0, Number(accountBal || 0))} />
        </label>
        <div className="row" style={{ gap: 24 }}>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Withdrawal Fee</div><div>{toCurrency(feeCalc.fee)}</div></div>
          <div><div style={{ color: '#64748b', fontSize: 12 }}>Total Deduct</div><div>{toCurrency(feeCalc.total)}</div></div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <label style={{ flex: 1 }}>
            Withdrawer ID Number
            <input className="input" value={withdrawer.idNumber} onChange={e => setWithdrawer({ ...withdrawer, idNumber: e.target.value })} placeholder="e.g. National ID" required />
          </label>
          <label style={{ flex: 1 }}>
            Withdrawer Phone
            <input className="input" type="tel" value={withdrawer.phone} onChange={e => setWithdrawer({ ...withdrawer, phone: e.target.value })} placeholder="e.g. 055..." required />
          </label>
        </div>
        <label>
          Withdrawer Address
          <input className="input" value={withdrawer.address} onChange={e => setWithdrawer({ ...withdrawer, address: e.target.value })} placeholder="Residential/Business address" required />
        </label>
        <label>
          Initiation Time
          <input className="input" value={initiatedAt} readOnly />
        </label>
        <label>
          Notes
          <input className="input" name="notes" value={form.notes} onChange={change} placeholder="Notes (optional)" />
        </label>
        <button className="btn btn-primary" type="submit"><IconSend /><span>Submit for Approval</span></button>
      </form>
    </div>
  );
}
