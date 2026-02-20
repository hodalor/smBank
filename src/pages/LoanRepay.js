import { useMemo, useState } from 'react';
import { addPendingTxn, lookupAccountBasic, findAccount } from '../state/ops';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function LoanRepay() {
  const [account, setAccount] = useState('');
  const [loanId, setLoanId] = useState('');
  const [mode, setMode] = useState('full'); // full | partial | writeoff
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');

  // Mock loan data for demo; replace with API fetch by account+loanId
  const loan = useMemo(() => {
    if (loanId === 'LN-1001') return { id: 'LN-1001', account: '4839201746', principal: 5000, repaid: 240, writtenOff: 0 };
    if (loanId === 'LN-1002') return { id: 'LN-1002', account: '7392046158', principal: 3000, repaid: 0, writtenOff: 0 };
    return loanId ? { id: loanId, account, principal: 0, repaid: 0, writtenOff: 0 } : null;
  }, [loanId, account]);

  const outstanding = loan ? Math.max(loan.principal - loan.repaid - loan.writtenOff, 0) : 0;

  const [client, setClient] = useState(null);
  const lookup = () => {
    const q = (account || '').trim();
    if (!q) return;
    let info = null;
    if (/^\d{10}$/.test(q)) info = lookupAccountBasic(q);
    else {
      const found = findAccount(q);
      if (found) {
        setAccount(found.accountNumber);
        info = found;
      }
    }
    setClient(info);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!loanId || !account) {
      setStatus('Enter account and loan ID.');
      return;
    }
    if (mode !== 'full' && !amount) return setStatus('Enter amount for partial or write-off.');
    const finalAmount = mode === 'full' ? outstanding : Number(amount);
    addPendingTxn({
      type: 'Loan Repayment',
      mode,
      accountNumber: account,
      loanId,
      amount: finalAmount,
      note,
      initiatedAt: new Date().toISOString(),
      client
    });
    setStatus('Submitted for approval.');
    setAmount('');
  };

  return (
    <div className="stack">
      <h1>Repay Loan</h1>
      <form className="form card" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Account Number
            <div className="row">
              <input className="input" value={account} onChange={(e) => setAccount(e.target.value)} onBlur={lookup} placeholder="Account / Name / ID" required />
              <button className="btn" type="button" onClick={lookup}>Lookup</button>
            </div>
          </label>
          <label>
            Loan ID
            <input className="input" value={loanId} onChange={(e) => setLoanId(e.target.value)} placeholder="e.g. LN-1001" required />
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
            Outstanding
            <input className="input" value={loan ? gh(outstanding) : '—'} readOnly />
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
          <button className="btn btn-primary" type="submit">Submit for Approval</button>
          {status && <div style={{ color: '#0f172a', marginLeft: 12 }}>{status}</div>}
        </div>
      </form>
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
