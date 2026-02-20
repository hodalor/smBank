import { useEffect, useMemo, useRef, useState } from 'react';
import { listServerLogs, getServerLog } from '../api';
import { hasPermission } from '../state/ops';
import { showError } from '../components/Toaster';

export default function ServerLogs() {
  const allowed = hasPermission('serverlogs.view');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [viewTitle, setViewTitle] = useState('');
  const [viewSections, setViewSections] = useState([]);
  const [viewRaw, setViewRaw] = useState(null);
  const modalRef = useRef(null);
  const [quick, setQuick] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [level, setLevel] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [debouncedQuick, setDebouncedQuick] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuick(quick.trim()), 350);
    return () => clearTimeout(id);
  }, [quick]);
  const queryParams = useMemo(() => {
    const base = { limit: 200 };
    if (debouncedQuick) return { ...base, q: debouncedQuick };
    return {
      ...base,
      level: level || undefined,
      method: method || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    };
  }, [debouncedQuick, level, method, status, from, to]);
  useEffect(() => {
    if (!allowed) return;
    let stopped = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listServerLogs(queryParams);
        if (!stopped) setRows(data || []);
      } catch (e) {
        showError(e.message || 'Failed to load server logs');
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => { stopped = true; };
  }, [allowed, queryParams]);
  const openDetails = async (r) => {
    setOpen(true);
    setViewLoading(true);
    setViewError('');
    setViewTitle('Server Log Details');
    setViewSections([]);
    setViewRaw(null);
    try {
      const full = r.id ? await getServerLog(r.id) : r;
      setViewSections([
        ['Time', formatTs(full.ts)],
        ['Level', full.level || ''],
        ['Method', full.method || ''],
        ['Path', full.path || ''],
        ['Status', String(full.status || '')],
        ['Duration', full.durationMs != null ? `${full.durationMs} ms` : ''],
        ['Actor', full.actor || ''],
        ['Role', full.role || ''],
        ['IP', full.ip || ''],
        ['UA', full.ua || ''],
      ]);
      setViewRaw({
        params: full.params || null,
        query: full.query || null,
        body: full.body || null,
        errorMessage: full.errorMessage || null,
        errorStack: full.errorStack || null,
      });
    } catch (e) {
      setViewError(e.message || 'Failed to load log detail');
    } finally {
      setViewLoading(false);
    }
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Server Logs</h1>
      <div className="card" style={{ marginBottom: 16, display: 'grid', gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={quick} onChange={e => setQuick(e.target.value)} placeholder="Quick search: path, error, actor, UA" style={{ flex: 1 }} />
          <button className="btn" onClick={() => setQuick('')}>Clear</button>
          <button className="btn" onClick={() => setShowAdvanced(v => !v)}>{showAdvanced ? 'Hide Advanced' : 'Advanced'}</button>
        </div>
        {showAdvanced && (
          <div className="form-row">
            <div className="form-group">
              <label>Level</label>
              <select value={level} onChange={e => setLevel(e.target.value)}>
                <option value="">Any</option>
                <option value="info">info</option>
                <option value="error">error</option>
              </select>
            </div>
            <div className="form-group">
              <label>Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="">Any</option>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
                <option>PATCH</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <input value={status} onChange={e => setStatus(e.target.value)} placeholder="e.g. 200" />
            </div>
            <div className="form-group">
              <label>From</label>
              <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setDebouncedQuick('')}>Search</button>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Time</th>
                <th>Level</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Actor</th>
                <th>IP</th>
                <th>UA</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={9}>No logs.</td></tr>}
              {!loading && rows.map((r, i) => (
                <tr key={`${r.id || i}-${r.ts}`} onClick={() => openDetails(r)} style={{ cursor: 'pointer', background: r.level === 'error' ? '#fff1f2' : undefined }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatTs(r.ts)}</td>
                  <td>{r.level}</td>
                  <td>{r.method}</td>
                  <td>{r.path}</td>
                  <td>{r.status}</td>
                  <td>{r.durationMs != null ? `${r.durationMs} ms` : ''}</td>
                  <td>{r.actor}</td>
                  <td>{r.ip}</td>
                  <td>{shortUA(r.ua)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setOpen(false)}>
          <div ref={modalRef} className="card" style={{ width: 720, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{viewTitle}</div>
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
            </div>
            {viewLoading && <div>Loading…</div>}
            {viewError && <div style={{ color: '#dc2626' }}>{viewError}</div>}
            {!viewLoading && !viewError && (
              <>
                <table className="table">
                  <tbody>
                    {viewSections.map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {viewRaw != null && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Raw</div>
                    <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
                      {safeJSONStringify(viewRaw)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTs(ts) {
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleString();
    return String(ts);
  } catch {
    return String(ts);
  }
}
function shortUA(ua) {
  try {
    if (!ua) return '';
    const s = String(ua);
    if (s.length > 40) return `${s.slice(0, 40)}…`;
    return s;
  } catch { return ''; }
}
function safeJSONStringify(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}
