import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { IconDownload, IconFile } from '../components/Icons';
import { listClients, listLoans, listLoanRepayPosted, listPostedTransactions } from '../api';
import { openBrandedPrintWindow } from '../utils/printLayouts';
import { downloadCsvFile } from '../utils/downloads';

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
    const header = reportType.includes('Clients') ? ['account', 'name', 'nationalId', 'loans', 'balance'] : ['id', 'account', 'client', 'principal', 'status', 'start', 'due'];
    downloadCsvFile(filename, header, tableRows);
  };

  const printTable = () => {
    const clientColumns = [
      { key: 'account', label: 'Account' },
      { key: 'name', label: 'Name' },
      { key: 'nationalId', label: 'National ID' },
      { key: 'loans', label: 'Loans' },
      { key: 'balance', label: 'Balance' },
    ];
    const loanColumns = [
      { key: 'id', label: 'Loan ID' },
      { key: 'account', label: 'Account' },
      { key: 'client', label: 'Client' },
      { key: 'principal', label: 'Principal' },
      { key: 'status', label: 'Status' },
      { key: 'start', label: 'Start' },
      { key: 'due', label: 'Due' },
    ];
    openBrandedPrintWindow({
      title: reportType,
      subtitle: 'Report export',
      badges: [startDate ? `From ${startDate}` : '', endDate ? `To ${endDate}` : ''].filter(Boolean),
      summaryCards: [
        { label: 'Rows', value: String(rows.length) },
        { label: 'Type', value: reportType },
      ],
      tables: [{
        title: reportType,
        columns: reportType.includes('Clients') ? clientColumns : loanColumns,
        rows: rows.map((r) => reportType.includes('Clients') ? ({ ...r, balance: gh(r.balance) }) : ({ ...r, principal: gh(r.principal) })),
        emptyText: 'No rows available for this report.',
      }],
    });
  };

  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <div className="dashboard-header">
        <div>
          <h1>Reports</h1>
          <div className="dashboard-subtitle">Prepare client and loan reports, then export them with the company letterhead.</div>
        </div>
      </div>
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
          <button className="btn btn-primary" onClick={() => downloadCSV(reportType.replace(/\s+/g,'_'), rows)}><IconDownload /><span>Download CSV</span></button>
          <button className="btn" onClick={printTable}><IconFile /><span>Download PDF</span></button>
        </div>
      </div>
      <div className="dashboard-kpi-grid">
        <div className="card dashboard-kpi-card" style={{ '--accent': '#dbeafe' }}>
          <div className="dashboard-kpi-label">Report Type</div>
          <div className="dashboard-kpi-value">{reportType}</div>
          <div className="dashboard-kpi-hint">Current report selection</div>
        </div>
        <div className="card dashboard-kpi-card" style={{ '--accent': '#dcfce7' }}>
          <div className="dashboard-kpi-label">Rows</div>
          <div className="dashboard-kpi-value">{rows.length}</div>
          <div className="dashboard-kpi-hint">Records ready to export</div>
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
