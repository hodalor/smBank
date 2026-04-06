import { useEffect, useMemo, useState } from 'react';
import { getAppConfig, saveAppConfig, hasPermission, PERMISSIONS } from '../state/ops';
import { fetchConfig, updateConfig, runMonthlyFeeDeduction, previewMonthlyFeeDeduction } from '../api';
import { showSuccess, showError } from '../components/Toaster';
import { IconSave, IconRotateCcw, IconTrash, IconPlus } from '../components/Icons';

function normalizeMonthlyFees(raw, accountTypes = []) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const seen = new Set();
  const rules = [];
  for (const r of (Array.isArray(src.rules) ? src.rules : [])) {
    const code = String((r && r.accountTypeCode) || '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rules.push({
      accountTypeCode: code,
      enabled: !!(r && r.enabled),
      amount: Number((r && r.amount) || 0),
      creditAccountNumber: String((r && r.creditAccountNumber) || '').trim(),
    });
  }
  for (const a of (Array.isArray(accountTypes) ? accountTypes : [])) {
    const code = String((a && a.code) || '').trim();
    if (!code || seen.has(code)) continue;
    rules.push({ accountTypeCode: code, enabled: false, amount: 0, creditAccountNumber: '' });
  }
  return {
    enabled: !!src.enabled,
    deductionDay: Math.min(31, Math.max(1, Number(src.deductionDay || 30))),
    eligibleStatuses: Array.from(new Set((Array.isArray(src.eligibleStatuses) ? src.eligibleStatuses : ['Active']).map(x => String(x || '').trim()).filter(Boolean))),
    allowNegativeBalance: !!src.allowNegativeBalance,
    smsAlert: src.smsAlert !== false,
    emailAlert: !!src.emailAlert,
    smsTemplate: String(src.smsTemplate || 'Dear customer, {appName} deducted {currency}{amount} monthly account fee from account {accountNumber}. New balance: {currency}{balance}. Date: {date}.'),
    emailSubject: String(src.emailSubject || '{appName} Monthly Account Fee Notice'),
    emailTemplate: String(src.emailTemplate || 'Hello,\n\nThis is to confirm that {appName} deducted {currency}{amount} as monthly account fee from account {accountNumber} on {date}.\n\nNew balance: {currency}{balance}\nFee destination account: {creditAccount}\n\nThank you.'),
    lastRunDateKey: String(src.lastRunDateKey || ''),
    rules,
  };
}

