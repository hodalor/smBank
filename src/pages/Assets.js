import { useEffect, useMemo, useState } from 'react';
import { createAsset, listAssets, listUsers, updateAssetStatus } from '../api';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { showError, showSuccess } from '../components/Toaster';
import Pager from '../components/Pager';

const CONDITIONS = ['New', 'Refurbished', 'Used'];
const STATUSES = ['Available', 'In Use', 'Damaged', 'Repair', 'Retired'];
const CATEGORIES = [
  'Computer: Laptop',
  'Computer: Desktop',
  'Computer: Server',
  'Printer',
  'Scanner',
  'Network: Router',
  'Network: Switch',
  'UPS',
  'CCTV Camera',
  'Air Conditioner',
  'Generator',
  'Vehicle',
  'Furniture: Chair',
  'Furniture: Desk',
  'Furniture: Cabinet',
  'Cash Counter',
  'Safe',
  'Mobile Phone',
  'Tablet',
  'Other',
];

export default function Assets() {
  const [users, setUsers] = useState([]);
  const canManage = hasPermission(PERMISSIONS.ASSETS_MANAGE);
  useEffect(() => {
    (async () => {
      try { const us = await listUsers(); setUsers(Array.isArray(us) ? us : []); } catch {}
    })();
  }, []);

  const [filters, setFilters] = useState({ q: '', status: '', condition: '', category: '', assignedTo: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listAssets(filters);
        if (!stop) setRows(Array.isArray(list) ? list : []);
      } catch {
        if (!stop) setRows([]);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [filters]);
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const [form, setForm] = useState({
    name: '',
    category: '',
    otherCategory: '',
    serialNumber: '',
    purchaseDate: '',
    condition: 'New',
    status: 'Available',
    assignedTo: '',
    notes: '',
  });
  const canSubmit = canManage && form.name.trim() && form.serialNumber.trim() && ((form.category && form.category !== 'Other') || (form.category === 'Other' && form.otherCategory.trim()));

  const submit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      const payload = {
        ...form,
        category: form.category === 'Other' ? `Other - ${form.otherCategory.trim()}` : form.category,
        remarks: 'Initial registration',
      };
      await createAsset(payload);
      setForm({ name: '', category: '', otherCategory: '', serialNumber: '', purchaseDate: '', condition: 'New', status: 'Available', assignedTo: '', notes: '' });
      showSuccess('Asset registered');
      const list = await listAssets(filters);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      showError(e.message || 'Failed to register asset');
    }
  };

  if (!hasPermission(PERMISSIONS.ASSETS_VIEW)) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Assets Registry</h1>
      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Search name/category/serial" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c === 'Other' ? '' : c}>{c}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })}>
            <option value="">All Condition</option>
            {CONDITIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.assignedTo} onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}>
            <option value="">All Assignees</option>
            {users.map(u => <option key={u.username} value={u.username}>{u.username} {u.fullName ? `— ${u.fullName}` : ''}</option>)}
          </select>
        </div>
      </div>

      {canManage && (
        <form className="form card" onSubmit={submit}>
          <h3>Register Asset</h3>
          <div className="form-grid">
            <label>
              Name
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Category
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {form.category === 'Other' && (
              <label>
                Specify Category
                <input className="input" value={form.otherCategory} onChange={(e) => setForm({ ...form, otherCategory: e.target.value })} placeholder="e.g., Counting Machine" />
              </label>
            )}
            <label>
              Serial Number
              <input className="input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} required />
            </label>
            <label>
              Purchase Date
              <input className="input" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            </label>
            <label>
              Condition
              <select className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                {CONDITIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Status
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Assign To
              <select className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.username} value={u.username}>{u.username} {u.fullName ? `— ${u.fullName}` : ''}</option>)}
              </select>
            </label>
            <label>
              Notes
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={!canSubmit}>Register</button>
          </div>
        </form>
      )}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>Assets</h3>
          {loading && <div>Loading…</div>}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Category</th>
              <th style={{ textAlign: 'left' }}>Serial</th>
              <th style={{ textAlign: 'left' }}>Condition</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th style={{ textAlign: 'left' }}>Assigned To</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {paged.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.category || '—'}</td>
                <td>{a.serialNumber || '—'}</td>
                <td>{a.condition || '—'}</td>
                <td>{a.status || '—'}</td>
                <td>{a.assignedTo || '—'}</td>
                {canManage && (
                  <td>
                    <InlineUpdate users={users} asset={a} onDone={async () => {
                      try { const list = await listAssets(filters); setRows(Array.isArray(list) ? list : []); } catch {}
                    }} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <Pager
          total={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}

function InlineUpdate({ asset, users, onDone }) {
  const [status, setStatus] = useState(asset.status || 'Available');
  const [assignedTo, setAssignedTo] = useState(asset.assignedTo || '');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="row" style={{ gap: 6 }}>
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">— Unassigned —</option>
        {users.map(u => <option key={u.username} value={u.username}>{u.username} {u.fullName ? `— ${u.fullName}` : ''}</option>)}
      </select>
      <input className="input" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      <button className="btn" disabled={saving} onClick={async () => {
        try {
          if (!remarks.trim()) { showError('Enter remarks'); return; }
          setSaving(true);
          await updateAssetStatus(asset.id || asset.serialNumber, { status, assignedTo, remarks: remarks.trim() });
          setSaving(false);
          showSuccess('Updated');
          if (typeof onDone === 'function') onDone();
        } catch {
          setSaving(false);
          showError('Failed');
        }
      }}>Save</button>
    </div>
  );
}
