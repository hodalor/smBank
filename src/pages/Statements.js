import { useEffect, useMemo, useState } from 'react';
import { getPostedTxns, onPostedUpdate, findAccount, lookupAccountBasic } from '../state/ops';

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

  const [posted, setPosted] = useState(getPostedTxns());
  useEffect(() => onPostedUpdate(setPosted), []);

  const transactions = useMemo(
    () => [
      { id: 'T001', account: '4839201746', type: 'Deposit', amount: 300, date: '2026-01-10', initiator: 'admin', approver: '', notes: 'Opening' },
      { id: 'T002', account: '4839201746', type: 'Withdrawal', amount: 50, date: '2026-01-15', initiator: 'admin', approver: '', notes: '' },
      { id: 'T003', account: '4839201746', type: 'Loan Disbursement', amount: 500, date: '2026-02-01', initiator: 'admin', approver: '', notes: 'LN-1001' },
      { id: 'T004', account: '4839201746', type: 'Loan Repayment', amount: 120, date: '2026-02-28', initiator: 'admin', approver: '', notes: 'LN-1001' },
      { id: 'T005', account: '7392046158', type: 'Deposit', amount: 200, date: '2026-01-05', initiator: 'admin', approver: '', notes: '' }
    ],
    []
  );
  const postedTransactions = useMemo(() => {
    return posted.flatMap(p => {
      if (p.type === 'Deposit' || p.type === 'Withdrawal') {
        return [{
          id: p.id,
          account: p.accountNumber,
          type: p.type,
          amount: p.amount,
          date: p.date,
          initiator: p.initiatorName || '',
          approver: p.approverName || '',
          notes: p.notes || ''
        }];
      }
      if (p.type === 'Loan Repayment') {
        if (p.mode === 'writeoff') {
          return [{
            id: p.id,
            account: p.accountNumber,
            type: 'Loan Write-Off',
            amount: p.amount,
            date: p.date,
            initiator: p.initiatorName || '',
            approver: p.approverName || '',
            notes: p.loanId
          }];
        }
        return [{
          id: p.id,
          account: p.accountNumber,
          type: 'Loan Repayment',
          amount: p.amount,
          date: p.date,
          initiator: p.initiatorName || '',
          approver: p.approverName || '',
          notes: p.loanId
        }];
      }
      return [];
    });
  }, [posted]);

  const repayments = useMemo(
    () => [
      { id: 'R001', account: '4839201746', loanId: 'LN-1001', amount: 120, date: '2026-02-28', notes: '' },
      { id: 'R002', account: '4839201746', loanId: 'LN-1001', amount: 120, date: '2026-03-28', notes: '' }
    ],
    []
  );
  const postedRepayments = useMemo(() => {
    return posted.filter(p => p.type === 'Loan Repayment' && p.mode !== 'writeoff').map(p => ({
      id: p.id,
      account: p.accountNumber,
      loanId: p.loanId,
      amount: p.amount,
      date: p.date,
      initiator: p.initiatorName || '',
      approver: p.approverName || '',
      notes: p.note || ''
    }));
  }, [posted]);

  const rows = useMemo(() => {
    const combined = [...transactions, ...postedTransactions];
    return combined.filter(t => {
      if (accountNumber && t.account !== accountNumber) return false;
      if (typeFilter !== 'All' && t.type !== typeFilter) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [transactions, postedTransactions, accountNumber, startDate, endDate, typeFilter]);
  const repayRows = useMemo(() => {
    const combined = [...repayments, ...postedRepayments];
    return combined.filter(r => {
      if (accountNumber && r.account !== accountNumber) return false;
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }, [repayments, postedRepayments, accountNumber, startDate, endDate]);

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
              if (/^\\d{10}$/.test(q)) { info = lookupAccountBasic(q); }
              else {
                const found = findAccount(q);
                if (found) {
                  setAccountNumber(found.accountNumber);
                  info = found;
                }
              }
              setClient(info);
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