export default function Config() {
  const allowed = hasPermission(PERMISSIONS.CONFIG_MANAGE);
  const [cfg, setCfg] = useState(getAppConfig());
  const [monthlyPreview, setMonthlyPreview] = useState(null);
  const accountTypes = useMemo(() => Array.isArray(cfg.accountTypes) ? cfg.accountTypes : [], [cfg.accountTypes]);
  useEffect(() => {
    fetchConfig().then(data => {
      const next = { ...data, monthlyAccountFees: normalizeMonthlyFees(data.monthlyAccountFees, data.accountTypes || []) };
      setCfg(next);
      saveAppConfig(next);
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
      const payload = { ...cfg, monthlyAccountFees: normalizeMonthlyFees(cfg.monthlyAccountFees, cfg.accountTypes || []) };
      const saved = await updateConfig(payload);
      const next = { ...saved, monthlyAccountFees: normalizeMonthlyFees(saved.monthlyAccountFees, saved.accountTypes || []) };
      setCfg(next);
      saveAppConfig(next);
      showSuccess('Configuration saved');
    } catch {
      saveAppConfig(cfg);
      showError('Failed to save configuration');
    }
  };
  const quickSave = async (next) => {
    const payload = { ...next, monthlyAccountFees: normalizeMonthlyFees(next.monthlyAccountFees, next.accountTypes || []) };
    setCfg(payload);
    try {
      const saved = await updateConfig(payload);
      const normalized = { ...saved, monthlyAccountFees: normalizeMonthlyFees(saved.monthlyAccountFees, saved.accountTypes || []) };
      setCfg(normalized);
      saveAppConfig(normalized);
      showSuccess('Saved');
    } catch (err) {
      showError(err?.message || 'Save failed');
    }
  };
  const setMonthly = (nextMonthly) => {
    setCfg(prev => ({ ...prev, monthlyAccountFees: normalizeMonthlyFees(nextMonthly, prev.accountTypes || []) }));
  };
  const reset = () => {
    const def = {
      appName: 'smBank',
      footerText: '© smBank',
      primary: '#0f172a',
      primaryContrast: '#ffffff',
      darkMode: false,
      defaultLoanRate: 0,
      serviceFeeRate: 0,
      adminFeeRate: 0,
      commitmentFeeRate: 0,
      withdrawalFeeRate: 0,
      loanOverdueGraceDays: 0,
      loanOverdueDailyPenaltyRate: 0,
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
      monthlyAccountFees: normalizeMonthlyFees({}, [
        { code: '10' },
        { code: '13' },
        { code: '16' },
        { code: '19' },
        { code: '22' },
        { code: '60' },
      ]),
    };
    setCfg(def);
    saveAppConfig(def);
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  const mf = normalizeMonthlyFees(cfg.monthlyAccountFees, cfg.accountTypes || []);
  const statusOptions = ['Active', 'Inactive', 'Dormant', 'NDS'];
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
            Service Fee (% of principal)
            <input className="input" type="number" step="0.01" min="0" name="serviceFeeRate" value={cfg.serviceFeeRate ?? 0} onChange={change} />
          </label>
          <label>
            Administration Fee (% of principal)
            <input className="input" type="number" step="0.01" min="0" name="adminFeeRate" value={cfg.adminFeeRate ?? 0} onChange={change} />
          </label>
          <label>
            Commitment Fee (% of principal)
            <input className="input" type="number" step="0.01" min="0" name="commitmentFeeRate" value={cfg.commitmentFeeRate ?? 0} onChange={change} />
          </label>
          <label>
            Withdrawal Fee (% of amount)
            <input className="input" type="number" step="0.01" min="0" name="withdrawalFeeRate" value={cfg.withdrawalFeeRate ?? 0} onChange={change} />
          </label>
          <label>
            Loan Overdue Grace Days
            <input className="input" type="number" step="1" min="0" name="loanOverdueGraceDays" value={cfg.loanOverdueGraceDays ?? 0} onChange={change} />
          </label>
          <label>
            Loan Overdue Penalty (% per day)
            <input className="input" type="number" step="0.01" min="0" name="loanOverdueDailyPenaltyRate" value={cfg.loanOverdueDailyPenaltyRate ?? 0} onChange={change} />
          </label>
          <label>
            Bank Code (2 digits)
            <input
              className="input"
              name="bankCode"
              value={cfg.bankCode || ''}
              onChange={(e) => {
                const v = (e.target.value || '').replace(/\D/g, '').slice(0, 2);
                setCfg({ ...cfg, bankCode: v });
              }}
              placeholder="e.g. 07"
              pattern="^[0-9]{2}$"
              title="Two digits"
              maxLength={2}
              inputMode="numeric"
            />
          </label>
          <label style={{ alignSelf: 'end' }}>
            <input type="checkbox" name="darkMode" checked={!!cfg.darkMode} onChange={change} /> Dark Mode
          </label>
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit"><IconSave /><span>Save</span></button>
          <button className="btn" type="button" onClick={reset}><IconRotateCcw /><span>Reset</span></button>
        </div>
      </form>
      <div className="card">
        <h3>Branches</h3>
        {(cfg.branches || []).map((b, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input className="input" style={{ width: 100 }} placeholder="Code" value={b.code} pattern="\\d{3}" title="Three digits" maxLength={3} onChange={(e) => {
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
            }}><IconTrash /><span>Remove</span></button>
          </div>
        ))}
        <button className="btn" onClick={() => setCfg({ ...cfg, branches: [ ...(cfg.branches || []), { code: '', name: '', active: true } ] })}><IconPlus /><span>Add Branch</span></button>
      </div>
      <div className="card">
        <h3>SMS Sender IDs</h3>
        {(cfg.smsSenderIds || []).map((s, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="defaultSmsSenderId"
              checked={(cfg.defaultSmsSenderId || '') === s}
              onChange={() => quickSave({ ...cfg, defaultSmsSenderId: s })}
              title="Default"
            />
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Sender ID"
              value={s}
              onChange={(e) => {
                const arr = [...(cfg.smsSenderIds || [])];
                arr[i] = e.target.value;
                setCfg({ ...cfg, smsSenderIds: arr });
              }}
              onBlur={() => quickSave({ ...cfg })}
            />
            <button className="btn" onClick={() => {
              const arr = (cfg.smsSenderIds || []).filter((_, idx) => idx !== i);
              let nextDefault = cfg.defaultSmsSenderId;
              if (s === nextDefault) nextDefault = arr[0] || '';
              quickSave({ ...cfg, smsSenderIds: arr, defaultSmsSenderId: nextDefault });
            }}><IconTrash /><span>Remove</span></button>
          </div>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setCfg({ ...cfg, smsSenderIds: [ ...(cfg.smsSenderIds || []), '' ] })}><IconPlus /><span>Add Sender ID</span></button>
          <button className="btn" onClick={() => quickSave({ ...cfg })}><IconSave /><span>Save</span></button>
        </div>
      </div>
      <div className="card">
        <h3>Email From Addresses</h3>
        {(cfg.emailFromAddresses || []).map((s, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="defaultEmailFrom"
              checked={(cfg.defaultEmailFrom || '') === s}
              onChange={() => quickSave({ ...cfg, defaultEmailFrom: s })}
              title="Default"
            />
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="From (e.g. Company <no-reply@company.com>)"
              value={s}
              onChange={(e) => {
                const arr = [...(cfg.emailFromAddresses || [])];
                arr[i] = e.target.value;
                setCfg({ ...cfg, emailFromAddresses: arr });
              }}
              onBlur={() => quickSave({ ...cfg })}
            />
            <button className="btn" onClick={() => {
              const arr = (cfg.emailFromAddresses || []).filter((_, idx) => idx !== i);
              let nextDefault = cfg.defaultEmailFrom;
              if (s === nextDefault) nextDefault = arr[0] || '';
              quickSave({ ...cfg, emailFromAddresses: arr, defaultEmailFrom: nextDefault });
            }}><IconTrash /><span>Remove</span></button>
          </div>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setCfg({ ...cfg, emailFromAddresses: [ ...(cfg.emailFromAddresses || []), '' ] })}><IconPlus /><span>Add From</span></button>
          <button className="btn" onClick={() => quickSave({ ...cfg })}><IconSave /><span>Save</span></button>
        </div>
      </div>
      <div className="card">
        <h3>Account Types</h3>
        {(cfg.accountTypes || []).map((a, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input className="input" style={{ width: 100 }} placeholder="Code" value={a.code} pattern="\\d{2}" title="Two digits" maxLength={2} onChange={(e) => {
              const arr = [...(cfg.accountTypes || [])]; arr[i] = { ...arr[i], code: e.target.value };
              setCfg({ ...cfg, accountTypes: arr, monthlyAccountFees: normalizeMonthlyFees(cfg.monthlyAccountFees, arr) });
            }} />
            <input className="input" style={{ flex: 1 }} placeholder="Name" value={a.name} onChange={(e) => {
              const arr = [...(cfg.accountTypes || [])]; arr[i] = { ...arr[i], name: e.target.value };
              setCfg({ ...cfg, accountTypes: arr });
            }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={a.supportsIndividual !== false} onChange={(e) => {
                const arr = [...(cfg.accountTypes || [])];
                arr[i] = { ...arr[i], supportsIndividual: e.target.checked };
                quickSave({ ...cfg, accountTypes: arr });
              }} />
              Individual form
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={a.active !== false} onChange={(e) => {
                const arr = [...(cfg.accountTypes || [])];
                arr[i] = { ...arr[i], active: e.target.checked };
                quickSave({ ...cfg, accountTypes: arr });
              }} />
              Active
            </label>
            <button className="btn" onClick={() => {
              const arr = (cfg.accountTypes || []).filter((_, idx) => idx !== i);
              setCfg({ ...cfg, accountTypes: arr, monthlyAccountFees: normalizeMonthlyFees(cfg.monthlyAccountFees, arr) });
            }}><IconTrash /><span>Remove</span></button>
          </div>
        ))}
        <button className="btn" onClick={() => {
          const arr = [ ...(cfg.accountTypes || []), { code: '', name: '', supportsIndividual: true, active: true } ];
          setCfg({ ...cfg, accountTypes: arr, monthlyAccountFees: normalizeMonthlyFees(cfg.monthlyAccountFees, arr) });
        }}><IconPlus /><span>Add Account Type</span></button>
      </div>
      <div className="card">
        <h3>Monthly Account Fee</h3>
        <div className="form-grid">
          <label style={{ alignSelf: 'end' }}>
            <input
              type="checkbox"
              checked={!!mf.enabled}
              onChange={(e) => setMonthly({ ...mf, enabled: e.target.checked })}
            /> Enable monthly account fee
          </label>
          <label>
            Deduction Day (UTC day of month)
            <input
              className="input"
              type="number"
              min="1"
              max="31"
              value={mf.deductionDay}
              onChange={(e) => setMonthly({ ...mf, deductionDay: e.target.value })}
            />
          </label>
          <label style={{ alignSelf: 'end' }}>
            <input
              type="checkbox"
              checked={!!mf.allowNegativeBalance}
              onChange={(e) => setMonthly({ ...mf, allowNegativeBalance: e.target.checked })}
            /> Continue deduction even when balance is insufficient (allow negative)
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Eligible Account Statuses
            <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {statusOptions.map((s) => {
                const set = new Set(mf.eligibleStatuses || []);
                const checked = set.has(s);
                return (
                  <label key={`mfs-${s}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(mf.eligibleStatuses || []);
                        if (e.target.checked) next.add(s);
                        else next.delete(s);
                        setMonthly({ ...mf, eligibleStatuses: Array.from(next) });
                      }}
                    />
                    {s}
                  </label>
                );
              })}
            </div>
          </label>
          <label style={{ alignSelf: 'end' }}>
            <input
              type="checkbox"
              checked={!!mf.smsAlert}
              onChange={(e) => setMonthly({ ...mf, smsAlert: e.target.checked })}
            /> SMS alert to client
          </label>
          <label style={{ alignSelf: 'end' }}>
            <input
              type="checkbox"
              checked={!!mf.emailAlert}
              onChange={(e) => setMonthly({ ...mf, emailAlert: e.target.checked })}
            /> Email alert to client
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            SMS Template
            <input
              className="input"
              value={mf.smsTemplate}
              onChange={(e) => setMonthly({ ...mf, smsTemplate: e.target.value })}
              placeholder="Use {appName} {accountNumber} {amount} {balance} {date} {month} {creditAccount} {currency}"
            />
          </label>
          <label>
            Email Subject Template
            <input
              className="input"
              value={mf.emailSubject}
              onChange={(e) => setMonthly({ ...mf, emailSubject: e.target.value })}
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Email Body Template
            <textarea
              className="input"
              rows={5}
              value={mf.emailTemplate}
              onChange={(e) => setMonthly({ ...mf, emailTemplate: e.target.value })}
            />
          </label>
        </div>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <button className="btn" onClick={() => {
            const generated = normalizeMonthlyFees({
              ...mf,
              rules: (accountTypes || []).map(a => {
                const code = String(a.code || '').trim();
                const exist = (mf.rules || []).find(r => String(r.accountTypeCode || '').trim() === code);
                return exist || { accountTypeCode: code, enabled: false, amount: 0, creditAccountNumber: '' };
              }),
            }, accountTypes);
            setMonthly(generated);
          }}><IconRotateCcw /><span>Generate Rules</span></button>
          <button className="btn btn-primary" onClick={() => quickSave({ ...cfg, monthlyAccountFees: mf })}><IconSave /><span>Save Monthly Fee Settings</span></button>
          <button className="btn" onClick={async () => {
            try {
              await quickSave({ ...cfg, monthlyAccountFees: mf });
              const p = await previewMonthlyFeeDeduction(true);
              setMonthlyPreview(p);
              showSuccess(`Preview ready: ${p.deducted || 0} can be deducted, ${p.skipped || 0} will be skipped`);
            } catch (e) {
              showError(e?.message || 'Preview failed');
            }
          }}><IconRotateCcw /><span>Preview Impact</span></button>
          <button className="btn" onClick={async () => {
            try {
              const r = await runMonthlyFeeDeduction(true);
              showSuccess(`Monthly fee run: deducted ${r.deducted || 0}, credited ${r.credited || 0}, skipped ${r.skipped || 0}`);
              setMonthlyPreview(null);
              const refreshed = await fetchConfig();
              const next = { ...refreshed, monthlyAccountFees: normalizeMonthlyFees(refreshed.monthlyAccountFees, refreshed.accountTypes || []) };
              setCfg(next);
              saveAppConfig(next);
            } catch (e) {
              showError(e?.message || 'Monthly fee run failed');
            }
          }}><IconSave /><span>Run Deduction Now</span></button>
        </div>
        {monthlyPreview && (
          <div className="card" style={{ marginBottom: 10 }}>
            <h4 style={{ marginTop: 0 }}>Preview Impact</h4>
            <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
              <div><strong>Month:</strong> {monthlyPreview.month}</div>
              <div><strong>Attempted:</strong> {monthlyPreview.attempted || 0}</div>
              <div><strong>Will Deduct:</strong> {monthlyPreview.deducted || 0}</div>
              <div><strong>Will Credit:</strong> {monthlyPreview.credited || 0}</div>
              <div><strong>Will Skip:</strong> {monthlyPreview.skipped || 0}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>Skip Reasons</strong>
              <table className="table" style={{ marginTop: 8 }}>
                <thead>
                  <tr><th>Reason</th><th>Count</th></tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyPreview.reasons || {}).map(([k, v]) => (
                    <tr key={`p-${k}`}><td>{k}</td><td>{v}</td></tr>
                  ))}
                  {!Object.keys(monthlyPreview.reasons || {}).length && (
                    <tr><td colSpan="2">No skipped accounts in preview.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>Account Type</th>
              <th>Enabled</th>
              <th>Fee Amount (fixed)</th>
              <th>Credit Account Number</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(mf.rules || []).map((r, i) => (
              <tr key={`mfr-${i}`}>
                <td>
                  <select className="input" value={r.accountTypeCode || ''} onChange={(e) => {
                    const arr = [...(mf.rules || [])];
                    arr[i] = { ...arr[i], accountTypeCode: e.target.value };
                    setMonthly({ ...mf, rules: arr });
                  }}>
                    <option value="">Select type</option>
                    {(accountTypes || []).map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={!!r.enabled} onChange={(e) => {
                    const arr = [...(mf.rules || [])];
                    arr[i] = { ...arr[i], enabled: e.target.checked };
                    setMonthly({ ...mf, rules: arr });
                  }} />
                </td>
                <td>
                  <input className="input" type="number" min="0" step="0.01" value={Number(r.amount || 0)} onChange={(e) => {
                    const arr = [...(mf.rules || [])];
                    arr[i] = { ...arr[i], amount: e.target.value };
                    setMonthly({ ...mf, rules: arr });
                  }} />
                </td>
                <td>
                  <input className="input" value={r.creditAccountNumber || ''} onChange={(e) => {
                    const arr = [...(mf.rules || [])];
                    arr[i] = { ...arr[i], creditAccountNumber: e.target.value };
                    setMonthly({ ...mf, rules: arr });
                  }} placeholder="Account that receives fees" />
                </td>
                <td>
                  <button className="btn" onClick={() => {
                    const arr = (mf.rules || []).filter((_, idx) => idx !== i);
                    setMonthly({ ...mf, rules: arr });
                  }}><IconTrash /><span>Remove</span></button>
                </td>
              </tr>
            ))}
            {!(mf.rules || []).length && (
              <tr><td colSpan="5">No rules yet. Click Generate Rules or Add Rule.</td></tr>
            )}
          </tbody>
        </table>
        <div className="row">
          <button className="btn" onClick={() => setMonthly({ ...mf, rules: [ ...(mf.rules || []), { accountTypeCode: '', enabled: false, amount: 0, creditAccountNumber: '' } ] })}><IconPlus /><span>Add Rule</span></button>
        </div>
        <div style={{ color: '#64748b', fontSize: 12 }}>
          {mf.allowNegativeBalance ? 'Negative balance mode is ON: monthly fees continue even when account has no funds.' : 'Negative balance mode is OFF: monthly fees are skipped when balance is not enough.'}
        </div>
        <div style={{ color: '#64748b', fontSize: 12 }}>
          Last auto/manual run date key: {mf.lastRunDateKey || 'not run yet'}
        </div>
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
