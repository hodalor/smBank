const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
let inflight = 0;
const loadingBus = new EventTarget();
function emitLoading() {
  try {
    const ev = new CustomEvent('api:loading', { detail: { inflight } });
    loadingBus.dispatchEvent(ev);
  } catch {
    const ev = new Event('api:loading');
    ev.detail = { inflight };
    loadingBus.dispatchEvent(ev);
  }
}
export function onApiLoading(cb) {
  const handler = (e) => {
    const n = (e && e.detail && typeof e.detail.inflight === 'number') ? e.detail.inflight : inflight;
    cb(n > 0, n);
  };
  loadingBus.addEventListener('api:loading', handler);
  cb(inflight > 0, inflight);
  return () => loadingBus.removeEventListener('api:loading', handler);
}

async function apiFetch(path, opts = {}) {
  const h = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  try {
    const tok = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('smbank_token') : '';
    if (tok) h['Authorization'] = `Bearer ${tok}`;
  } catch {}
  inflight += 1;
  emitLoading();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: h,
      credentials: 'include',
      ...opts,
    });
    if (!res.ok) {
      let text = await res.text();
      try {
        const obj = JSON.parse(text);
        text = obj && (obj.details || obj.error || text);
      } catch {}
      const err = new Error(text || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  } finally {
    inflight = Math.max(0, inflight - 1);
    emitLoading();
  }
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
  // Deprecated: use changeOwnPassword or resetUserPassword
  return apiFetch(`/users/${encodeURIComponent(username)}/password`, { method: 'POST', body: JSON.stringify({ newPassword: password, oldPassword: '' }) });
}
export async function changeOwnPassword(username, oldPassword, newPassword) {
  return apiFetch(`/users/${encodeURIComponent(username)}/password`, { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
}
export async function resetUserPassword(username, newPassword, approvalCode) {
  return apiFetch(`/users/${encodeURIComponent(username)}/password/reset`, { method: 'POST', body: JSON.stringify({ newPassword, approvalCode }) });
}
export async function publicChangePassword(username, oldPassword, newPassword) {
  return apiFetch('/auth/password/change', { method: 'POST', body: JSON.stringify({ username, oldPassword, newPassword }) });
}
export async function publicAdminResetPassword({ adminUsername, approvalCode, username, newPassword }) {
  return apiFetch('/auth/password/reset-by-admin', { method: 'POST', body: JSON.stringify({ adminUsername, approvalCode, username, newPassword }) });
}
export async function sendTestSMS(to, message) {
  return apiFetch('/notify/test-sms', { method: 'POST', body: JSON.stringify({ to, message }) });
}
export async function sendPromotions(payload) {
  // payload: { segment: 'all-clients', message } or { numbers: [...], message }
  return apiFetch('/notify/promotions', { method: 'POST', body: JSON.stringify(payload) });
}
export async function sendTestEmail(to, subject, text) {
  return apiFetch('/notify/email/test', { method: 'POST', body: JSON.stringify({ to, subject, text }) });
}
export async function sendEmailPromotions(payload) {
  // payload: { segment: 'all-clients', subject, text } or { emails: [...], subject, text } or { segment: 'filtered-clients', filters, subject, text }
  return apiFetch('/notify/email/promotions', { method: 'POST', body: JSON.stringify(payload) });
}
export async function setUserEnabled(username, enabled) {
  const path = enabled ? 'enable' : 'disable';
  return apiFetch(`/users/${encodeURIComponent(username)}/${path}`, { method: 'POST' });
}

export async function listClients(params = {}) {
  const q = new URLSearchParams();
  if (params.accountNumber) q.set('accountNumber', params.accountNumber);
  if (params.manager) q.set('manager', params.manager);
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
export async function updateClientStatus(id, payload) {
  return apiFetch(`/clients/${id}/status`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function updateClientManager(id, payload) {
  return apiFetch(`/clients/${id}/manager`, { method: 'POST', body: JSON.stringify(payload) });
}

// Assets
export async function listAssets(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.status) q.set('status', params.status);
  if (params.assignedTo) q.set('assignedTo', params.assignedTo);
  if (params.condition) q.set('condition', params.condition);
  if (params.category) q.set('category', params.category);
  return apiFetch(`/assets?${q.toString()}`, { method: 'GET' });
}
export async function getAsset(id) {
  return apiFetch(`/assets/${encodeURIComponent(id)}`, { method: 'GET' });
}
export async function createAsset(payload) {
  return apiFetch('/assets', { method: 'POST', body: JSON.stringify(payload) });
}
export async function updateAssetStatus(id, payload) {
  return apiFetch(`/assets/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify(payload) });
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
export async function listTxnRecords(params = {}) {
  const q = new URLSearchParams();
  if (params.accountNumber) q.set('accountNumber', params.accountNumber);
  if (params.kind) q.set('kind', params.kind);
  if (params.status) q.set('status', params.status);
  if (params.id) q.set('id', params.id);
  if (params.initiator) q.set('initiator', params.initiator);
  return apiFetch(`/transactions/records?${q.toString()}`, { method: 'GET' });
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
export async function getLoan(id) {
  return apiFetch(`/loans/${id}`, { method: 'GET' });
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
  if (params.loanId) q.set('loanId', params.loanId);
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

export async function listServerLogs(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.level) q.set('level', params.level);
  if (params.method) q.set('method', params.method);
  if (params.status) q.set('status', String(params.status));
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch(`/server-logs${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function getServerLog(id) {
  return apiFetch(`/server-logs/${encodeURIComponent(id)}`, { method: 'GET' });
}

// Notifications
export async function listNotifications(params = {}) {
  const q = new URLSearchParams();
  if (params.channel) q.set('channel', params.channel);
  if (params.type) q.set('type', params.type);
  if (params.status) q.set('status', params.status);
  if (params.q) q.set('q', params.q);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch(`/notifications${qs ? `?${qs}` : ''}`, { method: 'GET' });
}
export async function getNotification(id) {
  return apiFetch(`/notifications/${encodeURIComponent(id)}`, { method: 'GET' });
}
export async function resendNotification(id) {
  return apiFetch(`/notifications/${encodeURIComponent(id)}/resend`, { method: 'POST' });
}

export async function uploadMedia(file, { entityType, entityId, tag } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (entityType) form.append('entityType', entityType);
  if (entityId) form.append('entityId', entityId);
  if (tag) form.append('tag', tag);
  const headers = {};
  try {
    const tok = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('smbank_token') : '';
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
  } catch {}
  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });
  if (!res.ok) {
    let text = await res.text();
    try {
      const obj = JSON.parse(text);
      text = obj && (obj.details || obj.error || text);
    } catch {}
    const err = new Error(text || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
