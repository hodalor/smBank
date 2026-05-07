import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SavingsLine, LoansBar, LoanStatusDoughnut } from '../components/Charts';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { listClients, listLoanRepayPosted, listLoans, listPostedTransactions } from '../api';

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatBucket(date, mode) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  if (mode === 'daily') return formatDateInput(date);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildBuckets(from, to) {
  const start = parseDate(from);
  const end = parseDate(to, true);
  const useDaily = !!(start && end && ((end.getTime() - start.getTime()) / DAY_MS) <= 45);
  const mode = useDaily ? 'daily' : 'monthly';
  const labels = [];
  if (start && end) {
    if (useDaily) {
      for (let ts = start.getTime(); ts <= end.getTime(); ts += DAY_MS) {
        labels.push(formatBucket(new Date(ts), mode));
      }
    } else {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= last) {
        labels.push(formatBucket(cursor, mode));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
  } else {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      labels.push(formatBucket(new Date(now.getFullYear(), now.getMonth() - i, 1), 'monthly'));
    }
  }
  return { labels, mode };
}

function isWithinRange(value, from, to) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return !from && !to;
  const start = parseDate(from);
  const end = parseDate(to, true);
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function formatScope(period, from, to) {
  if (period === 'all') return 'All time';
  if (from && to) return `${from} to ${to}`;
  return 'Selected range';
}

