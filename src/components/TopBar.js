import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getTabs, onTabsUpdate, closeTab } from '../state/tabs';
import { getCurrentUserName, setCurrentUserName } from '../state/ops';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState(getTabs());
  const [user, setUser] = useState(getCurrentUserName());
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => onTabsUpdate(setTabs), []);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'smbank_current_user') setUser(getCurrentUserName());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    const handle = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, []);
  const active = tabs.find(t => location.pathname.startsWith(t.to))?.label || 'smBank';
  const remove = (e, to) => {
    e.preventDefault();
    e.stopPropagation();
    const isActive = location.pathname.startsWith(to);
    closeTab(to);
    if (isActive) navigate('/dashboard');
  };
  const logout = () => {
    setCurrentUserName('');
    setUser(getCurrentUserName());
    setOpen(false);
    navigate('/login');
  };
  return (
    <div className="topbar">
      <div style={{ fontWeight: 700 }}>{active}</div>
      <div className="top-right">
        <div className="top-tabs">
          {tabs.map(t => (
            <div key={t.to} className={`tab${location.pathname.startsWith(t.to) ? ' active' : ''}`}>
              <NavLink to={t.to} style={{ textDecoration: 'none', color: 'inherit' }}>{t.label}</NavLink>
              <button className="tab-close" onClick={(e) => remove(e, t.to)}>×</button>
            </div>
          ))}
        </div>
        <div className="user" ref={menuRef}>
          <button className="user-btn" onClick={() => setOpen(v => !v)}>
            <span className="user-avatar">{(user || 'A').charAt(0).toUpperCase()}</span>
            <span>{user || 'Admin'}</span>
            <span className="user-caret">▾</span>
          </button>
          {open && (
            <div className="user-menu">
              <button className="user-menu-item" onClick={logout}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
