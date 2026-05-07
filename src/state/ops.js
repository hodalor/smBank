const PENDING_KEY = 'smbank_pending_txn';
const POSTED_KEY = 'smbank_posted_txn';
const USER_KEY = 'smbank_current_user';
const USERS_KEY = 'smbank_users';
const BIN_KEY = 'smbank_super_bin';
const bus = new EventTarget();

const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  LOAN_MANAGER: 'Loan Manager',
  LOAN_OFFICER: 'Loan Officer',
  ACCOUNT_MANAGER: 'Account Manager',
  TELLER: 'Teller',
  CUSTOMER_SERVICE: 'Customer Service',
};

const PERMS = {
  DASHBOARD_VIEW: 'dashboard.view',
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_DELETE: 'clients.delete',
  LOANS_CREATE: 'loans.create',
  DEPOSIT_CREATE: 'deposit.create',
  WITHDRAW_CREATE: 'withdraw.create',
  TXN_APPROVALS_VIEW: 'txn.approvals.view',
  STATEMENTS_VIEW: 'statements.view',
  LOANS_VIEW: 'loans.view',
  LOANS_APPROVALS_VIEW: 'loans.approvals.view',
  LOANS_RECORDS_VIEW: 'loans.records.view',
  LOANS_REPAYMENTS_VIEW: 'loans.repayments.view',
  LOANS_REPAY_CREATE: 'loans.repay.create',
  LOANS_REPAY_APPROVALS_VIEW: 'loans.repay.approvals.view',
  REPORTS_VIEW: 'reports.view',
  USERS_MANAGE: 'users.manage',
  SUPERBIN_VIEW: 'superbin.view',
  CONFIG_MANAGE: 'config.manage',
  ACTIVITY_VIEW: 'activity.view',
  SERVERLOGS_VIEW: 'serverlogs.view',
  MEDIA_UPLOAD: 'media.upload',
  TXN_RECORDS_VIEW: 'txn.records.view',
  CLIENT_MANAGER_MANAGE: 'clients.manager.manage',
  ASSETS_VIEW: 'assets.view',
  ASSETS_MANAGE: 'assets.manage',
  NOTIFY_SEND: 'notify.send',
};

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMS),
  [ROLES.ADMIN]: Object.values(PERMS).filter(p => p !== PERMS.SUPERBIN_VIEW && p !== PERMS.SERVERLOGS_VIEW),
  [ROLES.LOAN_MANAGER]: [
    PERMS.DASHBOARD_VIEW,
    PERMS.LOANS_VIEW,
    PERMS.LOANS_CREATE,
    PERMS.LOANS_APPROVALS_VIEW,
    PERMS.LOANS_RECORDS_VIEW,
    PERMS.LOANS_REPAYMENTS_VIEW,
    PERMS.LOANS_REPAY_CREATE,
    PERMS.LOANS_REPAY_APPROVALS_VIEW,
    PERMS.REPORTS_VIEW,
  ],
  [ROLES.LOAN_OFFICER]: [
    PERMS.DASHBOARD_VIEW,
    PERMS.LOANS_VIEW,
    // intentionally no loans.create by default
    PERMS.LOANS_RECORDS_VIEW,
    PERMS.LOANS_REPAYMENTS_VIEW,
    PERMS.LOANS_REPAY_CREATE,
  ],
  [ROLES.ACCOUNT_MANAGER]: [
    PERMS.DASHBOARD_VIEW,
    PERMS.CLIENTS_VIEW,
    PERMS.CLIENTS_CREATE,
    PERMS.DEPOSIT_CREATE,
    PERMS.WITHDRAW_CREATE,
    PERMS.TXN_APPROVALS_VIEW,
    PERMS.STATEMENTS_VIEW,
    PERMS.TXN_RECORDS_VIEW,
    PERMS.CLIENT_MANAGER_MANAGE,
    PERMS.ASSETS_VIEW,
    PERMS.REPORTS_VIEW,
  ],
  [ROLES.TELLER]: [
    PERMS.CLIENTS_VIEW,
    PERMS.DEPOSIT_CREATE,
    PERMS.WITHDRAW_CREATE,
    PERMS.TXN_RECORDS_VIEW,
    PERMS.ASSETS_VIEW,
  ],
  [ROLES.CUSTOMER_SERVICE]: [
    PERMS.CLIENTS_VIEW,
    PERMS.STATEMENTS_VIEW,
    PERMS.ASSETS_VIEW,
  ],
};

