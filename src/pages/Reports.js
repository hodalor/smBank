import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { listClients, listLoans, listLoanRepayPosted, listPostedTransactions } from '../api';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function Reports() {
  const allowed = hasPermission(PERMISSIONS.REPORTS_VIEW);
  const [reportType, setReportType] = useState('All Clients');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clients, setClients] = useState([]);
  const [loans, setLoans] = useState([]);
  const [posted, setPosted] = useState([]);
  const [repays, setRepays] = useState([]);
  useEffect(() => {
    if (!allowed) return;
    const run = async () => {
      try {
        const [cs, ls, tx, rp] = await Promise.all([
          listClients({}),
          listLoans({}),
          listPostedTransactions({}),
          listLoanRepayPosted({}),
        ]);
        setClients(cs || []);
        setLoans(ls || []);
        setPosted(tx || []);
        setRepays(rp || []);
      } catch {
        setClients([]);
        setLoans([]);
        setPosted([]);
        setRepays([]);
      }
    };
    run();
  }, [allowed]);

  const balancesByAccount = useMemo(() => {
    const map = new Map();
    posted.forEach(p => {
      const acct = p.accountNumber;
      const amt = Number(p.amount || 0);
      const kind = p.kind;
      const prev = map.get(acct) || 0;
      if (kind === 'deposit') map.set(acct, prev + amt);
      else if (kind === 'withdraw') map.set(acct, prev - amt);
      else if (kind === 'loan_disbursement') map.set(acct, prev - amt);
    });
    repays.forEach(r => {
      const acct = r.accountNumber;
      const amt = Number(r.amount || 0);
      map.set(acct, (map.get(acct) || 0) + amt);
    });
    return map;
  }, [posted, repays]);
  const loansByAccount = useMemo(() => {
    const map = new Map();
    loans.forEach(l => map.set(l.accountNumber, (map.get(l.accountNumber) || 0) + 1));
    return map;
  }, [loans]);
  const loansRows = useMemo(() => {
    const plusMonths = (dateStr, m) => {
      try { const d = new Date(dateStr); d.setMonth(d.getMonth() + (m || 0)); return d.toISOString().slice(0,10); } catch { return ''; }
    };
    return loans.map(l => ({
      id: l.id,
      account: l.accountNumber,
      client: '',
      principal: l.principal,
      status: l.status,
      start: (l.createdAt || '').slice(0,10),
      due: plusMonths(l.createdAt || '', l.termMonths),
      overdue: false,
      restructured: false,
      writtenOff: false,
    }));
  }, [loans]);
  const rows = useMemo(() => {
    if (reportType === 'All Clients') {
      return clients.map(c => ({
        account: c.accountNumber,
        name: c.name,
        nationalId: c.nationalId || '',
        loans: loansByAccount.get(c.accountNumber) || 0,
        balance: balancesByAccount.get(c.accountNumber) || 0,
      }));
    }
    if (reportType === 'Clients With Loans') {
      return clients.filter(c => (loansByAccount.get(c.accountNumber) || 0) > 0).map(c => ({
        account: c.accountNumber,
        name: c.name,
        nationalId: c.nationalId || '',
        loans: loansByAccount.get(c.accountNumber) || 0,
        balance: balancesByAccount.get(c.accountNumber) || 0,
      }));
    }
    if (reportType === 'Overdue Loans') {
      return loansRows.filter(l => {
        if (startDate && l.due < startDate) return false;
        if (endDate && l.due > endDate) return false;
        return false;
      });
    }
    if (reportType === 'Restructured Loans') return loansRows.filter(() => false);
    if (reportType === 'Written Off Loans') return loansRows.filter(() => false);
    return [];
  }, [clients, loansRows, reportType, startDate, endDate, balancesByAccount, loansByAccount]);

  const downloadCSV = (filename, tableRows) => {
    let header = [];
    if (reportType.includes('Clients')) header = ['account', 'name', 'nationalId', 'loans', 'balance'];
    else header = ['id', 'account', 'client', 'principal', 'status', 'start', 'due'];
    const data = [header.join(',')].concat(tableRows.map(r => header.map(c => JSON.stringify(r[c] ?? '')).join(','))).join('\\n');
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTable = () => {
    const el = document.getElementById('report-table')?.outerHTML || '';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>Report</title>');
    w.document.write('<style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f1f5f9}</style>');
    w.document.write('</head><body>');
    w.document.write(`<h2>${reportType}</h2>`);
    w.document.write(el);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Reports</h1>
      <div className="card">
        <div className="form-grid">
          <label>
            Report Type
            <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option>All Clients</option>
              <option>Clients With Loans</option>
              <option>Overdue Loans</option>
              <option>Restructured Loans</option>
              <option>Written Off Loans</option>
            </select>
          </label>
          <label>
            Start Date
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={() => downloadCSV(reportType.replace(/\\s+/g,'_'), rows)}>Download CSV</button>
          <button className="btn" onClick={printTable}>Download PDF</button>
        </div>
      </div>
      <div className="card">
        <table id="report-table" className="table">
          <thead>
            {reportType.includes('Clients') ? (
              <tr>
                <th>Account</th>
                <th>Name</th>
                <th>National ID</th>
                <th>Loans</th>
                <th>Balance</th>
              </tr>
            ) : (
              <tr>
                <th>Loan ID</th>
                <th>Account</th>
                <th>Client</th>
                <th>Principal</th>
                <th>Status</th>
                <th>Start</th>
                <th>Due</th>
              </tr>
            )}
          </thead>
          <tbody>
            {reportType.includes('Clients') ? (
              rows.map(r => (
                <tr key={r.account}>
                  <td>{r.account}</td>
                  <td>{r.name}</td>
                  <td>{r.nationalId}</td>
                  <td>{r.loans}</td>
                  <td>{gh(r.balance)}</td>
                </tr>
              ))
            ) : (
              rows.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.account}</td>
                  <td>{r.client}</td>
                  <td>{gh(r.principal)}</td>
                  <td>{r.status}</td>
                  <td>{r.start}</td>
                  <td>{r.due}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
