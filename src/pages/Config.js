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
    const def = {
      appName: 'smBank',
      footerText: '© smBank',
      primary: '#0f172a',
      primaryContrast: '#ffffff',
      darkMode: false,
      defaultLoanRate: 0,
      bankCode: '07',
      branches: [{ code: '001', name: 'Head office', active: true }],
      accountTypes: [
        { code: '10', name: 'Savings Account', supportsIndividual: true, active: true },
        { code: '13', name: 'Susu Account', supportsIndividual: true, active: true },
        { code: '16', name: 'Current Account', supportsIndividual: true, active: true },
        { code: '19', name: 'Fix Deposit', supportsIndividual: true, active: true },
        { code: '22', name: 'Mmofra Daakye Account', supportsIndividual: true, active: true },
        { code: '60', name: 'Business Account', supportsIndividual: false, active: true },
      ],
    };
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
          <label>
            Default Loan Rate (% per annum)
            <input className="input" type="number" step="0.01" min="0" name="defaultLoanRate" value={cfg.defaultLoanRate ?? 0} onChange={change} />
          </label>
          <label>
            Bank Code (2 digits)
            <input className="input" name="bankCode" value={cfg.bankCode || ''} onChange={change} placeholder="e.g. 07" />
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
        <h3>Branches</h3>
        {(cfg.branches || []).map((b, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input className="input" style={{ width: 100 }} placeholder="Code" value={b.code} onChange={(e) => {
              const arr = [...(cfg.branches || [])]; arr[i] = { ...arr[i], code: e.target.value }; setCfg({ ...cfg, branches: arr });
            }} />
            <input className="input" style={{ flex: 1 }} placeholder="Name" value={b.name} onChange={(e) => {
              const arr = [...(cfg.branches || [])]; arr[i] = { ...arr[i], name: e.target.value }; setCfg({ ...cfg, branches: arr });
            }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={b.active !== false} onChange={(e) => {
                const arr = [...(cfg.branches || [])]; arr[i] = { ...arr[i], active: e.target.checked }; setCfg({ ...cfg, branches: arr });
              }} />
              Active
            </label>
            <button className="btn" onClick={() => {
              const arr = (cfg.branches || []).filter((_, idx) => idx !== i); setCfg({ ...cfg, branches: arr });
            }}>Remove</button>
          </div>
        ))}
        <button className="btn" onClick={() => setCfg({ ...cfg, branches: [ ...(cfg.branches || []), { code: '', name: '', active: true } ] })}>Add Branch</button>
      </div>
      <div className="card">
        <h3>Account Types</h3>
        {(cfg.accountTypes || []).map((a, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input className="input" style={{ width: 100 }} placeholder="Code" value={a.code} onChange={(e) => {
              const arr = [...(cfg.accountTypes || [])]; arr[i] = { ...arr[i], code: e.target.value }; setCfg({ ...cfg, accountTypes: arr });
            }} />
            <input className="input" style={{ flex: 1 }} placeholder="Name" value={a.name} onChange={(e) => {
              const arr = [...(cfg.accountTypes || [])]; arr[i] = { ...arr[i], name: e.target.value }; setCfg({ ...cfg, accountTypes: arr });
            }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={a.supportsIndividual !== false} onChange={(e) => {
                const arr = [...(cfg.accountTypes || [])]; arr[i] = { ...arr[i], supportsIndividual: e.target.checked }; setCfg({ ...cfg, accountTypes: arr });
              }} />
              Individual form
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={a.active !== false} onChange={(e) => {
                const arr = [...(cfg.accountTypes || [])]; arr[i] = { ...arr[i], active: e.target.checked }; setCfg({ ...cfg, accountTypes: arr });
              }} />
              Active
            </label>
            <button className="btn" onClick={() => {
              const arr = (cfg.accountTypes || []).filter((_, idx) => idx !== i); setCfg({ ...cfg, accountTypes: arr });
            }}>Remove</button>
          </div>
        ))}
        <button className="btn" onClick={() => setCfg({ ...cfg, accountTypes: [ ...(cfg.accountTypes || []), { code: '', name: '', supportsIndividual: true, active: true } ] })}>Add Account Type</button>
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary)', border: '1px solid var(--border)' }} />
          <div>Preview uses current primary color and theme.</div>
        </div>
      </div>
    </div>
  );
}