export default function Dashboard() {
  const canView = hasPermission(PERMISSIONS.DASHBOARD_VIEW);
  const canClients = hasPermission(PERMISSIONS.CLIENTS_VIEW);
  const canDeposit = hasPermission(PERMISSIONS.DEPOSIT_CREATE);
  const canWithdraw = hasPermission(PERMISSIONS.WITHDRAW_CREATE);
  const canLoans = hasPermission(PERMISSIONS.LOANS_VIEW);
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState('30d');
  const [from, setFrom] = useState(formatDateInput(new Date(today.getTime() - 29 * DAY_MS)));
  const [to, setTo] = useState(formatDateInput(today));
  const [acct, setAcct] = useState('');
  const [posted, setPosted] = useState([]);
  const [repays, setRepays] = useState([]);
  const [loans, setLoans] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (period === 'custom') return;
    if (period === 'all') {
      setFrom('');
      setTo('');
      return;
    }
    const days = Number(String(period).replace(/\D/g, '')) || 30;
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * DAY_MS);
    setFrom(formatDateInput(start));
    setTo(formatDateInput(end));
  }, [period]);

  useEffect(() => {
    if (!canView) return;
    const run = async () => {
      try {
        const [tx, rp, ls, cl] = await Promise.all([
          listPostedTransactions({}),
          listLoanRepayPosted({}),
          listLoans({}),
          listClients({}),
        ]);
        setPosted((tx || []).map((p) => ({
          id: p.id,
          account: p.accountNumber,
          type: p.kind === 'deposit' ? 'Deposit' : p.kind === 'withdraw' ? 'Withdrawal' : 'Loan Disbursement',
          kind: p.kind || '',
          amount: Number(p.amount || 0),
          dateValue: p.approvedAt || p.initiatedAt || p.createdAt || '',
        })));
        setRepays((rp || []).map((r) => ({
          id: r.id,
          loanId: r.loanId,
          account: r.accountNumber,
          type: 'Loan Repayment',
          amount: Number(r.amount || 0),
          dateValue: r.approvedAt || r.initiatedAt || '',
        })));
        setLoans(Array.isArray(ls) ? ls : []);
        setClients(Array.isArray(cl) ? cl : []);
      } catch {
        setPosted([]);
        setRepays([]);
        setLoans([]);
        setClients([]);
      }
    };
    run();
  }, [canView]);

  const scopeLabel = useMemo(() => formatScope(period, from, to), [period, from, to]);
  const filteredPosted = useMemo(() => posted.filter((t) => (!acct || t.account === acct) && isWithinRange(t.dateValue, from, to)), [posted, acct, from, to]);
  const filteredRepays = useMemo(() => repays.filter((r) => (!acct || r.account === acct) && isWithinRange(r.dateValue, from, to)), [repays, acct, from, to]);
  const loansInScope = useMemo(() => (loans || []).filter((l) => {
    if (acct && l.accountNumber !== acct) return false;
    const stamp = l.approvedAt || l.createdAt || l.initiatedAt || l.updatedAt || '';
    return isWithinRange(stamp, from, to);
  }), [loans, acct, from, to]);
  const loanIdsInScope = useMemo(() => new Set(loansInScope.map((l) => String(l.id || l.loanId || ''))), [loansInScope]);
  const relatedRepays = useMemo(() => repays.filter((r) => {
    if (acct && r.account !== acct) return false;
    const rid = String(r.loanId || '');
    return !loanIdsInScope.size || loanIdsInScope.has(rid);
  }), [repays, acct, loanIdsInScope]);

  const metrics = useMemo(() => {
    const deposits = filteredPosted.filter((t) => t.type === 'Deposit').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const withdrawals = filteredPosted.filter((t) => t.type === 'Withdrawal').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const disbursed = filteredPosted.filter((t) => t.type === 'Loan Disbursement').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const repaid = filteredRepays.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const expectedRevenue = loansInScope.reduce((sum, l) => sum + Number(l.totalInterest || 0) + Number(l.totalFees || 0), 0);
    const repaidByLoan = relatedRepays.reduce((map, r) => {
      const key = String(r.loanId || '');
      map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
      return map;
    }, new Map());
    const outstanding = loansInScope.reduce((sum, l) => {
      const due = Number(l.outstanding || l.outstandingBalance || l.totalDue || (Number(l.principal || 0) + Number(l.totalInterest || 0) + Number(l.totalFees || 0)));
      const repaidForLoan = repaidByLoan.get(String(l.id || l.loanId || '')) || 0;
      return sum + Math.max(0, due - repaidForLoan);
    }, 0);
    const netCashflow = deposits + repaid - withdrawals - disbursed;
    return {
      deposits,
      withdrawals,
      disbursed,
      repaid,
      expectedRevenue,
      outstanding,
      customers: clients.length,
      netCashflow,
      activeLoans: loans.filter((l) => (!acct || l.accountNumber === acct) && String(l.status || 'Active') !== 'Rejected').length,
    };
  }, [filteredPosted, filteredRepays, loansInScope, relatedRepays, clients, loans, acct]);

  const bucketMeta = useMemo(() => buildBuckets(from, to), [from, to]);
  const savingsSeries = useMemo(() => {
    const map = new Map(bucketMeta.labels.map((label) => [label, { deposits: 0, withdrawals: 0 }]));
    filteredPosted.forEach((t) => {
      const label = formatBucket(new Date(t.dateValue), bucketMeta.mode);
      if (!map.has(label)) return;
      if (t.type === 'Deposit') map.get(label).deposits += Number(t.amount || 0);
      if (t.type === 'Withdrawal') map.get(label).withdrawals += Number(t.amount || 0);
    });
    return bucketMeta.labels.map((label) => ({ date: label, ...map.get(label) }));
  }, [filteredPosted, bucketMeta]);

  const loansBar = useMemo(() => {
    const map = new Map(bucketMeta.labels.map((label) => [label, { disbursed: 0, repaid: 0 }]));
    filteredPosted.filter((p) => p.type === 'Loan Disbursement').forEach((p) => {
      const label = formatBucket(new Date(p.dateValue), bucketMeta.mode);
      if (map.has(label)) map.get(label).disbursed += Number(p.amount || 0);
    });
    filteredRepays.forEach((r) => {
      const label = formatBucket(new Date(r.dateValue), bucketMeta.mode);
      if (map.has(label)) map.get(label).repaid += Number(r.amount || 0);
    });
    return bucketMeta.labels.map((label) => ({ month: label, ...map.get(label) }));
  }, [filteredPosted, filteredRepays, bucketMeta]);

  const statusCounts = useMemo(() => {
    const counts = {};
    loansInScope.forEach((l) => {
      const key = String(l.status || 'Active');
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).length ? counts : { 'No Loans': 1 };
  }, [loansInScope]);

  const currency = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });
  const kpis = [
    { label: 'Deposits', value: currency(metrics.deposits), hint: `Cash received in ${scopeLabel}`, accent: '#dcfce7' },
    { label: 'Withdrawals', value: currency(metrics.withdrawals), hint: `Cash paid out in ${scopeLabel}`, accent: '#fee2e2' },
    { label: 'Loan Disbursed', value: currency(metrics.disbursed), hint: 'Loans released to customers', accent: '#dbeafe' },
    { label: 'Loan Repaid', value: currency(metrics.repaid), hint: 'Loan repayments received', accent: '#e0f2fe' },
    { label: 'Expected Revenue', value: currency(metrics.expectedRevenue), hint: 'Interest plus fees in scope', accent: '#fef3c7' },
    { label: 'Outstanding Loans', value: currency(metrics.outstanding), hint: 'Estimated amount still due', accent: '#ede9fe' },
    { label: 'Total Customers', value: String(metrics.customers), hint: 'All customer records in the system', accent: '#fce7f3' },
    { label: 'Net Cashflow', value: currency(metrics.netCashflow), hint: 'Deposits and repayments minus payouts', accent: '#dcfce7' },
  ];

  if (!canView) return <div className="card">Not authorized.</div>;

  return (
    <div className="stack">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <div className="dashboard-subtitle">A simple operating view of savings, loan activity, customers, and cash movement.</div>
        </div>
        <div className="row">
          {canClients && <Link className="btn" to="/clients">Manage Clients</Link>}
          {canLoans && <Link className="btn" to="/loans">Manage Loans</Link>}
          {canDeposit && <Link className="btn" to="/transactions/deposit">New Deposit</Link>}
          {canWithdraw && <Link className="btn" to="/transactions/withdraw">New Withdrawal</Link>}
        </div>
      </div>

      <div className="card dashboard-filter-card">
        <div className="dashboard-filter-grid">
          <label>
            Period
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
            </select>
          </label>
          <label>
            From
            <input className="input" type="date" value={from} onChange={(e) => { setPeriod('custom'); setFrom(e.target.value); }} disabled={period === 'all'} />
          </label>
          <label>
            To
            <input className="input" type="date" value={to} onChange={(e) => { setPeriod('custom'); setTo(e.target.value); }} disabled={period === 'all'} />
          </label>
          <label>
            Account Filter
            <input className="input" placeholder="Optional account number" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 13))} />
          </label>
        </div>
      </div>

      <div className="dashboard-kpi-grid">
        {kpis.map((item) => (
          <div key={item.label} className="card dashboard-kpi-card" style={{ '--accent': item.accent }}>
            <div className="dashboard-kpi-label">{item.label}</div>
            <div className="dashboard-kpi-value">{item.value}</div>
            <div className="dashboard-kpi-hint">{item.hint}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="card dashboard-chart-card">
          <div className="dashboard-card-head">
            <div>
              <h3>Savings Movement</h3>
              <div className="dashboard-subtitle">{scopeLabel}</div>
            </div>
          </div>
          <SavingsLine series={savingsSeries} />
        </div>
        <div className="card dashboard-chart-card">
          <div className="dashboard-card-head">
            <div>
              <h3>Loans Disbursed vs Repaid</h3>
              <div className="dashboard-subtitle">Shows outgoing loans against collections</div>
            </div>
          </div>
          <LoansBar months={loansBar} />
        </div>
        <div className="card dashboard-chart-card">
          <div className="dashboard-card-head">
            <div>
              <h3>Loan Status Mix</h3>
              <div className="dashboard-subtitle">Portfolio health in the selected scope</div>
            </div>
          </div>
          <LoanStatusDoughnut counts={statusCounts} />
        </div>
        <div className="card dashboard-chart-card">
          <div className="dashboard-card-head">
            <div>
              <h3>Quick Lookup</h3>
              <div className="dashboard-subtitle">Open a customer or statement with the current account filter</div>
            </div>
          </div>
          <div className="stack">
            <div className="row">
              <input className="input" placeholder="Account Number (up to 13 digits)" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 13))} />
              <Link className="btn" to={acct ? `/clients/${acct}` : '/clients'}>Open Client</Link>
              <Link className="btn" to={acct ? `/statements?account=${acct}` : '/statements'}>Open Statements</Link>
            </div>
            <div className="dashboard-lookup-grid">
              <div className="dashboard-mini-stat">
                <span>Active Loans</span>
                <strong>{metrics.activeLoans}</strong>
              </div>
              <div className="dashboard-mini-stat">
                <span>Deposits</span>
                <strong>{currency(metrics.deposits)}</strong>
              </div>
              <div className="dashboard-mini-stat">
                <span>Withdrawals</span>
                <strong>{currency(metrics.withdrawals)}</strong>
              </div>
              <div className="dashboard-mini-stat">
                <span>Outstanding</span>
                <strong>{currency(metrics.outstanding)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
