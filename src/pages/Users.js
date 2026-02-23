import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRoles, getAllPermissions, getEffectivePermissions, hasPermission, getCurrentUser } from '../state/ops';
import { listUsers, upsertUser, removeUser, resetUserPassword, setUserEnabled } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';
import { confirm } from '../components/Confirm';
import Pager from '../components/Pager';

export default function Users() {
  const allowed = hasPermission('users.manage');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    dateEmployed: '',
    contractEndDate: '',
    role: getRoles().ADMIN,
    enabled: true,
    permsAdd: [],
    permsRemove: [],
    password: '',
  });
  const [changingPassword, setChangingPassword] = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const roles = getRoles();
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterEmp, setFilterEmp] = useState('');
  const allPerms = getAllPermissions();
  const baseSet = useMemo(() => getEffectivePermissions({ role: form.role, permsAdd: [], permsRemove: [] }), [form.role]);
  const effectiveSet = useMemo(() => getEffectivePermissions(form), [form]);
  const reload = useCallback(async (filters = null) => {
    try {
      const list = await listUsers(filters || {
        department: filterDept || undefined,
        role: filterRole || undefined,
        empno: filterEmp || undefined,
      });
      setUsers(list);
    } catch {
      setUsers([]);
    }
  }, [filterDept, filterRole, filterEmp]);
  useEffect(() => { reload(); }, [reload]);
  const viewer = getCurrentUser();
  const viewerRole = viewer.role || '';
  const isAdminOrSuper = viewerRole === 'Admin' || viewerRole === 'Super Admin';
  const roleOrder = ['Customer Service', 'Teller', 'Account Manager', 'Loan Officer', 'Loan Manager', 'Admin', 'Super Admin'];
  const canSeeRole = (r) => roleOrder.indexOf(r) <= roleOrder.indexOf(viewerRole);
  const assignableRoles = Object.values(roles).filter(r => isAdminOrSuper ? r !== roles.SUPER_ADMIN : canSeeRole(r) && r !== roles.SUPER_ADMIN && r !== roles.ADMIN);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const togglePerm = (perm) => {
    const base = baseSet.has(perm);
    const has = effectiveSet.has(perm);
    let add = new Set(form.permsAdd || []);
    let rem = new Set(form.permsRemove || []);
    if (!has) {
      if (!base) add.add(perm);
      rem.delete(perm);
    } else {
      if (base) rem.add(perm);
      add.delete(perm);
    }
    setForm({ ...form, permsAdd: Array.from(add), permsRemove: Array.from(rem) });
  };
  const editUser = (u) => setForm({
    fullName: u.fullName || '',
    username: u.username,
    email: u.email || '',
    phone: u.phone || '',
    department: u.department || '',
    position: u.position || '',
    dateEmployed: u.dateEmployed || '',
    contractEndDate: u.contractEndDate || '',
    role: u.role,
    enabled: typeof u.enabled === 'boolean' ? u.enabled : true,
    permsAdd: u.permsAdd || [],
    permsRemove: u.permsRemove || [],
    password: '',
  });
  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.username.trim()) return;
    if (!users.find(u => u.username === payload.username) && !payload.password) {
      showWarning('Password is required for new user');
      return;
    }
    try {
      const saved = await upsertUser(payload);
      setForm({ ...form, password: '' });
      await reload();
      // focus edited
      setForm({
        fullName: saved.fullName || '',
        username: saved.username,
        email: saved.email || '',
        phone: saved.phone || '',
        department: saved.department || '',
        position: saved.position || '',
        dateEmployed: saved.dateEmployed || '',
        contractEndDate: saved.contractEndDate || '',
        role: saved.role,
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : true,
        permsAdd: saved.permsAdd || [],
        permsRemove: saved.permsRemove || [],
        password: '',
      });
    } catch (e2) {
      showError('Failed to save user');
    }
  };
  const remove = async (u) => {
    const ok = await confirm('Delete this user to Super Bin?');
    if (!ok) return;
    try {
      await removeUser(u.username);
      await reload();
      if (form.username === u.username) {
        setForm({
          fullName: '',
          username: '',
          email: '',
          phone: '',
          department: '',
          position: '',
          dateEmployed: '',
          contractEndDate: '',
          role: roles.ADMIN,
          enabled: true,
          permsAdd: [],
          permsRemove: [],
          password: '',
        });
      }
    } catch {
      showError('Failed to delete user');
    }
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Users</h1>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder="Department" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ width: 180 }} />
        <select className="input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={{ width: 180 }}>
          <option value="">Role (any)</option>
          {(isAdminOrSuper ? Object.values(roles) : Object.values(roles).filter(r => canSeeRole(r) && r !== roles.SUPER_ADMIN && r !== roles.ADMIN)).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="input" placeholder="Employee No." value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)} style={{ width: 160 }} />
        <button className="btn" onClick={() => reload()}>Filter</button>
        <button className="btn" onClick={() => { setFilterDept(''); setFilterRole(''); setFilterEmp(''); reload({}); }}>Clear</button>
      </div>
      <div className="row" style={{ gap: 16 }}>
        <form onSubmit={submit} className="card" style={{ padding: 16, minWidth: 420, display: 'grid', gap: 12 }}>
          <h3>{users.find(u => u.username === form.username) ? 'Edit User' : 'New User'}</h3>
          <label>
            Full Name
            <input className="input" name="fullName" value={form.fullName} onChange={change} required disabled={!isAdminOrSuper} />
          </label>
          <label>
            Username
            <input className="input" name="username" value={form.username} onChange={change} required disabled={!isAdminOrSuper} />
          </label>
          <div className="row" style={{ gap: 12 }}>
            <label style={{ flex: 1 }}>
              Email
              <input className="input" name="email" value={form.email} onChange={change} disabled={!isAdminOrSuper} />
            </label>
            <label style={{ flex: 1 }}>
              Phone
              <input className="input" name="phone" value={form.phone} onChange={change} disabled={!isAdminOrSuper} />
            </label>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <label style={{ flex: 1 }}>
              Department
              <input className="input" name="department" value={form.department} onChange={change} disabled={!isAdminOrSuper} />
            </label>
            <label style={{ flex: 1 }}>
              Position
              <input className="input" name="position" value={form.position} onChange={change} disabled={!isAdminOrSuper} />
            </label>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <label style={{ flex: 1 }}>
              Date Employed
              <input className="input" type="date" name="dateEmployed" value={form.dateEmployed} onChange={change} disabled={!isAdminOrSuper} />
            </label>
            <label style={{ flex: 1 }}>
              Contract End Date
              <input className="input" type="date" name="contractEndDate" value={form.contractEndDate} onChange={change} disabled={!isAdminOrSuper} />
            </label>
          </div>
          {isAdminOrSuper && (
            <label>
              Password {users.find(u => u.username === form.username) ? '(leave blank to keep unchanged)' : ''}
              <input className="input" type="password" name="password" value={form.password} onChange={change} />
            </label>
          )}
          <label>
            Role
            <select className="input" name="role" value={form.role} onChange={change} disabled={!isAdminOrSuper}>
              {(isAdminOrSuper ? Object.values(roles).filter(r => r !== roles.SUPER_ADMIN) : assignableRoles).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          {isAdminOrSuper && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              <span>Account Enabled</span>
            </label>
          )}
          {isAdminOrSuper && <div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Permissions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {allPerms.map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={effectiveSet.has(p)} onChange={() => togglePerm(p)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>}
          {isAdminOrSuper && <button className="btn btn-primary" type="submit">Save</button>}
          {form.username && isAdminOrSuper && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Change Password</div>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" type="password" placeholder="new password" value={changingPassword} onChange={(e) => setChangingPassword(e.target.value)} style={{ flex: 1 }} />
                <input className="input" type="text" placeholder="Admin Approval Code" value={approvalCode} onChange={(e) => setApprovalCode(e.target.value)} style={{ width: 180 }} />
                <button type="button" className="btn" onClick={async () => {
                  if (!changingPassword) { showWarning('Enter a new password'); return; }
                  if (!approvalCode) { showWarning('Enter your approval code'); return; }
                  if (changingPassword.length < 10 || !/[A-Z]/.test(changingPassword) || !/[a-z]/.test(changingPassword) || !/[0-9]/.test(changingPassword) || !/[^A-Za-z0-9]/.test(changingPassword)) {
                    showWarning('Password must be ≥10 chars with upper, lower, digit, special');
                    return;
                  }
                  try {
                    await resetUserPassword(form.username, changingPassword, approvalCode);
                    setChangingPassword('');
                    setApprovalCode('');
                    showSuccess('Password reset; user must change at next login');
                  } catch (e) {
                    showError(e.message || 'Failed to reset password');
                  }
                }}>Update</button>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button type="button" className="btn" onClick={async () => {
                  try {
                    let remarks = '';
                    try { remarks = window.prompt ? (window.prompt('Enter remark for enabling this account') || '') : ''; } catch {}
                    await setUserEnabled(form.username, true, remarks);
                    setForm({ ...form, enabled: true });
                    await reload();
                  } catch { showError('Failed to enable account'); }
                }}>Enable</button>
                <button type="button" className="btn" onClick={async () => {
                  try {
                    await setUserEnabled(form.username, false);
                    setForm({ ...form, enabled: false });
                    await reload();
                  } catch { showError('Failed to disable account'); }
                }}>Disable</button>
              </div>
            </div>
          )}
        </form>
        <div className="card" style={{ padding: 16, flex: 1 }}>
          <h3>All Users</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Dept</th>
                <th>Emp No.</th>
                <th>Status</th>
                <th>Role</th>
                {isAdminOrSuper && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.slice(((page||1)-1)*(pageSize||10), ((page||1)-1)*(pageSize||10) + (pageSize||10)).map(u => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td>{u.fullName || '-'}</td>
                  <td>{u.department || '-'}</td>
                  <td>{u.employeeNumber || '-'}</td>
                  <td>{u.enabled ? 'Enabled' : 'Disabled'}</td>
                  <td>{u.role}</td>
                  {isAdminOrSuper && <td>
                    <button className="btn" onClick={() => editUser(u)}>Edit</button>{' '}
                    <button className="btn" onClick={() => remove(u)}>Delete</button>{' '}
                    <button className="btn" onClick={async () => {
                      try {
                        let remarks = '';
                        if (!u.enabled) {
                          try { remarks = window.prompt ? (window.prompt('Enter remark for enabling this account') || '') : ''; } catch {}
                        }
                        await setUserEnabled(u.username, !u.enabled, remarks);
                        await reload();
                        showSuccess(!u.enabled ? 'User enabled' : 'User disabled');
                      } catch {
                        showError('Failed to update status');
                      }
                    }}>{u.enabled ? 'Disable' : 'Enable'}</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
          <Pager total={users.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </div>
    </div>
  );
}
