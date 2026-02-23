import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import TopBar from './TopBar';
import LoadingBar from './LoadingBar';
import Toaster from './Toaster';
import './layout.css';
import { addTab } from '../state/tabs';
import { hasPermission, PERMISSIONS, getAppConfig, onConfigUpdate } from '../state/ops';
 

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
  const [cfg, setCfg] = useState(getAppConfig());
  useEffect(() => onConfigUpdate(setCfg), []);
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand" onClick={() => navigate('/dashboard')}>
          <img src="/logo512.png" alt={cfg.appName || 'smBank'} className="brand-logo" />
          <span>{cfg.appName || 'smBank'}</span>
        </div>
        <nav className="nav">
          <NavLink to="/my-account" className="nav-item" onClick={() => addTab({ to: '/my-account', label: 'My Account' })}>My Account</NavLink>
          {hasPermission(PERMISSIONS.DASHBOARD_VIEW) && (
            <NavLink to="/dashboard" className="nav-item" onClick={() => addTab({ to: '/dashboard', label: 'Dashboard' })}>Dashboard</NavLink>
          )}
          {hasPermission(PERMISSIONS.CLIENTS_VIEW) && (
            <NavLink to="/clients" className="nav-item" onClick={() => addTab({ to: '/clients', label: 'Clients' })}>Clients</NavLink>
          )}
          {hasPermission(PERMISSIONS.DEPOSIT_CREATE) && (
            <NavLink to="/transactions/deposit" className="nav-item" onClick={() => addTab({ to: '/transactions/deposit', label: 'Deposit' })}>Deposit</NavLink>
          )}
          {hasPermission(PERMISSIONS.WITHDRAW_CREATE) && (
            <NavLink to="/transactions/withdraw" className="nav-item" onClick={() => addTab({ to: '/transactions/withdraw', label: 'Withdraw' })}>Withdraw</NavLink>
          )}
          {hasPermission(PERMISSIONS.TXN_APPROVALS_VIEW) && (
            <NavLink to="/transactions/approvals" className="nav-item" onClick={() => addTab({ to: '/transactions/approvals', label: 'Txn Approvals' })}>Txn Approvals</NavLink>
          )}
          {hasPermission(PERMISSIONS.TXN_RECORDS_VIEW) && (
            <NavLink to="/transactions/records" className="nav-item" onClick={() => addTab({ to: '/transactions/records', label: 'Txn Records' })}>Txn Records</NavLink>
          )}
          {hasPermission(PERMISSIONS.STATEMENTS_VIEW) && (
            <NavLink to="/statements" className="nav-item" onClick={() => addTab({ to: '/statements', label: 'Statements' })}>Statements</NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_VIEW) && (
            <NavLink to="/loans" className="nav-item" onClick={() => addTab({ to: '/loans', label: 'Loans' })}>Loans</NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAYMENTS_VIEW) && (
            <NavLink to="/loans/statements" className="nav-item" onClick={() => addTab({ to: '/loans/statements', label: 'Loan Statements' })}>Loan Statements</NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_APPROVALS_VIEW) && (
            <NavLink to="/loans/approvals" className="nav-item" onClick={() => addTab({ to: '/loans/approvals', label: 'Approvals' })}>Approvals</NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_RECORDS_VIEW) && (
            <NavLink to="/loans/records" className="nav-item" onClick={() => addTab({ to: '/loans/records', label: 'Loan Records' })}>Loan Records</NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAYMENTS_VIEW) && (
            <NavLink to="/loans/repayments" className="nav-item" onClick={() => addTab({ to: '/loans/repayments', label: 'Repayment Records' })}>Repayment Records</NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAY_CREATE) && (
            <NavLink to="/loans/repay" className="nav-item" onClick={() => addTab({ to: '/loans/repay', label: 'Repay Loan' })}>Repay Loan</NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAY_APPROVALS_VIEW) && (
            <NavLink to="/loans/repay/approvals" className="nav-item" onClick={() => addTab({ to: '/loans/repay/approvals', label: 'Repay Approvals' })}>Repay Approvals</NavLink>
          )}
          {hasPermission(PERMISSIONS.REPORTS_VIEW) && (
            <NavLink to="/reports" className="nav-item" onClick={() => addTab({ to: '/reports', label: 'Reports' })}>Reports</NavLink>
          )}
          {hasPermission(PERMISSIONS.ASSETS_VIEW) && (
            <NavLink to="/assets" className="nav-item" onClick={() => addTab({ to: '/assets', label: 'Assets Reg' })}>Assets Reg</NavLink>
          )}
          {hasPermission(PERMISSIONS.CONFIG_MANAGE) && (
            <NavLink to="/config" className="nav-item" onClick={() => addTab({ to: '/config', label: 'Config' })}>Config</NavLink>
          )}
          {hasPermission(PERMISSIONS.USERS_MANAGE) && (
            <NavLink to="/users" className="nav-item" onClick={() => addTab({ to: '/users', label: 'Users' })}>Users</NavLink>
          )}
          {hasPermission(PERMISSIONS.ACTIVITY_VIEW) && (
            <NavLink to="/activity" className="nav-item" onClick={() => addTab({ to: '/activity', label: 'Activity' })}>Activity</NavLink>
          )}
          {hasPermission(PERMISSIONS.MEDIA_UPLOAD) && (
            <NavLink to="/media" className="nav-item" onClick={() => addTab({ to: '/media', label: 'Media Upload' })}>Media Upload</NavLink>
          )}
          {hasPermission(PERMISSIONS.NOTIFY_SEND) && (
            <NavLink to="/promotions" className="nav-item" onClick={() => addTab({ to: '/promotions', label: 'Promotions' })}>Promotions</NavLink>
          )}
          {hasPermission(PERMISSIONS.NOTIFY_SEND) && (
            <NavLink to="/notifications" className="nav-item" onClick={() => addTab({ to: '/notifications', label: 'Notifications' })}>Notifications</NavLink>
          )}
          {hasPermission(PERMISSIONS.SERVERLOGS_VIEW) && (
            <NavLink to="/server-logs" className="nav-item" onClick={() => addTab({ to: '/server-logs', label: 'Server Logs' })}>Server Logs</NavLink>
          )}
          {hasPermission(PERMISSIONS.SUPERBIN_VIEW) && (
            <NavLink to="/super-bin" className="nav-item" onClick={() => addTab({ to: '/super-bin', label: 'Super Bin' })}>Super Bin</NavLink>
          )}
        </nav>
      </aside>
      <TopBar />
      <LoadingBar />
      <main className="content" ref={contentRef}>
        <div className="container fade-in">
          <Outlet />
        </div>
        <div className="app-footer">
          <div className="container">{cfg.footerText || ''}</div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
