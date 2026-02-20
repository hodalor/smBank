import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SavingsLine, LoansBar, LoanStatusDoughnut } from '../components/Charts';

export default function Dashboard() {
  const [acct, setAcct] = useState('');
  const transactions = useMemo(
    () => [
      { account: '4839201746', type: 'Deposit', amount: 300 },
      { account: '4839201746', type: 'Withdrawal', amount: 50 },
      { account: '4839201746', type: 'Loan Disbursement', amount: 500 },
      { account: '4839201746', type: 'Loan Repayment', amount: 120 },
      { account: '7392046158', type: 'Deposit', amount: 200 }
    ],
    []
  );
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
          <SavingsLine series={[
            { date: '2026-01', deposits: 1200, withdrawals: 300 },
            { date: '2026-02', deposits: 1600, withdrawals: 400 },
            { date: '2026-03', deposits: 900, withdrawals: 500 },
            { date: '2026-04', deposits: 1400, withdrawals: 600 },
          ]} />
        </div>
        <div className="card">
          <h3>Loans: Disbursed vs Repaid</h3>
          <LoansBar months={[
            { month: 'Jan', disbursed: 5000, repaid: 1000, writtenOff: 200 },
            { month: 'Feb', disbursed: 3000, repaid: 1800, writtenOff: 0 },
            { month: 'Mar', disbursed: 4200, repaid: 2100, writtenOff: 150 },
            { month: 'Apr', disbursed: 3500, repaid: 2500, writtenOff: 300 },
          ]} />
        </div>
        <div className="card">
          <h3>Loan Status Distribution</h3>
          <LoanStatusDoughnut counts={{
            Pending: 6, Approved: 12, Active: 30, Completed: 18, Overdue: 4, 'Written Off': 3
          }} />
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
