import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { listClients, listLoans, listLoanRepayPosted, listPostedTransactions } from '../api';
import Pager from '../components/Pager';
import KpiValue from '../components/KpiValue';
import { IconDownload, IconFile } from '../components/Icons';
import { downloadCsvFile } from '../utils/downloads';
import { openBrandedPrintWindow } from '../utils/printLayouts';
import { showWarning } from '../components/Toaster';

const ALL_EXPORT_COLS = [
  { key: 'name', label: 'Customer Name' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'accountBalance', label: 'Account Balance' },
  { key: 'loanBalance', label: 'Loan Balance' },
  { key: 'principal', label: 'Principal' },
  { key: 'interest', label: 'Interest' },
  { key: 'totalPayable', label: 'Total Payable' },
  { key: 'rate', label: 'Rate (%)' },
  { key: 'months', label: 'Months' },
  { key: 'start', label: 'Start' },
  { key: 'due', label: 'Due' },
  { key: 'daysToDue', label: 'Days to Due' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'status', label: 'Status' },
];
const defaultExportCols = () => Object.fromEntries(ALL_EXPORT_COLS.map((c) => [c.key, true]));

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

function plusMonths(dateStr, m) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + (m || 0));
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function daysDiff(dateStr) {
  try {
    const dd = new Date(dateStr);
    if (Number.isNaN(dd.getTime())) return null;
    const now = new Date();
    return Math.ceil((dd.getTime() - now.getTime()) / (24 * 3600 * 1000));
  } catch {
    return null;
  }
}

function clientName(c) {
  return c?.fullName || c?.companyName || c?.name || '';
}