export function getRoles() {
  return { ...ROLES };
}
export function getAllPermissions() {
  return Object.values(PERMS);
}

function seedUsersIfEmpty() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      const seed = [
        { username: 'super', role: ROLES.SUPER_ADMIN, permsAdd: [], permsRemove: [] },
        { username: 'admin', role: ROLES.ADMIN, permsAdd: [], permsRemove: [] },
      ];
      localStorage.setItem(USERS_KEY, JSON.stringify(seed));
    }
  } catch {}
}
seedUsersIfEmpty();

export function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function setUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}
export function saveUser(user) {
  const list = getUsers();
  const idx = list.findIndex(u => u.username === user.username);
  if (idx >= 0) list[idx] = user;
  else list.push(user);
  setUsers(list);
  return user;
}
export function deleteUser(username) {
  const list = getUsers();
  const user = list.find(u => u.username === username);
  const remaining = list.filter(u => u.username !== username);
  setUsers(remaining);
  if (user) addToSuperBin({ kind: 'user', payload: user });
}

export function getUserByUsername(username) {
  const list = getUsers();
  return list.find(u => u.username === username) || null;
}

export function getEffectivePermissions(user) {
  const base = new Set(ROLE_PERMISSIONS[user.role] || []);
  (user.permsAdd || []).forEach(p => base.add(p));
  (user.permsRemove || []).forEach(p => base.delete(p));
  // Enforce: only Admin and Super Admin can manage Config regardless of overrides
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN) {
    base.delete(PERMS.CONFIG_MANAGE);
  }
  // Enforce: only Super Admin can view Super Bin regardless of overrides
  if (user.role !== ROLES.SUPER_ADMIN) {
    base.delete(PERMS.SUPERBIN_VIEW);
    base.delete(PERMS.SERVERLOGS_VIEW);
  }
  // Enforce: only Admin and Super Admin can manage Users regardless of overrides
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN) {
    base.delete(PERMS.USERS_MANAGE);
  }
  return base;
}

export function getCurrentUser() {
  const username = getCurrentUserName();
  if (!username) return { username: '', role: 'Anonymous', permsAdd: [], permsRemove: [] };
  const user = getUserByUsername(username);
  if (user) return user;
  return { username, role: 'Anonymous', permsAdd: [], permsRemove: [] };
}
export function hasPermission(perm) {
  const user = getCurrentUser();
  const set = getEffectivePermissions(user);
  return set.has(perm);
}

