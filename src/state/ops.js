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
};

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMS),
  [ROLES.ADMIN]: Object.values(PERMS).filter(p => p !== PERMS.SUPERBIN_VIEW),
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
    PERMS.REPORTS_VIEW,
  ],
  [ROLES.TELLER]: [
    PERMS.CLIENTS_VIEW,
    PERMS.DEPOSIT_CREATE,
    PERMS.WITHDRAW_CREATE,
  ],
  [ROLES.CUSTOMER_SERVICE]: [
    PERMS.CLIENTS_VIEW,
    PERMS.STATEMENTS_VIEW,
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
      if (!localStorage.getItem(USER_KEY)) localStorage.setItem(USER_KEY, 'super');
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
  return base;
}

export function getCurrentUser() {
  const username = getCurrentUserName();
  const user = getUserByUsername(username);
  if (user) return user;
  return { username: username || 'Admin', role: ROLES.ADMIN, permsAdd: [], permsRemove: [] };
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
    return v || 'Admin';
  } catch {
    return 'Admin';
  }
}
export function setCurrentUserName(name) {
  localStorage.setItem(USER_KEY, name || 'Admin');
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
