import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import TopBar from './TopBar';
import LoadingBar from './LoadingBar';
import Toaster from './Toaster';
import './layout.css';
import { addTab } from '../state/tabs';
import { hasPermission, PERMISSIONS, getAppConfig, onConfigUpdate } from '../state/ops';
 

function Svg(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}
function IconUser() {
  return (
    <Svg>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  );
}
function IconDashboard() {
  return (
    <Svg>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="11" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </Svg>
  );
}
function IconUsers() {
  return (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}
function IconArrowDownBox() {
  return (
    <Svg>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  );
}
function IconArrowUpBox() {
  return (
    <Svg>
      <path d="M12 21V9" />
      <path d="M17 14l-5-5-5 5" />
      <path d="M5 3h14" />
    </Svg>
  );
}
function IconFileText() {
  return (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </Svg>
  );
}
function IconCreditCard() {
  return (
    <Svg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h2" />
    </Svg>
  );
}
function IconCheckCircle() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}
function IconList() {
  return (
    <Svg>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </Svg>
  );
}
function IconUTurn() {
  return (
    <Svg>
      <path d="M3 7h11a4 4 0 0 1 0 8H7" />
      <path d="M7 15l-4-4 4-4" />
    </Svg>
  );
}
function IconBarChart() {
  return (
    <Svg>
      <path d="M3 3v18" />
      <path d="M7 13v8" />
      <path d="M11 9v12" />
      <path d="M15 5v16" />
      <path d="M19 17v4" />
    </Svg>
  );
}
function IconDatabase() {
  return (
    <Svg>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v10c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </Svg>
  );
}
function IconSliders() {
  return (
    <Svg>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="2" y1="14" x2="6" y2="14" />
      <line x1="10" y1="8" x2="14" y2="8" />
      <line x1="18" y1="16" x2="22" y2="16" />
    </Svg>
  );
}
function IconActivity() {
  return (
    <Svg>
      <path d="M22 12H18l-3 7L9 5l-3 7H2" />
    </Svg>
  );
}
function IconImage() {
  return (
    <Svg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="10" r="2" />
      <path d="M21 15l-5-5-4 4-3-3-5 5" />
    </Svg>
  );
}
function IconMegaphone() {
  return (
    <Svg>
      <path d="M3 10a2 2 0 0 0 2 2h2l12 5V5L7 10H5a2 2 0 0 0-2 2z" />
      <path d="M7 15l1 5" />
    </Svg>
  );
}
function IconBell() {
  return (
    <Svg>
      <path d="M10 21a2 2 0 0 0 4 0" />
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 7h18s-3 0-3-7" />
    </Svg>
  );
}
function IconTerminal() {
  return (
    <Svg>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 8l3 3-3 3" />
      <path d="M13 16h4" />
    </Svg>
  );
}
function IconTrash() {
  return (
    <Svg>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}
function IconBook() {
  return (
    <Svg>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M4 4v15.5" />
      <path d="M20 4v13" />
      <path d="M6.5 17V4H20" />
    </Svg>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.classList.remove('fade-in');
    // force reflow
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.classList.add('fade-in');
  }, [location.pathname]);
  useEffect(() => {
    // close drawer on route change (mobile)
    setSidebarOpen(false);
  }, [location.pathname]);
  const [cfg, setCfg] = useState(getAppConfig());
  useEffect(() => onConfigUpdate(setCfg), []);
  return (
    <div className={`layout${sidebarHidden ? ' no-sidebar' : ''}`}>
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}${sidebarHidden ? ' collapsed' : ''}`}>
        <div className="brand" onClick={() => navigate('/dashboard')}>
          <img src="/logo512.png" alt={cfg.appName || 'smBank'} className="brand-logo" />
          <span>{cfg.appName || 'smBank'}</span>
        </div>
        <nav className="nav">
          <NavLink to="/my-account" className="nav-item" onClick={() => addTab({ to: '/my-account', label: 'My Account' })}><IconUser /><span>My Account</span></NavLink>
          {hasPermission(PERMISSIONS.DASHBOARD_VIEW) && (
            <NavLink to="/dashboard" className="nav-item" onClick={() => addTab({ to: '/dashboard', label: 'Dashboard' })}><IconDashboard /><span>Dashboard</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.CLIENTS_VIEW) && (
            <NavLink to="/clients" className="nav-item" onClick={() => addTab({ to: '/clients', label: 'Clients' })}><IconUsers /><span>Clients</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.DEPOSIT_CREATE) && (
            <NavLink to="/transactions/deposit" className="nav-item" onClick={() => addTab({ to: '/transactions/deposit', label: 'Deposit' })}><IconArrowDownBox /><span>Deposit</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.WITHDRAW_CREATE) && (
            <NavLink to="/transactions/withdraw" className="nav-item" onClick={() => addTab({ to: '/transactions/withdraw', label: 'Withdraw' })}><IconArrowUpBox /><span>Withdraw</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.TXN_APPROVALS_VIEW) && (
            <NavLink to="/transactions/approvals" className="nav-item" onClick={() => addTab({ to: '/transactions/approvals', label: 'Txn Approvals' })}><IconCheckCircle /><span>Txn Approvals</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.TXN_RECORDS_VIEW) && (
            <NavLink to="/transactions/records" className="nav-item" onClick={() => addTab({ to: '/transactions/records', label: 'Txn Records' })}><IconList /><span>Txn Records</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.STATEMENTS_VIEW) && (
            <NavLink to="/statements" className="nav-item" onClick={() => addTab({ to: '/statements', label: 'Statements' })}><IconFileText /><span>Statements</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_VIEW) && (
            <NavLink to="/loans" className="nav-item" onClick={() => addTab({ to: '/loans', label: 'Loans' })}><IconCreditCard /><span>Loans</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAYMENTS_VIEW) && (
            <NavLink to="/loans/statements" className="nav-item" onClick={() => addTab({ to: '/loans/statements', label: 'Loan Statements' })}><IconFileText /><span>Loan Statements</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_APPROVALS_VIEW) && (
            <NavLink to="/loans/approvals" className="nav-item" onClick={() => addTab({ to: '/loans/approvals', label: 'Approvals' })}><IconCheckCircle /><span>Approvals</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_RECORDS_VIEW) && (
            <NavLink to="/loans/records" className="nav-item" onClick={() => addTab({ to: '/loans/records', label: 'Loan Records' })}><IconList /><span>Loan Records</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAYMENTS_VIEW) && (
            <NavLink to="/loans/repayments" className="nav-item" onClick={() => addTab({ to: '/loans/repayments', label: 'Repayment Records' })}><IconList /><span>Repayment Records</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAY_CREATE) && (
            <NavLink to="/loans/repay" className="nav-item" onClick={() => addTab({ to: '/loans/repay', label: 'Repay Loan' })}><IconUTurn /><span>Repay Loan</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.LOANS_REPAY_APPROVALS_VIEW) && (
            <NavLink to="/loans/repay/approvals" className="nav-item" onClick={() => addTab({ to: '/loans/repay/approvals', label: 'Repay Approvals' })}><IconCheckCircle /><span>Repay Approvals</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.REPORTS_VIEW) && (
            <NavLink to="/reports" className="nav-item" onClick={() => addTab({ to: '/reports', label: 'Reports' })}><IconBarChart /><span>Reports</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.ASSETS_VIEW) && (
            <NavLink to="/assets" className="nav-item" onClick={() => addTab({ to: '/assets', label: 'Assets Reg' })}><IconDatabase /><span>Assets Reg</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.CONFIG_MANAGE) && (
            <NavLink to="/config" className="nav-item" onClick={() => addTab({ to: '/config', label: 'Config' })}><IconSliders /><span>Config</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.USERS_MANAGE) && (
            <NavLink to="/users" className="nav-item" onClick={() => addTab({ to: '/users', label: 'Users' })}><IconUsers /><span>Users</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.ACTIVITY_VIEW) && (
            <NavLink to="/activity" className="nav-item" onClick={() => addTab({ to: '/activity', label: 'Activity' })}><IconActivity /><span>Activity</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.MEDIA_UPLOAD) && (
            <NavLink to="/media" className="nav-item" onClick={() => addTab({ to: '/media', label: 'Media Upload' })}><IconImage /><span>Media Upload</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.NOTIFY_SEND) && (
            <NavLink to="/promotions" className="nav-item" onClick={() => addTab({ to: '/promotions', label: 'Promotions' })}><IconMegaphone /><span>Promotions</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.NOTIFY_SEND) && (
            <NavLink to="/notifications" className="nav-item" onClick={() => addTab({ to: '/notifications', label: 'Notifications' })}><IconBell /><span>Notifications</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.SERVERLOGS_VIEW) && (
            <NavLink to="/server-logs" className="nav-item" onClick={() => addTab({ to: '/server-logs', label: 'Server Logs' })}><IconTerminal /><span>Server Logs</span></NavLink>
          )}
          {hasPermission(PERMISSIONS.SUPERBIN_VIEW) && (
            <NavLink to="/super-bin" className="nav-item" onClick={() => addTab({ to: '/super-bin', label: 'Super Bin' })}><IconTrash /><span>Super Bin</span></NavLink>
          )}
          <NavLink to="/docs" className="nav-item" onClick={() => addTab({ to: '/docs', label: 'Docs' })}><IconBook /><span>Docs</span></NavLink>
        </nav>
      </aside>
      <div className={`sidebar-backdrop${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <TopBar
        onToggleSidebar={() => {
          // On small screens, open/close drawer; on large, hide/show
          if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) {
            setSidebarOpen(v => !v);
          } else {
            setSidebarHidden(v => !v);
          }
        }}
        sidebarHidden={sidebarHidden}
      />
      <LoadingBar />
      <main className="content" ref={contentRef}>
        <div className="container fade-in">
          <Outlet />
        </div>
        <div className="app-footer">
          <div className="container">
            <span>{cfg.footerText || ''}</span>
            <span style={{ float: 'right' }}><a className="nav-item" href="/docs" onClick={(e) => { e.preventDefault(); navigate('/docs'); }}>Docs</a></span>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
