import { useMemo, useState } from 'react';
import { getUsers, saveUser, deleteUser, getRoles, getAllPermissions, getEffectivePermissions, hasPermission, getUserByUsername } from '../state/ops';

export default function Users() {
  const allowed = hasPermission('users.manage');
  const [users, setUsers] = useState(getUsers());
  const [form, setForm] = useState({ username: '', role: getRoles().ADMIN, permsAdd: [], permsRemove: [] });
  const roles = getRoles();
  const allPerms = getAllPermissions();
  const baseSet = useMemo(() => getEffectivePermissions({ role: form.role, permsAdd: [], permsRemove: [] }), [form.role]);
  const effectiveSet = useMemo(() => getEffectivePermissions(form), [form]);
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
  const editUser = (u) => setForm({ username: u.username, role: u.role, permsAdd: u.permsAdd || [], permsRemove: u.permsRemove || [] });
  const submit = (e) => {
    e.preventDefault();
    if (!form.username.trim()) return;
    saveUser({ username: form.username.trim(), role: form.role, permsAdd: form.permsAdd || [], permsRemove: form.permsRemove || [] });
    setUsers(getUsers());
  };
  const remove = (u) => {
    if (!window.confirm('Delete this user to Super Bin?')) return;
    deleteUser(u.username);
    setUsers(getUsers());
    if (getUserByUsername(form.username)?.username === u.username) setForm({ username: '', role: roles.ADMIN, permsAdd: [], permsRemove: [] });
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Users</h1>
      <div className="row" style={{ gap: 16 }}>
        <form onSubmit={submit} className="card" style={{ padding: 16, minWidth: 360, display: 'grid', gap: 12 }}>
          <h3>{form.username ? 'Edit User' : 'New User'}</h3>
          <label>
            Username
            <input className="input" name="username" value={form.username} onChange={change} required />
          </label>
          <label>
            Role
            <select className="input" name="role" value={form.role} onChange={change}>
              {Object.values(roles).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Permissions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {allPerms.map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={effectiveSet.has(p)} onChange={() => togglePerm(p)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Save</button>
        </form>
        <div className="card" style={{ padding: 16, flex: 1 }}>
          <h3>All Users</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td>
                    <button className="btn" onClick={() => editUser(u)}>Edit</button>{' '}
                    <button className="btn" onClick={() => remove(u)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
