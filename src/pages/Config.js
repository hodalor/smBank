import { useEffect, useState } from 'react';
import { getAppConfig, saveAppConfig, hasPermission } from '../state/ops';
import { fetchConfig, updateConfig } from '../api';

export default function Config() {
  const allowed = hasPermission('config.manage');
  const [cfg, setCfg] = useState(getAppConfig());
  useEffect(() => {
    fetchConfig().then(data => {
      setCfg(data);
      saveAppConfig(data);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--primary', cfg.primary);
    document.documentElement.style.setProperty('--primary-contrast', cfg.primaryContrast || '#ffffff');
    document.documentElement.setAttribute('data-theme', cfg.darkMode ? 'dark' : 'light');
  }, [cfg]);
  const change = (e) => setCfg({ ...cfg, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      const saved = await updateConfig(cfg);
      setCfg(saved);
      saveAppConfig(saved);
    } catch {
      saveAppConfig(cfg);
    }
  };
  const reset = () => {
    const def = { appName: 'smBank', footerText: '© smBank', primary: '#0f172a', primaryContrast: '#ffffff', darkMode: false };
    setCfg(def);
    saveAppConfig(def);
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Config</h1>
      <form className="form card" onSubmit={save}>
        <div className="form-grid">
          <label>
            App Display Name
            <input className="input" name="appName" value={cfg.appName} onChange={change} />
          </label>
          <label>
            Footer Text
            <input className="input" name="footerText" value={cfg.footerText} onChange={change} />
          </label>
          <label>
            Primary Color
            <input className="input" type="color" name="primary" value={cfg.primary} onChange={change} />
          </label>
          <label>
            Primary Contrast
            <input className="input" type="color" name="primaryContrast" value={cfg.primaryContrast || '#ffffff'} onChange={change} />
          </label>
          <label style={{ alignSelf: 'end' }}>
            <input type="checkbox" name="darkMode" checked={!!cfg.darkMode} onChange={change} /> Dark Mode
          </label>
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit">Save</button>
          <button className="btn" type="button" onClick={reset}>Reset</button>
        </div>
      </form>
      <div className="card">
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary)', border: '1px solid var(--border)' }} />
          <div>Preview uses current primary color and theme.</div>
        </div>
      </div>
    </div>
  );
}
