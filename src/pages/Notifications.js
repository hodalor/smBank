import { useEffect, useState } from 'react';
import { listNotifications, resendNotification } from '../api';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { showError, showSuccess } from '../components/Toaster';

export default function Notifications() {
  const allowed = hasPermission(PERMISSIONS.NOTIFY_SEND);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [quick, setQuick] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [channel, setChannel] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(200);
  async function load() {
    try {
      setLoading(true);
      const q = {};
      if (quick) q.q = quick;
      if (channel) q.channel = channel;
      if (type) q.type = type;
      if (status) q.status = status;
      if (from) q.from = from;
      if (to) q.to = to;
      if (limit) q.limit = limit;
      const list = await listNotifications(q);
      setItems(list || []);
    } catch (e) {
      showError(e && e.message ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  async function resend(id) {
    try {
      await resendNotification(id);
      showSuccess('Resent successfully');
      load();
    } catch (e) {
      showError(e && e.message ? e.message : 'Resend failed');
    }
  }
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Notifications</h1>
      <div className="card" style={{ marginBottom: 16, display: 'grid', gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={quick} onChange={e => setQuick(e.target.value)} placeholder="Quick search: receiver, subject, message" style={{ flex: 1 }} />
          <button className="btn" onClick={() => setQuick('')}>Clear</button>
          <button className="btn" onClick={() => setShowAdvanced(v => !v)}>{showAdvanced ? 'Hide Advanced' : 'Advanced'}</button>
          <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Fetch'}</button>
        </div>
        {showAdvanced && (
          <div className="form-row">
            <div className="form-group">
              <label>Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)}>
                <option value="">Any</option>
                <option value="sms">sms</option>
                <option value="email">email</option>
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="">Any</option>
                <option value="test">test</option>
                <option value="promotion">promotion</option>
                <option value="transaction">transaction</option>
                <option value="loan">loan</option>
                <option value="resend">resend</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">Any</option>
                <option value="sent">sent</option>
                <option value="failed">failed</option>
                <option value="skipped">skipped</option>
              </select>
            </div>
            <div className="form-group">
              <label>From</label>
              <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Limit</label>
              <input type="number" min="1" max="1000" value={limit} onChange={e => setLimit(Number(e.target.value || 0))} />
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Channel</th>
              <th>Type</th>
              <th>Receiver</th>
              <th>Subject</th>
              <th>Message</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{String(it.ts || '').replace('T', ' ').replace('Z', '')}</td>
                <td>{it.channel}</td>
                <td>{it.type}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.receiver}</td>
                <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subject}</td>
                <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.message}</td>
                <td>{it.status}</td>
                <td>
                  {(it.status === 'failed' || it.status === 'skipped') && (
                    <button className="btn" onClick={() => resend(it.id)}>Resend</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