export default function SummarySheet() {
  const allowed = hasPermission(PERMISSIONS.SUMMARY_VIEW) || hasPermission(PERMISSIONS.REPORTS_VIEW) || hasPermission(PERMISSIONS.DASHBOARD_VIEW);
  const [clients, setClients] = useState([]);
  const [loans, setLoans] = useState([]);
  const [posted, setPosted] = useState([]);
  const [repays, setRepays] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loanFilter, setLoanFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [exportCols, setExportCols] = useState(defaultExportCols);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    (async () => {
      try {
        const [cl, ls, tx, rp] = await Promise.all([
          listClients({}),
          listLoans({}),
          listPostedTransactions({}),
          listLoanRepayPosted({}),
        ]);
        if (stop) return;
        setClients(Array.isArray(cl) ? cl : []);
        setLoans(Array.isArray(ls) ? ls : []);
        setPosted(Array.isArray(tx) ? tx : []);
        setRepays(Array.isArray(rp) ? rp : []);
      } catch {
        if (!stop) {
          setClients([]);
          setLoans([]);
          setPosted([]);
          setRepays([]);
        }
      }
    })();
    return () => { stop = true; };
  }, [allowed]);

  const balances = useMemo(() => {
    const map = new Map();
    (posted || []).forEach((t) => {
      const acct = String(t.accountNumber || '');
      if (!acct) return;
      const cur = map.get(acct) || { deposited: 0, withdrawn: 0 };
      const amt = Number(t.amount || 0);
      if (t.kind === 'deposit') cur.deposited += amt;
      if (t.kind === 'withdraw') cur.withdrawn += amt;
      map.set(acct, cur);
    });
    return map;
  }, [posted]);

  const repaidByLoan = useMemo(() => {
    const map = new Map();
    (repays || []).forEach((r) => {
      const key = String(r.loanId || '');
      if (!key) return;
      map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
    });
    return map;
  }, [repays]);

  const rows = useMemo(() => {
    const byAccount = new Map();
    (clients || []).forEach((c) => {
      const acct = c.accountNumber;
      if (!acct) return;
      if (!byAccount.has(acct)) byAccount.set(acct, { client: c, loans: [] });
    });
    (loans || []).forEach((l) => {
      const acct = l.accountNumber;
      if (!acct) return;
      if (!byAccount.has(acct)) byAccount.set(acct, { client: { accountNumber: acct }, loans: [] });
      byAccount.get(acct).loans.push(l);
    });
    const out = [];
    byAccount.forEach(({ client, loans: clientLoans }) => {
      const acct = client.accountNumber;
      const bal = balances.get(acct) || { deposited: 0, withdrawn: 0 };
      const accountBalance = bal.deposited - bal.withdrawn;
      const name = clientName(client);
      const loanList = (clientLoans || []).filter((l) => String(l.status || '') !== 'Rejected');
      if (!loanList.length) {
        out.push({
          id: acct,
          name,
          accountNumber: acct,
          accountBalance,
          loanBalance: 0,
          principal: 0,
          interest: 0,
          totalPayable: 0,
          rate: '',
          months: '',
          start: '',
          due: '',
          daysToDue: '',
          overdue: 0,
          status: client.status || client.accountStatus || 'Active',
        });
        return;
      }
      loanList.forEach((l) => {
        const start = l.startDate || l.approvedAt || l.createdAt || '';
        const due = start ? plusMonths(start, l.termMonths) : '';
        const daysToDue = due ? daysDiff(due) : null;
        const principal = Number(l.principal || 0);
        const interest = Number(l.totalInterest || 0);
        const totalPayable = Number(l.totalDue ?? (principal + interest + Number(l.totalFees || 0)));
        const repaid = repaidByLoan.get(String(l.id || '')) || 0;
        const loanBalance = Math.max(0, totalPayable - repaid);
        const overdue = daysToDue != null && daysToDue < 0 ? loanBalance : 0;
        out.push({
          id: `${acct}-${l.id}`,
          name,
          accountNumber: acct,
          accountBalance,
          loanBalance,
          principal,
          interest,
          totalPayable,
          rate: l.rate,
          months: l.termMonths,
          start: String(start).slice(0, 10),
          due,
          daysToDue: daysToDue == null ? '' : daysToDue,
          overdue,
          status: overdue > 0 ? 'Overdue' : (l.status || 'Active'),
        });
      });
    });
    return out;
  }, [clients, loans, balances, repaidByLoan]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => { if (r.status) set.add(String(r.status)); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (s) {
        const blob = `${r.name || ''} ${r.accountNumber || ''} ${r.status || ''}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      if (statusFilter && String(r.status || '') !== statusFilter) return false;
      if (loanFilter === 'with' && !(Number(r.principal || 0) > 0 || Number(r.loanBalance || 0) > 0)) return false;
      if (loanFilter === 'none' && (Number(r.principal || 0) > 0 || Number(r.loanBalance || 0) > 0)) return false;
      if (overdueOnly && !(Number(r.overdue || 0) > 0)) return false;
      return true;
    });
  }, [rows, q, statusFilter, loanFilter, overdueOnly]);

  const totals = useMemo(() => {
    const deposited = (posted || []).filter((t) => t.kind === 'deposit').reduce((s, t) => s + Number(t.amount || 0), 0);
    const withdrawn = (posted || []).filter((t) => t.kind === 'withdraw').reduce((s, t) => s + Number(t.amount || 0), 0);
    return {
      deposited,
      withdrawn,
      balance: deposited - withdrawn,
      loanBalance: filtered.reduce((s, r) => s + Number(r.loanBalance || 0), 0),
      principal: filtered.reduce((s, r) => s + Number(r.principal || 0), 0),
      payable: filtered.reduce((s, r) => s + Number(r.totalPayable || 0), 0),
    };
  }, [posted, filtered]);

  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const cards = [
    { label: 'Total Deposited', value: gh(totals.deposited), hint: 'All posted deposits', accent: '#dcfce7' },
    { label: 'Total Withdrawn', value: gh(totals.withdrawn), hint: 'All posted withdrawals', accent: '#fee2e2' },
    { label: 'Current Balance', value: gh(totals.balance), hint: 'Deposits minus withdrawals', accent: '#dbeafe' },
    { label: 'Loan Balance', value: gh(totals.loanBalance), hint: 'Outstanding on listed loans', accent: '#ede9fe' },
    { label: 'Total Principal', value: gh(totals.principal), hint: 'Loan principal in view', accent: '#fef3c7' },
    { label: 'Total Payable', value: gh(totals.payable), hint: 'Principal, interest and fees', accent: '#e0f2fe' },
  ];

  const selectedExportCols = ALL_EXPORT_COLS.filter((c) => exportCols[c.key]);
  const toggleExportCol = (key) => setExportCols((prev) => ({ ...prev, [key]: !prev[key] }));
  const exportRows = filtered.map((r) => ({
    ...r,
    accountBalance: gh(r.accountBalance),
    loanBalance: gh(r.loanBalance),
    principal: gh(r.principal),
    interest: gh(r.interest),
    totalPayable: gh(r.totalPayable),
    overdue: gh(r.overdue),
  }));
  const selectedKeys = selectedExportCols.map((c) => c.key);
  const downloadCSV = () => {
    if (!selectedKeys.length) {
      showWarning('Select at least one column to export');
      return;
    }
    downloadCsvFile('bank_loan_summary.csv', selectedKeys, exportRows);
  };
  const exportPdf = () => {
    if (!selectedKeys.length) {
      showWarning('Select at least one column to export');
      return;
    }
    openBrandedPrintWindow({
      title: 'Bank & Loan Summary Sheet',
      subtitle: 'Customer account and loan balances',
      summaryCards: cards.map((c) => ({ label: c.label, value: c.value })),
      tables: [{
        title: 'Summary',
        columns: selectedExportCols,
        rows: exportRows,
        emptyText: 'No records to export.',
      }],
    });
  };
  const resetFilters = () => {
    setQ('');
    setStatusFilter('');
    setLoanFilter('');
    setOverdueOnly(false);
    setPage(1);
  };

  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Bank & Loan Summary Sheet</h1>
          <div className="dashboard-subtitle">Customer/account details with calculated loan and savings totals.</div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={exportPdf}><IconFile /><span>Export PDF</span></button>
          <button className="btn btn-primary" type="button" onClick={downloadCSV}><IconDownload /><span>Export CSV</span></button>
        </div>
      </div>
      <div className="dashboard-kpi-grid">
        {cards.map((item) => (
          <div key={item.label} className="card dashboard-kpi-card" style={{ '--accent': item.accent }}>
            <div className="dashboard-kpi-label">{item.label}</div>
            <KpiValue>{item.value}</KpiValue>
            <div className="dashboard-kpi-hint">{item.hint}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <label>
            Search
            <input className="input" style={{ minWidth: 220 }} placeholder="Name, account or status" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </label>
          <label>
            Status
            <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Loans
            <select className="input" value={loanFilter} onChange={(e) => { setLoanFilter(e.target.value); setPage(1); }}>
              <option value="">All accounts</option>
              <option value="with">With loan</option>
              <option value="none">No loan</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }} />
            Overdue only
          </label>
          <button className="btn" type="button" onClick={resetFilters}>Clear filters</button>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <div style={{ color: '#64748b' }}>Export columns</div>
          {ALL_EXPORT_COLS.map((c) => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={!!exportCols[c.key]} onChange={() => toggleExportCol(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Accounts</h3>
          <div className="dashboard-subtitle">{filtered.length} records</div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Account Number</th>
                <th>Account Balance</th>
                <th>Loan Balance</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Total Payable</th>
                <th>Rate (%)</th>
                <th>Months</th>
                <th>Start</th>
                <th>Due</th>
                <th>Days to Due</th>
                <th>Overdue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} style={{ background: Number(r.overdue || 0) > 0 ? '#fff1f2' : undefined }}>
                  <td>{r.name || '—'}</td>
                  <td>{r.accountNumber}</td>
                  <td>{gh(r.accountBalance)}</td>
                  <td>{gh(r.loanBalance)}</td>
                  <td>{r.principal ? gh(r.principal) : '—'}</td>
                  <td>{r.interest ? gh(r.interest) : '—'}</td>
                  <td>{r.totalPayable ? gh(r.totalPayable) : '—'}</td>
                  <td>{r.rate === '' || r.rate == null ? '—' : r.rate}</td>
                  <td>{r.months === '' || r.months == null ? '—' : r.months}</td>
                  <td>{r.start || '—'}</td>
                  <td>{r.due || '—'}</td>
                  <td>{r.daysToDue === '' ? '—' : String(r.daysToDue)}</td>
                  <td>{gh(r.overdue)}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan="14">No customer records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </div>
  );
}
