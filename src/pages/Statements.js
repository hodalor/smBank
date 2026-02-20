import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { directoryLookup, listClients, listLoanRepayPosted, listPostedTransactions } from '../api';
import { showError, showWarning } from '../components/Toaster';

function toCurrency(n) {
  const num = Number(n || 0);
  return num.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });
}

export default function Statements() {
  const [accountNumber, setAccountNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [client, setClient] = useState(null);
  const location = useLocation();
  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const acct = sp.get('accountNumber') || '';
      if (acct) setAccountNumber(acct);
    } catch {}
  }, [location.search]);

  const [postedTx, setPostedTx] = useState([]);
  const [postedRep, setPostedRep] = useState([]);
  useEffect(() => {
    const run = async () => {
      try {
        const q = {};
        if (accountNumber) q.accountNumber = accountNumber;
        if (startDate) q.from = startDate;
        if (endDate) q.to = endDate;
        const [tx, rp] = await Promise.all([
          listPostedTransactions(q),
          listLoanRepayPosted(accountNumber ? { accountNumber } : {}),
        ]);
        setPostedTx(tx);
        setPostedRep(rp);
      } catch {
        setPostedTx([]);
        setPostedRep([]);
      }
    };
    run();
  }, [accountNumber, startDate, endDate]);

  const postedTransactions = useMemo(() => {
    return postedTx.map(p => {
      const type = p.kind === 'deposit' ? 'Deposit' : p.kind === 'withdraw' ? 'Withdrawal' : 'Loan Disbursement';
      const notes = p.kind === 'loan_disbursement' ? (p.meta?.loanId || '') : (p.meta?.notes || '');
      return {
        id: p.id,
        account: p.accountNumber,
        type,
        amount: p.amount,
        date: p.approvedAt,
        initiator: p.initiatorName || '',
        approver: p.approverName || '',
        notes
      };
    });
  }, [postedTx]);

  const postedRepayments = useMemo(() => {
    return postedRep.map(p => ({
      id: p.id,
      account: p.accountNumber,
      loanId: p.loanId,
      amount: p.amount,
      date: p.approvedAt || p.initiatedAt,
      initiator: p.initiatorName || '',
      approver: p.approverName || '',
      type: p.mode === 'writeoff' ? 'Loan Write-Off' : 'Loan Repayment',
      notes: ''
    }));
  }, [postedRep]);

  const rows = useMemo(() => {
    const combined = [...postedTransactions, ...postedRepayments.map(r => ({
      id: r.id,
      account: r.account,
      type: r.type,
      amount: r.amount,
      date: r.date,
      initiator: r.initiator,
      approver: r.approver,
      notes: r.loanId
    }))];
    return combined.filter(t => {
      if (accountNumber && t.account !== accountNumber) return false;
      if (typeFilter !== 'All' && t.type !== typeFilter) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [postedTransactions, postedRepayments, accountNumber, startDate, endDate, typeFilter]);
  const repayRows = useMemo(() => {
    const combined = postedRepayments.filter(r => r.type !== 'Loan Write-Off');
    return combined.filter(r => {
      if (accountNumber && r.account !== accountNumber) return false;
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }, [postedRepayments, accountNumber, startDate, endDate]);

  const balance = useMemo(() => {
    return rows.reduce((acc, t) => {
      if (t.type === 'Deposit' || t.type === 'Loan Repayment') return acc + t.amount;
      if (t.type === 'Withdrawal' || t.type === 'Loan Disbursement') return acc - t.amount;
      // Loan Write-Off does not affect account balance revenue
      return acc;
    }, 0);
  }, [rows]);

  const downloadCSV = (filename, tableRows, header) => {
    const cols = header;
    const data = [cols.join(',')].concat(tableRows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))).join('\\n');
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTables = () => {
    const content = document.getElementById('printable-area')?.innerHTML || '';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>Statement</title>');
    w.document.write('<style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f1f5f9}</style>');
    w.document.write('</head><body>');
    w.document.write(content);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  return (
    <div className="stack">
      <h1>Statements</h1>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <label>
          Account Number
          <div className="row">
            <input className="input" placeholder="Account / Name / ID" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            <button className="btn" type="button" onClick={() => {
              const q = accountNumber.trim();
              let info = null;
              if (/^\\d{10}$/.test(q)) {
                directoryLookup(q).then(c => { setClient(c); }).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
              } else {
                listClients({ q }).then(list => {
                  if (list && list.length) {
                    setAccountNumber(list[0].accountNumber);
                    directoryLookup(list[0].accountNumber).then(c => setClient(c)).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
                  }
                  else showWarning('No matching client found');
                }).catch(() => { showError('Lookup failed'); });
              }
            }}>Lookup</button>
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
        <div className="form-grid">
          <label>
            Start Date
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            Type
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option>All</option>
              <option>Deposit</option>
              <option>Withdrawal</option>
              <option>Loan Disbursement</option>
              <option>Loan Repayment</option>
              <option>Loan Write-Off</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setAccountNumber(accountNumber)}>Load</button>
          <button className="btn" onClick={() => { setAccountNumber(''); }}>Clear</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Account</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{accountNumber || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Current Balance</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{toCurrency(balance)}</div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => downloadCSV(`transactions_${accountNumber || 'all'}.csv`, rows, ['id','account','type','amount','date','initiator','approver','notes'])}>Download CSV</button>
            <button className="btn" onClick={() => downloadCSV(`repayments_${accountNumber || 'all'}.csv`, repayRows, ['id','account','loanId','amount','date','initiator','approver','notes'])}>Download Repayments CSV</button>
            <button className="btn btn-primary" onClick={printTables}>Download PDF</button>
          </div>
        </div>
      </div>

      <div id="printable-area" className="stack">
        <div className="card">
          <h3>Transactions</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Initiator</th>
                <th>Approver</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.type}</td>
                  <td>{toCurrency(r.amount)}</td>
                  <td>{r.date}</td>
                  <td>{r.initiator ?? r.by ?? ''}</td>
                  <td>{r.approver ?? ''}</td>
                  <td>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Loan Repayments</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Loan ID</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Initiator</th>
                <th>Approver</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {repayRows.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.loanId}</td>
                  <td>{toCurrency(r.amount)}</td>
                  <td>{r.date}</td>
                  <td>{r.initiator ?? ''}</td>
                  <td>{r.approver ?? ''}</td>
                  <td>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
