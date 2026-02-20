import { useState } from 'react';
import { addPendingTxn, lookupAccountBasic, findAccount } from '../state/ops';

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
    let info = null;
    if (/^\d{10}$/.test(q)) info = lookupAccountBasic(q);
    else {
      const found = findAccount(q);
      if (found) {
        setForm(f => ({ ...f, accountNumber: found.accountNumber }));
        info = found;
      }
    }
    setClient(info);
  };
  const submit = (e) => {
    e.preventDefault();
    addPendingTxn({
      type: 'Withdrawal',
      accountNumber: form.accountNumber,
      amount: Number(form.amount),
      initiatedAt: new Date().toISOString(),
      notes: form.notes,
      client
    });
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
