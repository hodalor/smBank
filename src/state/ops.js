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

function openPrint(html, title = 'Receipt') {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>${title}</title>
    <style>
      @page { margin: 6mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #0f172a; width: 260px; }
      .center { text-align: center; }
      .title { font-weight: 700; font-size: 14px; margin: 4px 0; }
      .hr { border-top: 1px dashed #999; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 2px 0; vertical-align: top; }
      .label { color: #475569; width: 45%; }
      .value { width: 55%; text-align: right; }
      .sign { margin-top: 14px; display: flex; justify-content: space-between; }
      .sign div { width: 48%; }
      .line { border-top: 1px solid #0f172a; margin-top: 22px; }
      .copy { margin-top: 6px; font-size: 11px; text-align: center; color: #64748b; }
    </style>
  </head>
  <body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch {} }, 150);
}

export function printTxnReceipt(txn, { copies = 2 } = {}) {
  if (!txn) return;
  const app = getAppConfig();
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
  const block = (copyLabel) => `
    <div class="center">
      <div class="title">${app.appName || 'smBank'}</div>
      <div>${title}</div>
      <div class="copy">${copyLabel}</div>
    </div>
    <div class="hr"></div>
    <table>${rows.map(([l,v]) => `<tr><td class="label">${l}</td><td class="value">${v}</td></tr>`).join('')}</table>
    <div class="sign">
      <div>
        <div style="height:28px"></div>
        <div class="line"></div>
        <div class="copy">Customer Signature</div>
      </div>
      <div>
        <div style="height:28px"></div>
        <div class="line"></div>
        <div class="copy">Initiator Signature</div>
      </div>
    </div>`;
  const html = Array.from({ length: Math.max(1, copies) }).map((_, i) => block(i === 0 ? 'Customer Copy' : 'Records Copy')).join('<div class="hr"></div>');
  openPrint(html, fileTitle);
}

export function printLoanDisbursementReceipt(loan, { copies = 2 } = {}) {
  if (!loan) return;
  const app = getAppConfig();
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
  const block = (copyLabel) => `
    <div class="center">
      <div class="title">${app.appName || 'smBank'}</div>
      <div>${title}</div>
      <div class="copy">${copyLabel}</div>
    </div>
    <div class="hr"></div>
    <table>${rows.map(([l,v]) => `<tr><td class="label">${l}</td><td class="value">${v}</td></tr>`).join('')}</table>
    <div class="sign">
      <div>
        <div style="height:28px"></div>
        <div class="line"></div>
        <div class="copy">Customer Signature</div>
      </div>
      <div>
        <div style="height:28px"></div>
        <div class="line"></div>
        <div class="copy">Initiator Signature</div>
      </div>
    </div>`;
  const html = Array.from({ length: Math.max(1, copies) }).map((_, i) => block(i === 0 ? 'Customer Copy' : 'Records Copy')).join('<div class="hr"></div>');
  openPrint(html, fileTitle);
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
      darkMode: false,
    };
  } catch {
    return { appName: 'smBank', footerText: '© smBank', primary: '#0f172a', primaryContrast: '#ffffff', darkMode: false };
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
