import { useState } from 'react';
import { getCurrentUserName } from '../state/ops';
import { createWithdraw, directoryLookup, listClients } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';

export default function Withdraw() {
  const [form, setForm] = useState({
    accountNumber: '',
    amount: '',
    notes: ''
  });
  const [initiatedAt] = useState(new Date().toLocaleString());
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const [client, setClient] = useState(null);
  const lookup = () => {
    const q = (form.accountNumber || '').trim();
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
          setForm(f => ({ ...f, accountNumber: acct }));
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
    (async () => {
      try {
        if (!form.accountNumber || !form.amount) {
          showWarning('Enter account and amount');
          return;
        }
        await createWithdraw({
          accountNumber: form.accountNumber,
          amount: Number(form.amount),
          initiatorName: getCurrentUserName(),
          meta: { notes: form.notes },
        });
        showSuccess('Withdrawal submitted for approval');
      } catch {
        showError('Failed to submit withdrawal');
      }
    })();
    setForm({ accountNumber: '', amount: '', notes: '' });
    setClient(null);
  };
  return (
    <div className="stack">
      <h1>Withdraw</h1>
      <form onSubmit={submit} className="form card" style={{ maxWidth: 520 }}>
        <label>
          Account Number
          <div className="row">
            <input className="input" name="accountNumber" value={form.accountNumber} onChange={change} onBlur={lookup} placeholder="Account / Name / ID" required />
            <button className="btn" type="button" onClick={lookup}>Lookup</button>
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
        <label>
          Amount
          <input className="input" type="number" name="amount" value={form.amount} onChange={change} placeholder="Amount" required />
        </label>
        <label>
          Initiation Time
          <input className="input" value={initiatedAt} readOnly />
        </label>
        <label>
          Notes
          <input className="input" name="notes" value={form.notes} onChange={change} placeholder="Notes (optional)" />
        </label>
        <button className="btn btn-primary" type="submit">Submit for Approval</button>
      </form>
    </div>
  );
}
