import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SavingsLine, LoansBar, LoanStatusDoughnut } from '../components/Charts';
import { listLoanRepayPosted, listLoans, listPostedTransactions } from '../api';

export default function Dashboard() {
  const [acct, setAcct] = useState('');
  const [posted, setPosted] = useState([]);
  const [repays, setRepays] = useState([]);
  const [loans, setLoans] = useState([]);
  useEffect(() => {
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
  }, []);
  const transactions = useMemo(() => [...posted, ...repays], [posted, repays]);
  const totals = useMemo(() => {
    const rows = transactions.filter(t => !acct || t.account === acct);
    let deposits = 0, withdrawals = 0, repayments = 0, disbursed = 0;
    rows.forEach(t => {
      if (t.type === 'Deposit') deposits += t.amount;
      if (t.type === 'Withdrawal') withdrawals += t.amount;
      if (t.type === 'Loan Repayment') repayments += t.amount;
      if (t.type === 'Loan Disbursement') disbursed += t.amount;
    });
    return {
      balance: deposits + repayments - withdrawals - disbursed,
      deposits, withdrawals, repayments, disbursed
    };
  }, [transactions, acct]);
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
  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="stack" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', display: 'grid', gap: 16 }}>
        <div className="card">
          <h3>Clients</h3>
          <Link to="/clients">Manage</Link>
        </div>
        <div className="card">
          <h3>Savings</h3>
          <div className="row">
            <Link to="/transactions/deposit">Deposit</Link>
            <Link to="/transactions/withdraw">Withdraw</Link>
          </div>
        </div>
        <div className="card">
          <h3>Loans</h3>
          <Link to="/loans">Manage</Link>
        </div>
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
            <input className="input" placeholder="Account Number (10 digits)" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\\D/g, '').slice(0,10))} />
            <Link className="btn" to={acct ? `/clients/${acct}` : '#'}>Open Client</Link>
            <Link className="btn" to="/statements">Open Statements</Link>
          </div>
          <div className="row" style={{ gap: 24 }}>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Balance</div><div style={{ fontWeight: 700 }}>{currency(totals.balance)}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Deposits</div><div>{currency(totals.deposits)}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Withdrawals</div><div>{currency(totals.withdrawals)}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Repayments</div><div>{currency(totals.repayments)}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Disbursed</div><div>{currency(totals.disbursed)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
