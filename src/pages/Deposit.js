import { useState } from 'react';
import { getCurrentUserName } from '../state/ops';
import { createDeposit, directoryLookup, listClients } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';

export default function Deposit() {
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
  const [initiatedAt] = useState(new Date().toLocaleString());
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
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
      } catch {
        showError('Failed to submit deposit');
      }
    })();
    setForm({ accountNumber: '', depositorName: '', depositorAddress: '', incomeSource: '', amount: '', date: '', method: 'cash', notes: '' });
    setClient(null);
  };
  return (
    <div className="stack">
      <h1>Deposit</h1>
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
        <button className="btn btn-primary" type="submit">Submit for Approval</button>
      </form>
    </div>
  );
}
