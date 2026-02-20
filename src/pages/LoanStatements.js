import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { directoryLookup, listClients, listLoanRepayPosted, listPostedTransactions } from '../api';
import { showError, showWarning } from '../components/Toaster';

function toCurrency(n) {
  const num = Number(n || 0);
  try { return num.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' }); } catch { return `GHS ${num.toFixed(2)}`; }
}

export default function LoanStatements() {
  const [accountNumber, setAccountNumber] = useState('');
  const [txnId, setTxnId] = useState('');
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

  const [disburseTx, setDisburseTx] = useState([]);     // loan_disbursement only
  const [postedRep, setPostedRep] = useState([]);       // loan repayments (incl. writeoff)
  useEffect(() => {
    const run = async () => {
      try {
        const q = {};
        if (accountNumber) q.accountNumber = accountNumber;
        if (startDate) q.from = startDate;
        if (endDate) q.to = endDate;
        const [tx, rp] = await Promise.all([
          listPostedTransactions({ ...q, type: 'loan_disbursement', ...(txnId ? { id: txnId.trim() } : {}) }),
          listLoanRepayPosted(accountNumber ? { accountNumber, ...(txnId ? { id: txnId.trim() } : {}) } : (txnId ? { id: txnId.trim() } : {})),
        ]);
        setDisburseTx(tx);
        setPostedRep(rp);
      } catch {
        setDisburseTx([]);
        setPostedRep([]);
      }
    };
    run();
  }, [accountNumber, startDate, endDate, txnId]);

  const disbursements = useMemo(() => {
    return disburseTx.map(p => ({
      id: p.id,
      account: p.accountNumber,
      type: 'Loan Disbursement',
      amount: p.amount,
      date: p.approvedAt,
      initiator: p.initiatorName || '',
      approver: p.approverName || '',
      notes: p.meta?.loanId || ''
    }));
  }, [disburseTx]);

  const repayments = useMemo(() => {
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
    const combined = [
      ...disbursements,
      ...repayments.map(r => ({
        id: r.id, account: r.account, type: r.type, amount: r.amount, date: r.date, initiator: r.initiator, approver: r.approver, notes: r.loanId
      })),
    ];
    return combined.filter(t => {
      if (txnId && !String(t.id || '').includes(txnId.trim())) return false;
      if (accountNumber && t.account !== accountNumber) return false;
      if (typeFilter !== 'All' && t.type !== typeFilter) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [disbursements, repayments, accountNumber, startDate, endDate, typeFilter, txnId]);

  // Outstanding Loan Balance approximation: disbursements - repayments - write-offs
  const loanBalance = useMemo(() => {
    const sum = (arr, pred) => (arr || []).filter(pred).reduce((s, x) => s + Number(x.amount || 0), 0);
    const disb = sum(disbursements, () => true);
    const rep = sum(repayments, r => r.type === 'Loan Repayment');
    const wo = sum(repayments, r => r.type === 'Loan Write-Off');
    return disb - rep - wo;
  }, [disbursements, repayments]);

  const downloadCSV = (filename, tableRows, header) => {
    const cols = header;
    const data = [cols.join(',')].concat(tableRows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))).join('\n');
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTables = () => {
    const content = document.getElementById('loan-printable')?.innerHTML || '';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>Loan Statement</title>');
    w.document.write('<style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f1f5f9}</style>');
    w.document.write('</head><body>');
    w.document.write(content);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  return (
    <div className="stack">
      <h1>Loan Statements</h1>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <label>
          Account Number
          <div className="row">
            <input className="input" placeholder="Account / Name / ID" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            <button className="btn" type="button" onClick={() => {
              const q = accountNumber.trim();
              if (/^\d{10}$/.test(q)) {
                directoryLookup(q).then(c => { setClient(c); }).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
              } else {
                listClients({ q }).then(list => {
                  if (list && list.length) {
                    setAccountNumber(list[0].accountNumber);
                    directoryLookup(list[0].accountNumber).then(c => setClient(c)).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
                  } else showWarning('No matching client found');
                }).catch(() => { showError('Lookup failed'); });
              }
            }}>Lookup</button>
          </div>
        </label>
        <label>
          Transaction ID
          <input className="input" placeholder="e.g. TX-/D-/W- id" value={txnId} onChange={(e) => setTxnId(e.target.value)} />
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
              <option>Loan Disbursement</option>
              <option>Loan Repayment</option>
              <option>Loan Write-Off</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setAccountNumber(accountNumber)}>Load</button>
          <button className="btn" onClick={() => { setAccountNumber(''); setClient(null); }}>Clear</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Account</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{accountNumber || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Outstanding Loan Balance</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{toCurrency(loanBalance)}</div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => downloadCSV(`loan_statements_${accountNumber || 'all'}.csv`, rows, ['id','account','type','amount','date','initiator','approver','notes'])}>Download CSV</button>
            <button className="btn btn-primary" onClick={printTables}>Download PDF</button>
          </div>
        </div>
      </div>

      <div id="loan-printable" className="stack">
        <div className="card">
          <h3>Loan Statements</h3>
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
