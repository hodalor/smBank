const PENDING_KEY = 'smbank_pending_txn';
const POSTED_KEY = 'smbank_posted_txn';
const USER_KEY = 'smbank_current_user';
const bus = new EventTarget();

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
  const remaining = list.filter(t => t.id !== id);
  setPendingTxns(remaining);
  // Optionally keep a reject log later
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
