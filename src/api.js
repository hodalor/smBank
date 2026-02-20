const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function apiFetch(path, opts = {}) {
  const h = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  try {
    const tok = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('smbank_token') : '';
    if (tok) h['Authorization'] = `Bearer ${tok}`;
  } catch {}
  const res = await fetch(`${API_BASE}${path}`, {
    headers: h,
    credentials: 'include',
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}
function superBinHeaders() { return {}; }

export async function apiLogin(username, password) {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}
export async function apiLogout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return apiFetch('/me', { method: 'GET' });
}

export async function fetchConfig() {
  return apiFetch('/config', { method: 'GET' });
}
export async function updateConfig(cfg) {
  return apiFetch('/config', { method: 'PUT', body: JSON.stringify(cfg) });
}

export async function listSuperBin() {
  return apiFetch('/super-bin', { method: 'GET', headers: superBinHeaders() });
}
export async function restoreSuperBin(id) {
  return apiFetch(`/super-bin/${id}/restore`, { method: 'POST', headers: superBinHeaders() });
}
export async function deleteSuperBin(id) {
  return apiFetch(`/super-bin/${id}`, { method: 'DELETE', headers: superBinHeaders() });
}

export { API_BASE };

// Users
export async function listUsers(params = {}) {
  const q = new URLSearchParams();
  if (params.department) q.set('department', params.department);
  if (params.role) q.set('role', params.role);
  if (params.empno) q.set('empno', params.empno);
  if (params.q) q.set('q', params.q);
  const qs = q.toString();
  return apiFetch(`/users${qs ? `?${qs}` : ''}`, { method: 'GET' });
}
export async function upsertUser(payload) {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
}
export async function removeUser(username) {
  return apiFetch(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
}
export async function changeUserPassword(username, password) {
  return apiFetch(`/users/${encodeURIComponent(username)}/password`, { method: 'POST', body: JSON.stringify({ password }) });
}
export async function setUserEnabled(username, enabled) {
  const path = enabled ? 'enable' : 'disable';
  return apiFetch(`/users/${encodeURIComponent(username)}/${path}`, { method: 'POST' });
}

export async function listClients(params = {}) {
  const q = new URLSearchParams();
  if (params.accountNumber) q.set('accountNumber', params.accountNumber);
  if (params.q) q.set('q', params.q);
  return apiFetch(`/clients?${q.toString()}`, { method: 'GET' });
}
export async function getClient(id) {
  return apiFetch(`/clients/${id}`, { method: 'GET' });
}
export async function createClient(payload) {
  return apiFetch('/clients', { method: 'POST', body: JSON.stringify(payload) });
}
export async function updateClient(id, payload) {
  return apiFetch(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export async function deleteClient(id) {
  return apiFetch(`/clients/${id}`, { method: 'DELETE' });
}
export async function directoryLookup(accountNumber) {
  return apiFetch(`/directory/${accountNumber}`, { method: 'GET' });
}

export async function createDeposit(payload) {
  return apiFetch('/transactions/deposit', { method: 'POST', body: JSON.stringify(payload) });
}
export async function createWithdraw(payload) {
  return apiFetch('/transactions/withdraw', { method: 'POST', body: JSON.stringify(payload) });
}
export async function listPendingTransactions(params = {}) {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  return apiFetch(`/transactions/pending?${q.toString()}`, { method: 'GET' });
}
export async function listPostedTransactions(params = {}) {
  const q = new URLSearchParams();
  if (params.accountNumber) q.set('accountNumber', params.accountNumber);
  if (params.type) q.set('type', params.type);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.id) q.set('id', params.id);
  return apiFetch(`/transactions/posted?${q.toString()}`, { method: 'GET' });
}
export async function approvePendingTransaction(id, payload = {}) {
  return apiFetch(`/transactions/pending/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function rejectPendingTransaction(id, payload = {}) {
  return apiFetch(`/transactions/pending/${id}/reject`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function listLoans(params = {}) {
  const q = new URLSearchParams();
  if (params.accountNumber) q.set('accountNumber', params.accountNumber);
  if (params.status) q.set('status', params.status);
  return apiFetch(`/loans?${q.toString()}`, { method: 'GET' });
}
export async function listLoanApprovals() {
  return apiFetch('/loans/approvals', { method: 'GET' });
}
export async function createLoan(payload) {
  return apiFetch('/loans', { method: 'POST', body: JSON.stringify(payload) });
}
export async function approveLoan(id, payload = {}) {
  return apiFetch(`/loans/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function rejectLoan(id, payload = {}) {
  return apiFetch(`/loans/${id}/reject`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function createLoanRepayment(loanId, payload) {
  return apiFetch(`/loans/${loanId}/repay`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function listLoanRepayPending() {
  return apiFetch('/loans/repay/pending', { method: 'GET' });
}
export async function listLoanRepayPosted(params = {}) {
  const q = new URLSearchParams();
  if (params.accountNumber) q.set('accountNumber', params.accountNumber);
  if (params.id) q.set('id', params.id);
  return apiFetch(`/loans/repay/posted?${q.toString()}`, { method: 'GET' });
}
export async function approveLoanRepayPending(id, payload = {}) {
  return apiFetch(`/loans/repay/pending/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function rejectLoanRepayPending(id, payload = {}) {
  return apiFetch(`/loans/repay/pending/${id}/reject`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function listActivity(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.actor) q.set('actor', params.actor);
  if (params.action) q.set('action', params.action);
  if (params.entity) q.set('entity', params.entity);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch(`/activity${qs ? `?${qs}` : ''}`, { method: 'GET' });
}
