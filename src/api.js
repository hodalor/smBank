const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'include',
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export async function apiLogin(username, password) {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export async function fetchConfig() {
  return apiFetch('/config', { method: 'GET' });
}
export async function updateConfig(cfg) {
  return apiFetch('/config', { method: 'PUT', body: JSON.stringify(cfg) });
}

export async function listSuperBin() {
  return apiFetch('/super-bin', { method: 'GET' });
}
export async function restoreSuperBin(id) {
  return apiFetch(`/super-bin/${id}/restore`, { method: 'POST' });
}
export async function deleteSuperBin(id) {
  return apiFetch(`/super-bin/${id}`, { method: 'DELETE' });
}

export { API_BASE };

