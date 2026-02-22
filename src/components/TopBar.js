import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTabs, onTabsUpdate, closeTab } from '../state/tabs';
import { getCurrentUserName, setCurrentUserName } from '../state/ops';
import { apiLogout } from '../api';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState(getTabs());
  const [user, setUser] = useState(getCurrentUserName());
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const scrollerRef = useRef(null);
  const [showArrows, setShowArrows] = useState(false);
  const idleRef = useRef(null);
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
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setShowArrows(el.scrollWidth > el.clientWidth + 8);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    return () => ro.disconnect();
  }, [tabs]);
  
  const active = tabs.find(t => location.pathname.startsWith(t.to))?.label || 'smBank';
  const remove = (e, to) => {
    e.preventDefault();
    e.stopPropagation();
    const isActive = location.pathname.startsWith(to);
    closeTab(to);
    if (isActive) navigate('/dashboard');
  };
  const scrollBy = (dx) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dx, behavior: 'smooth' });
  };
  const logout = useCallback(async () => {
    try { await apiLogout(); } catch {}
    setCurrentUserName('');
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem('smbank_token'); } catch {}
    setUser(getCurrentUserName());
    setOpen(false);
    navigate('/login');
  }, [navigate]);
  useEffect(() => {
    const reset = () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => {
        logout();
      }, 5 * 60 * 1000);
    };
    reset();
    const handlers = ['mousemove'].map(evt => {
      const h = () => reset();
      window.addEventListener(evt, h);
      return [evt, h];
    });
    return () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      handlers.forEach(([evt, h]) => window.removeEventListener(evt, h));
    };
  }, [logout]);
  return (
    <div className="topbar">
      <div style={{ fontWeight: 700 }}>{active}</div>
      <div className="top-right">
        <div className="tabs-wrap">
          {showArrows && <button className="tabs-arrow" onClick={() => scrollBy(-180)}>‹</button>}
          <div className="top-tabs" ref={scrollerRef}>
            {tabs.map(t => (
              <div key={t.to} className={`tab${location.pathname.startsWith(t.to) ? ' active' : ''}`}>
                <NavLink to={t.to} style={{ textDecoration: 'none', color: 'inherit' }}>{t.label}</NavLink>
                <button className="tab-close" onClick={(e) => remove(e, t.to)}>×</button>
              </div>
            ))}
          </div>
          {showArrows && <button className="tabs-arrow" onClick={() => scrollBy(180)}>›</button>}
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
