import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import TopBar from './TopBar';
import './layout.css';
import { addTab } from '../state/tabs';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef(null);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.classList.remove('fade-in');
    // force reflow
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.classList.add('fade-in');
  }, [location.pathname]);
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand" onClick={() => navigate('/dashboard')}>smBank</div>
        <nav className="nav">
          <NavLink to="/dashboard" className="nav-item" onClick={() => addTab({ to: '/dashboard', label: 'Dashboard' })}>Dashboard</NavLink>
          <NavLink to="/clients" className="nav-item" onClick={() => addTab({ to: '/clients', label: 'Clients' })}>Clients</NavLink>
          <NavLink to="/transactions/deposit" className="nav-item" onClick={() => addTab({ to: '/transactions/deposit', label: 'Deposit' })}>Deposit</NavLink>
          <NavLink to="/transactions/withdraw" className="nav-item" onClick={() => addTab({ to: '/transactions/withdraw', label: 'Withdraw' })}>Withdraw</NavLink>
          <NavLink to="/transactions/approvals" className="nav-item" onClick={() => addTab({ to: '/transactions/approvals', label: 'Txn Approvals' })}>Txn Approvals</NavLink>
          <NavLink to="/statements" className="nav-item" onClick={() => addTab({ to: '/statements', label: 'Statements' })}>Statements</NavLink>
          <NavLink to="/loans" className="nav-item" onClick={() => addTab({ to: '/loans', label: 'Loans' })}>Loans</NavLink>
          <NavLink to="/loans/approvals" className="nav-item" onClick={() => addTab({ to: '/loans/approvals', label: 'Approvals' })}>Approvals</NavLink>
          <NavLink to="/loans/records" className="nav-item" onClick={() => addTab({ to: '/loans/records', label: 'Loan Records' })}>Loan Records</NavLink>
          <NavLink to="/loans/repayments" className="nav-item" onClick={() => addTab({ to: '/loans/repayments', label: 'Repayment Records' })}>Repayment Records</NavLink>
          <NavLink to="/loans/repay" className="nav-item" onClick={() => addTab({ to: '/loans/repay', label: 'Repay Loan' })}>Repay Loan</NavLink>
          <NavLink to="/loans/repay/approvals" className="nav-item" onClick={() => addTab({ to: '/loans/repay/approvals', label: 'Repay Approvals' })}>Repay Approvals</NavLink>
          <NavLink to="/reports" className="nav-item" onClick={() => addTab({ to: '/reports', label: 'Reports' })}>Reports</NavLink>
        </nav>
      </aside>
      <TopBar />
      <main className="content" ref={contentRef}>
        <div className="container fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
