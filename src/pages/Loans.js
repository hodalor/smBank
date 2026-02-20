import { useEffect, useMemo, useState } from 'react';
import { createLoan, directoryLookup, listClients, listLoans, fetchConfig } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';

export default function Loans() {
  const [form, setForm] = useState({
    accountNumber: '',
    principal: '',
    interestRate: '',
    durationMonths: '',
    startDate: '',
    g1Name: '',
    g1Phone: '',
    g1Id: '',
    g2Name: '',
    g2Phone: '',
    g2Id: '',
    collateralDesc: '',
    collateralValue: '',
    collateralDoc: null
  });
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const changeFile = (e) => setForm({ ...form, collateralDoc: e.target.files?.[0] || null });
  const [client, setClient] = useState(null);
  const lookup = () => {
    const q = (form.accountNumber || '').trim();
    if (!q) return;
    if (/^\d{10}$/.test(q)) {
      directoryLookup(q).then(setClient).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
    } else {
      listClients({ q }).then(list => {
        if (list && list.length) {
          setForm(f => ({ ...f, accountNumber: list[0].accountNumber }));
          directoryLookup(list[0].accountNumber).then(setClient).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
        }
        else showWarning('No matching client found');
      }).catch(() => { showError('Lookup failed'); });
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    try {
      await createLoan({
        accountNumber: form.accountNumber,
        principal: Number(form.principal),
        rate: Number(form.interestRate),
        termMonths: Number(form.durationMonths),
        startDate: form.startDate,
        guarantor1: { name: form.g1Name, phone: form.g1Phone, id: form.g1Id },
        guarantor2: { name: form.g2Name, phone: form.g2Phone, id: form.g2Id },
        collateral: { description: form.collateralDesc, value: Number(form.collateralValue || 0) },
      });
      showSuccess('Loan created and submitted for approval');
      setForm({ accountNumber: '', principal: '', interestRate: '', durationMonths: '', startDate: '', g1Name: '', g1Phone: '', g1Id: '', g2Name: '', g2Phone: '', g2Id: '', collateralDesc: '', collateralValue: '', collateralDoc: null });
    } catch (e) {
      if (e && e.message && e.message.includes('duplicate')) showError('Duplicate contact detected');
      else showError('Failed to create loan');
    }
  };
  const [rows, setRows] = useState([]);
  const [loanIdFilter, setLoanIdFilter] = useState('');
  useEffect(() => {
    listLoans({}).then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    fetchConfig().then(cfg => {
      setForm(f => ({ ...f, interestRate: f.interestRate || String(cfg.defaultLoanRate ?? '') }));
    }).catch(() => {});
  }, []);
  const interestCalc = useMemo(() => {
    const p = Number(form.principal || 0);
    const r = Number(form.interestRate || 0) / 100;
    const m = Number(form.durationMonths || 0) / 12;
    const ti = p * r * m;
    return { totalInterest: Math.round(ti * 100) / 100, totalDue: Math.round((p + ti) * 100) / 100 };
  }, [form.principal, form.interestRate, form.durationMonths]);
  const listFiltered = rows.filter(r => !loanIdFilter || String(r.id || '').includes(loanIdFilter.trim()));
  return (
    <div className="stack">
      <h1>Loans</h1>
      <section className="card">
        <h3>New Loan</h3>
        <form onSubmit={submit} className="form" style={{ maxWidth: 520 }}>
          <label>
            Client Account Number
            <div className="row">
              <input className="input" name="accountNumber" value={form.accountNumber} onChange={change} placeholder="Account / Name / ID" required />
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
            Principal Amount
            <input className="input" type="number" name="principal" value={form.principal} onChange={change} required />
          </label>
          <label>
            Interest Rate (%)
            <input className="input" type="number" name="interestRate" value={form.interestRate} onChange={change} required />
          </label>
          <label>
            Duration (months)
            <input className="input" type="number" name="durationMonths" value={form.durationMonths} onChange={change} required />
          </label>
          <div className="row" style={{ gap: 24 }}>
            <div><div style={{ fontSize: 12, color: '#64748b' }}>Total Interest</div><div style={{ fontWeight: 600 }}>{interestCalc.totalInterest.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}</div></div>
            <div><div style={{ fontSize: 12, color: '#64748b' }}>Total Due</div><div style={{ fontWeight: 600 }}>{interestCalc.totalDue.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}</div></div>
          </div>
          <label>
            Start Date
            <input className="input" type="date" name="startDate" value={form.startDate} onChange={change} required />
          </label>
          <div className="stack">
            <h3>Guarantor 1</h3>
            <label>
              Name
              <input className="input" name="g1Name" value={form.g1Name} onChange={change} required />
            </label>
            <label>
              Phone
              <input className="input" name="g1Phone" value={form.g1Phone} onChange={change} required />
            </label>
            <label>
              National ID / Passport
              <input className="input" name="g1Id" value={form.g1Id} onChange={change} required />
            </label>
          </div>
          <div className="stack">
            <h3>Guarantor 2</h3>
            <label>
              Name
              <input className="input" name="g2Name" value={form.g2Name} onChange={change} required />
            </label>
            <label>
              Phone
              <input className="input" name="g2Phone" value={form.g2Phone} onChange={change} required />
            </label>
            <label>
              National ID / Passport
              <input className="input" name="g2Id" value={form.g2Id} onChange={change} required />
            </label>
          </div>
          <div className="stack">
            <h3>Collateral</h3>
            <label>
              Description
              <input className="input" name="collateralDesc" value={form.collateralDesc} onChange={change} />
            </label>
            <label>
              Estimated Value
              <input className="input" type="number" name="collateralValue" value={form.collateralValue} onChange={change} />
            </label>
            <label>
              Supporting Document (photo or PDF)
              <input className="input" type="file" accept="image/*,application/pdf" onChange={changeFile} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">Create Loan</button>
        </form>
      </section>
      <section className="card">
        <h3>Loans List</h3>
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <label>
            Loan ID
            <input className="input" placeholder="e.g. L0000123" value={loanIdFilter} onChange={(e) => setLoanIdFilter(e.target.value)} />
          </label>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Account</th>
              <th>Principal</th>
              <th>Total Interest</th>
              <th>Total Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {listFiltered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.accountNumber}</td>
                <td>{r.principal}</td>
                <td>{r.totalInterest ?? '-'}</td>
                <td>{r.totalDue ?? '-'}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {!listFiltered.length && <tr><td colSpan="6">No loans loaded.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
