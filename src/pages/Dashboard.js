import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { Link } from 'react-router-dom';
import { SavingsLine, LoansBar, LoanStatusDoughnut } from '../components/Charts';
import { listLoanRepayPosted, listLoans, listPostedTransactions } from '../api';

export default function Dashboard() {
  const canView = hasPermission(PERMISSIONS.DASHBOARD_VIEW);
  const canClients = hasPermission(PERMISSIONS.CLIENTS_VIEW);
  const canDeposit = hasPermission(PERMISSIONS.DEPOSIT_CREATE);
  const canWithdraw = hasPermission(PERMISSIONS.WITHDRAW_CREATE);
  const canLoans = hasPermission(PERMISSIONS.LOANS_VIEW);
  const [acct, setAcct] = useState('');
  const [posted, setPosted] = useState([]);
  const [repays, setRepays] = useState([]);
  const [loans, setLoans] = useState([]);
  useEffect(() => {
    if (!canView) return;
    const run = async () => {
      try {
        const [tx, rp, ls] = await Promise.all([
          listPostedTransactions({}),
          listLoanRepayPosted({}),
          listLoans({}),
        ]);
        const normTx = tx.map(p => ({
          account: p.accountNumber,
          type: p.kind === 'deposit' ? 'Deposit' : p.kind === 'withdraw' ? 'Withdrawal' : 'Loan Disbursement',
          amount: p.amount,
          date: p.approvedAt?.slice(0, 10) || '',
        }));
        const normRp = rp.map(r => ({
          account: r.accountNumber,
          type: 'Loan Repayment',
          amount: r.amount,
          date: (r.approvedAt || r.initiatedAt || '').slice(0, 10),
        }));
        setPosted(normTx);
        setRepays(normRp);
        setLoans(ls || []);
      } catch {
        setPosted([]);
        setRepays([]);
        setLoans([]);
      }
    };
    run();
  }, [canView]);
  const transactions = useMemo(() => [...posted, ...repays], [posted, repays]);
  const mainTotals = useMemo(() => {
    const rows = posted.filter(t => (!acct || t.account === acct) && (t.type === 'Deposit' || t.type === 'Withdrawal'));
    let deposits = 0, withdrawals = 0;
    rows.forEach(t => {
      if (t.type === 'Deposit') deposits += t.amount;
      if (t.type === 'Withdrawal') withdrawals += t.amount;
    });
    return { balance: deposits - withdrawals, deposits, withdrawals };
  }, [posted, acct]);
  const loanTotals = useMemo(() => {
    const allRepaid = repays.reduce((s, r) => s + Number(r.amount || 0), 0);
    const repaid = acct ? repays.filter(r => r.account === acct).reduce((s, r) => s + Number(r.amount || 0), 0) : allRepaid;
    const ls = (loans || []).filter(l => {
      const acctOk = acct ? l.accountNumber === acct : true;
      const isActive = !l.status || l.status === 'Active';
      return acctOk && isActive;
    });
    const disbursed = ls.reduce((s, l) => s + Number(l.principal || 0), 0);
    const totalDue = ls.reduce((s, l) => {
      const principal = Number(l.principal || 0);
      const totalInterest = Number(l.totalInterest || 0);
      const fees = Number(l.totalFees || 0);
      const due = Number(l.totalDue || (principal + totalInterest + fees));
      return s + due;
    }, 0);
    const outstanding = Math.max(0, totalDue - repaid);
    return { outstanding, repaid, disbursed };
  }, [loans, repays, acct]);
  const last6Months = useMemo(() => {
    const arr = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      arr.push(ym);
    }
    return arr;
  }, []);
  const savingsSeries = useMemo(() => {
    const map = new Map(last6Months.map(m => [m, { deposits: 0, withdrawals: 0 }]));
    transactions.filter(t => !acct || t.account === acct).forEach(t => {
      if (!t.date) return;
      const ym = t.date.slice(0, 7);
      if (!map.has(ym)) return;
      const rec = map.get(ym);
      if (t.type === 'Deposit') rec.deposits += t.amount;
      if (t.type === 'Withdrawal') rec.withdrawals += t.amount;
    });
    return last6Months.map(m => ({ date: m, ...map.get(m) }));
  }, [transactions, acct, last6Months]);
  const loansBar = useMemo(() => {
    const map = new Map(last6Months.map(m => [m, { disbursed: 0, repaid: 0 }]));
    posted.filter(p => p.type === 'Loan Disbursement' && (!acct || p.account === acct)).forEach(p => {
      if (!p.date) return;
      const ym = p.date.slice(0, 7);
      if (map.has(ym)) map.get(ym).disbursed += p.amount;
    });
    repays.filter(r => !acct || r.account === acct).forEach(r => {
      if (!r.date) return;
      const ym = r.date.slice(0, 7);
      if (map.has(ym)) map.get(ym).repaid += r.amount;
    });
    return last6Months.map(m => ({ month: m, ...map.get(m) }));
  }, [posted, repays, acct, last6Months]);
  const statusCounts = useMemo(() => {
    const counts = { Pending: 0, Active: 0 };
    loans.forEach(l => {
      if (l.status === 'Pending') counts.Pending++;
      else counts.Active++;
    });
    return counts;
  }, [loans]);
  const currency = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });
  if (!canView) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="stack" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', display: 'grid', gap: 16 }}>
        {canClients && <div className="card">
          <h3>Clients</h3>
          <Link to="/clients">Manage</Link>
        </div>}
        {(canDeposit || canWithdraw) && <div className="card">
          <h3>Savings</h3>
          <div className="row">
            {canDeposit && <Link to="/transactions/deposit">Deposit</Link>}
            {canWithdraw && <Link to="/transactions/withdraw">Withdraw</Link>}
          </div>
        </div>}
        {canLoans && <div className="card">
          <h3>Loans</h3>
          <Link to="/loans">Manage</Link>
        </div>}
        <div className="card">
          <h3>Savings Trend</h3>
          <SavingsLine series={savingsSeries} />
        </div>
        <div className="card">
          <h3>Loans: Disbursed vs Repaid</h3>
          <LoansBar months={loansBar} />
        </div>
        <div className="card">
          <h3>Loan Status Distribution</h3>
          <LoanStatusDoughnut counts={statusCounts} />
        </div>
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3>Balances Quick Lookup</h3>
          <div className="row" style={{ margin: '8px 0' }}>
            <input className="input" placeholder="Account Number (up to 13 digits)" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0,13))} />
            <Link className="btn" to={acct ? `/clients/${acct}` : '#'}>Open Client</Link>
            <Link className="btn" to="/statements">Open Statements</Link>
          </div>
          <div className="row" style={{ gap: 24 }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Main Balance</div>
              <div style={{ fontWeight: 700 }}>{currency(mainTotals.balance)}</div>
            </div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Deposits</div><div>{currency(mainTotals.deposits)}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Withdrawals</div><div>{currency(mainTotals.withdrawals)}</div></div>
            <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
            <div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Loan Outstanding</div>
              <div style={{ fontWeight: 700 }}>{currency(loanTotals.outstanding)}</div>
            </div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Repaid</div><div>{currency(loanTotals.repaid)}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Disbursed</div><div>{currency(loanTotals.disbursed)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