export function getPendingTxns() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getPostedTxns() {
  try {
    const raw = localStorage.getItem(POSTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setPendingTxns(list) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  bus.dispatchEvent(new Event('pending_update'));
}
function setPostedTxns(list) {
  localStorage.setItem(POSTED_KEY, JSON.stringify(list));
  bus.dispatchEvent(new Event('posted_update'));
}

export function addPendingTxn(txn) {
  const withId = {
    id: txn.id || `P-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    status: 'Pending',
    initiatorName: getCurrentUserName(),
    initiatedAt: txn.initiatedAt || new Date().toISOString(),
    ...txn,
  };
  const list = getPendingTxns();
  setPendingTxns([withId, ...list]);
  return withId;
}

export function approvePendingTxn(id) {
  const list = getPendingTxns();
  const txn = list.find(t => t.id === id);
  if (!txn) return null;
  const remaining = list.filter(t => t.id !== id);
  setPendingTxns(remaining);
  const posted = getPostedTxns();
  const toPost = {
    ...txn,
    approvedAt: new Date().toISOString(),
    approverName: getCurrentUserName(),
    status: 'Approved',
  };
  setPostedTxns([toPost, ...posted]);
  return toPost;
}

export function rejectPendingTxn(id, reason = '') {
  const list = getPendingTxns();
  const txn = list.find(t => t.id === id);
  const remaining = list.filter(t => t.id !== id);
  setPendingTxns(remaining);
  if (txn) {
    addToSuperBin({ kind: 'pending_txn', payload: { ...txn, reason } });
  }
}

export function onPendingUpdate(cb) {
  const handler = () => cb(getPendingTxns());
  bus.addEventListener('pending_update', handler);
  return () => bus.removeEventListener('pending_update', handler);
}

export function onPostedUpdate(cb) {
  const handler = () => cb(getPostedTxns());
  bus.addEventListener('posted_update', handler);
  return () => bus.removeEventListener('posted_update', handler);
}

// Mocked basic account directory
const directory = {
  '4839201746': { name: 'Jane Doe', nationalId: 'NID12345', dob: '1993-05-12', phone: '0712345678' },
  '7392046158': { name: 'John Smith', nationalId: 'NID98765', dob: '1990-09-02', phone: '0798765432' }
};

export function lookupAccountBasic(accountNumber) {
  const d = directory[accountNumber];
  return d ? { accountNumber, ...d } : null;
}

export function searchAccounts(term) {
  if (!term) return [];
  const q = term.toLowerCase();
  const entries = Object.entries(directory).map(([acct, info]) => ({ accountNumber: acct, ...info }));
  return entries.filter(e =>
    e.accountNumber.includes(q) ||
    e.name.toLowerCase().includes(q) ||
    e.nationalId.toLowerCase().includes(q)
  );
}

export function findAccount(term) {
  const results = searchAccounts(term);
  return results.length ? results[0] : null;
}

export function getCurrentUserName() {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v || '';
  } catch {
    return '';
  }
}
export function setCurrentUserName(name) {
  localStorage.setItem(USER_KEY, name || 'Admin');
}

export function displayUserName(name) {
  if (!name) return '';
  return name === 'api' ? 'System' : name;
}

function currencyGH(n) {
  const num = Number(n || 0);
  try { return num.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' }); } catch { return `GHS ${num.toFixed(2)}`; }
}

function safePrintHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openReceiptPrintWindow({ title, subtitle, badges = [], summaryCards = [], tables = [], htmlContent = '', footerNote = '' }) {
  const cfg = getAppConfig();
  const w = window.open('', '_blank', 'width=920,height=760');
  if (!w) return;
  const contactItems = [cfg.companyPhone || '', cfg.companyEmail || '', cfg.defaultEmailFrom || ''].filter(Boolean);
  const body = `
    <div class="sheet">
      <div class="brand">
        <div class="brand-left">
          <img src="/logo512.png" alt="${safePrintHtml(cfg.appName || 'smBank')}" class="logo" />
          <div>
            <div class="app-name">${safePrintHtml(cfg.appName || 'smBank')}</div>
            <div class="app-subtitle">${safePrintHtml(subtitle || 'Official receipt')}</div>
            ${contactItems.length ? `<div class="contact-line">${contactItems.map((item) => safePrintHtml(item)).join(' | ')}</div>` : ''}
          </div>
        </div>
        <div class="generated-at">Generated ${safePrintHtml(new Date().toLocaleString())}</div>
      </div>
      <div class="body">
        <div class="title">${safePrintHtml(title || 'Receipt')}</div>
        ${badges.length ? `<div class="badges">${badges.map((item) => `<span class="badge">${safePrintHtml(item)}</span>`).join('')}</div>` : ''}
        ${summaryCards.length ? `<div class="summary-grid">${summaryCards.map((item) => `<div class="summary-card"><div class="summary-label">${safePrintHtml(item.label || '')}</div><div class="summary-value">${safePrintHtml(item.value == null ? '' : item.value)}</div></div>`).join('')}</div>` : ''}
        ${tables.map((table) => `
          <div class="section">
            <div class="section-title">${safePrintHtml(table.title || '')}</div>
            <table>
              <thead><tr>${(table.columns || []).map((col) => `<th>${safePrintHtml(col.label || '')}</th>`).join('')}</tr></thead>
              <tbody>${(table.rows || []).map((row) => `<tr>${(table.columns || []).map((col) => `<td>${safePrintHtml(row && row[col.key] != null ? row[col.key] : '')}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>
        `).join('')}
        ${htmlContent || ''}
        <div class="footer">${safePrintHtml(footerNote || cfg.footerText || '© smBank')}</div>
      </div>
    </div>
  `;
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><base href="${safePrintHtml(window.location.origin)}/" /><title>${safePrintHtml(title || 'Receipt')}</title><style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    .sheet { background: #ffffff; border: 1px solid #dbe2ea; border-radius: 20px; overflow: hidden; }
    .brand { background: linear-gradient(135deg, ${safePrintHtml(cfg.primary || '#0f172a')}, #1d4ed8); color: ${safePrintHtml(cfg.primaryContrast || '#ffffff')}; padding: 20px 24px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .brand-left { display: flex; align-items: center; gap: 14px; }
    .logo { width: 58px; height: 58px; border-radius: 14px; background: rgba(255,255,255,0.14); padding: 6px; object-fit: contain; }
    .app-name { font-size: 26px; font-weight: 800; }
    .app-subtitle, .generated-at, .contact-line { font-size: 12px; opacity: 0.95; }
    .body { padding: 24px; display: grid; gap: 16px; }
    .title { font-size: 28px; font-weight: 800; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #eff6ff; color: #1d4ed8; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .summary-card { border: 1px solid #dbe2ea; border-radius: 14px; padding: 14px; background: linear-gradient(180deg, #ffffff, #f8fafc); }
    .summary-label { color: #64748b; font-size: 12px; margin-bottom: 6px; }
    .summary-value { font-size: 16px; font-weight: 800; }
    .section { display: grid; gap: 10px; }
    .section-title { font-size: 16px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; }
    th, td { border-bottom: 1px solid #dbe2ea; padding: 10px 12px; text-align: left; font-size: 13px; }
    th { background: #f1f5f9; }
    .footer { text-align: right; color: #64748b; font-size: 12px; }
    @media print { body { padding: 0; background: #fff; } .sheet { border: 0; border-radius: 0; } }
  </style></head><body>${body}<script>(function(){ var printed = false; function runPrint(){ if (printed) return; printed = true; setTimeout(function(){ try { window.focus(); window.print(); } catch (e) {} }, 250); } if (document.readyState === "complete") runPrint(); else window.addEventListener("load", runPrint, { once: true }); setTimeout(runPrint, 700); })();</script></body></html>`);
  w.document.close();
  try { w.focus(); } catch {}
}

export function printTxnReceipt(txn, { copies = 2 } = {}) {
  if (!txn) return;
  const title = txn.kind === 'deposit' ? 'Deposit Receipt' :
                txn.kind === 'withdraw' ? 'Withdrawal Receipt' :
                txn.kind === 'loan_disbursement' ? 'Loan Disbursement Receipt' :
                (txn.mode === 'writeoff' ? 'Loan Write‑Off Receipt' : txn.loanId ? 'Loan Repayment Receipt' : 'Transaction Receipt');
  const fileTitle = `${txn.accountNumber || 'receipt'} - ${title}`;
  const notes = txn.meta && txn.meta.notes ? String(txn.meta.notes) : '';
  const feeAmount = Number((txn.meta && txn.meta.feeAmount) || 0);
  const baseAmount = Number((txn.meta && txn.meta.baseAmount) || 0);
  const feeRate = Number((txn.meta && txn.meta.feeRate) || 0);
  const hasFees = txn.kind === 'withdraw' && feeAmount > 0;
  const rows = [
    ['Date', txn.approvedAt || txn.initiatedAt || new Date().toISOString()],
    ['Transaction ID', txn.id || '—'],
    ['Account', txn.accountNumber || '—'],
    ['Initiator', displayUserName(txn.initiatorName || '')],
    ['Approver', displayUserName(txn.approverName || '')],
    ...(txn.kind === 'loan_disbursement' ? [['Loan ID', txn.meta && txn.meta.loanId ? txn.meta.loanId : '—']] : []),
    ...(txn.loanId ? [['Loan ID', txn.loanId]] : []),
    ...(txn.mode ? [['Mode', String(txn.mode).toUpperCase()]] : []),
    ...(txn.kind === 'deposit' ? [['Amount', currencyGH(txn.amount)]] : []),
    ...(txn.kind === 'deposit'
        ? [
            ...(txn.meta?.depositorName ? [['Depositor Name', txn.meta.depositorName]] : []),
            ...(txn.meta?.depositorAddress ? [['Address', txn.meta.depositorAddress]] : []),
            ...(txn.meta?.incomeSource ? [['Income Source', txn.meta.incomeSource]] : []),
            ...(txn.meta?.method ? [['Method', String(txn.meta.method).toUpperCase()]] : []),
          ]
        : []),
    ...(txn.kind === 'withdraw'
        ? (hasFees
            ? [['Base Amount', currencyGH(baseAmount)], ['Fee', `${currencyGH(feeAmount)} (${feeRate}%)`], ['Total Deduct', currencyGH(txn.amount)]]
            : [['Amount', currencyGH(txn.amount)]])
        : []),
    ...(txn.kind !== 'deposit' && txn.kind !== 'withdraw' && txn.kind !== 'loan_disbursement' && txn.amount != null ? [['Amount', currencyGH(txn.amount)]] : []),
    ...(notes ? [['Notes', notes]] : []),
    ...(txn.kind === 'withdraw'
        ? [
            ...(txn.meta?.withdrawerIdNumber ? [['Withdrawer ID', txn.meta.withdrawerIdNumber]] : []),
            ...(txn.meta?.withdrawerPhone ? [['Withdrawer Phone', txn.meta.withdrawerPhone]] : []),
            ...(txn.meta?.withdrawerAddress ? [['Withdrawer Address', txn.meta.withdrawerAddress]] : []),
          ]
        : []),
  ];
  const tables = Array.from({ length: Math.max(1, copies) }).map((_, i) => ({
    title: i === 0 ? 'Customer Copy' : 'Records Copy',
    columns: [
      { key: 'label', label: 'Field' },
      { key: 'value', label: 'Value' },
    ],
    rows: rows.map(([label, value]) => ({ label, value })),
    emptyText: 'No receipt details',
  }));
  const signatures = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:10px;">
      <div style="text-align:center;"><div style="height:28px;"></div><div style="border-top:1px solid #0f172a;padding-top:6px;font-size:12px;color:#64748b;">Customer Signature</div></div>
      <div style="text-align:center;"><div style="height:28px;"></div><div style="border-top:1px solid #0f172a;padding-top:6px;font-size:12px;color:#64748b;">Initiator Signature</div></div>
    </div>
  `;
  openReceiptPrintWindow({
    title,
    subtitle: 'Official receipt',
    badges: [txn.accountNumber ? `Account ${txn.accountNumber}` : '', txn.id ? `Txn ${txn.id}` : ''].filter(Boolean),
    summaryCards: [
      { label: 'Amount', value: currencyGH(txn.amount) },
      { label: 'Date', value: txn.approvedAt || txn.initiatedAt || new Date().toISOString() },
      { label: 'Copies', value: String(Math.max(1, copies)) },
    ],
    tables,
    htmlContent: signatures,
    footerNote: fileTitle,
  });
}

export function printLoanDisbursementReceipt(loan, { copies = 2 } = {}) {
  if (!loan) return;
  const title = 'Loan Disbursement Receipt';
  const fileTitle = `${loan.accountNumber || 'receipt'} - ${title}`;
  const rows = [
    ['Date', loan.approvedAt || loan.createdAt || new Date().toISOString()],
    ['Loan ID', loan.id || '—'],
    ['Account', loan.accountNumber || '—'],
    ['Initiator', displayUserName(loan.initiatorName || '')],
    ['Approver', displayUserName(loan.approverName || '')],
    ['Principal', currencyGH(loan.principal)],
    ['Rate/Term', `${loan.rate || 0}% / ${loan.termMonths || 0}m`],
  ];
  openReceiptPrintWindow({
    title,
    subtitle: 'Loan disbursement receipt',
    badges: [loan.accountNumber ? `Account ${loan.accountNumber}` : '', loan.id ? `Loan ${loan.id}` : ''].filter(Boolean),
    summaryCards: [
      { label: 'Principal', value: currencyGH(loan.principal) },
      { label: 'Rate / Term', value: `${loan.rate || 0}% / ${loan.termMonths || 0}m` },
      { label: 'Copies', value: String(Math.max(1, copies)) },
    ],
    tables: Array.from({ length: Math.max(1, copies) }).map((_, i) => ({
      title: i === 0 ? 'Customer Copy' : 'Records Copy',
      columns: [
        { key: 'label', label: 'Field' },
        { key: 'value', label: 'Value' },
      ],
      rows: rows.map(([label, value]) => ({ label, value })),
      emptyText: 'No receipt details',
    })),
    htmlContent: `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:10px;">
        <div style="text-align:center;"><div style="height:28px;"></div><div style="border-top:1px solid #0f172a;padding-top:6px;font-size:12px;color:#64748b;">Customer Signature</div></div>
        <div style="text-align:center;"><div style="height:28px;"></div><div style="border-top:1px solid #0f172a;padding-top:6px;font-size:12px;color:#64748b;">Initiator Signature</div></div>
      </div>
    `,
    footerNote: fileTitle,
  });
}

export function addToSuperBin(entry) {
  const item = {
    id: `BIN-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    by: getCurrentUserName(),
    deletedAt: new Date().toISOString(),
    ...entry,
  };
  const list = getSuperBin();
  localStorage.setItem(BIN_KEY, JSON.stringify([item, ...list]));
  return item;
}
export function getSuperBin() {
  try {
    const raw = localStorage.getItem(BIN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export function restoreFromSuperBin(id) {
  const list = getSuperBin();
  const item = list.find(b => b.id === id);
  const remaining = list.filter(b => b.id !== id);
  localStorage.setItem(BIN_KEY, JSON.stringify(remaining));
  if (!item) return null;
  if (item.kind === 'pending_txn') {
    const p = getPendingTxns();
    setPendingTxns([item.payload, ...p]);
    return item.payload;
  }
  return item.payload;
}
export function purgeFromSuperBin(id) {
  const list = getSuperBin();
  const remaining = list.filter(b => b.id !== id);
  localStorage.setItem(BIN_KEY, JSON.stringify(remaining));
}

export const PERMISSIONS = PERMS;
export const ROLE_NAMES = ROLES;

// App config (theme, branding)
const CONFIG_KEY = 'smbank_app_config';
export function getAppConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : {
      appName: 'smBank',
      footerText: '© smBank',
      primary: '#0f172a',
      primaryContrast: '#ffffff',
      companyPhone: '',
      companyEmail: '',
      darkMode: false,
    };
  } catch {
    return { appName: 'smBank', footerText: '© smBank', primary: '#0f172a', primaryContrast: '#ffffff', companyPhone: '', companyEmail: '', darkMode: false };
  }
}
export function saveAppConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  const ev = new Event('config_update');
  window.dispatchEvent(ev);
}
export function onConfigUpdate(cb) {
  const handler = () => cb(getAppConfig());
  window.addEventListener('config_update', handler);
  return () => window.removeEventListener('config_update', handler);
}
