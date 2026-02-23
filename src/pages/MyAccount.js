import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMe, listClients } from '../api';
import { showError } from '../components/Toaster';
import { hasPermission, PERMISSIONS } from '../state/ops';

export default function MyAccount() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [managed, setManaged] = useState([]);
  const [loadingManaged, setLoadingManaged] = useState(false);
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getMe();
        if (!stop) setMe(res);
      } catch (e) {
        showError('Failed to load profile');
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, []);
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!me || !me.username) return;
      setLoadingManaged(true);
      try {
        const list = await listClients({ manager: me.username });
        if (!stop) setManaged(Array.isArray(list) ? list : []);
      } catch {
        if (!stop) setManaged([]);
      } finally {
        if (!stop) setLoadingManaged(false);
      }
    })();
    return () => { stop = true; };
  }, [me]);
  const canApprove = hasPermission(PERMISSIONS.TXN_APPROVALS_VIEW) || hasPermission(PERMISSIONS.LOANS_APPROVALS_VIEW) || hasPermission(PERMISSIONS.LOANS_REPAY_APPROVALS_VIEW);
  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>My Account</h1>
        {me && canApprove && (
          <div className="card" style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Approval Code (renews 00:00 UTC)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ letterSpacing: 2 }}>{show ? me.approvalCode : '******'}</span>
              <button className="btn" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        {loading && <div>Loading…</div>}
        {!loading && me && (
          <table className="table">
            <tbody>
              <tr><th style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>Username</th><td>{me.username}</td></tr>
              <tr><th style={{ textAlign: 'left' }}>Role</th><td>{me.role || ''}</td></tr>
              {me.fullName != null && <tr><th style={{ textAlign: 'left' }}>Full Name</th><td>{me.fullName}</td></tr>}
              {me.email != null && <tr><th style={{ textAlign: 'left' }}>Email</th><td>{me.email}</td></tr>}
              {me.phone != null && <tr><th style={{ textAlign: 'left' }}>Phone</th><td>{me.phone}</td></tr>}
              {me.department != null && <tr><th style={{ textAlign: 'left' }}>Department</th><td>{me.department}</td></tr>}
              {me.position != null && <tr><th style={{ textAlign: 'left' }}>Position</th><td>{me.position}</td></tr>}
              {me.employeeNumber != null && <tr><th style={{ textAlign: 'left' }}>Employee No</th><td>{me.employeeNumber}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {me && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3>Accounts I Manage</h3>
            <div style={{ color: '#64748b' }}>{loadingManaged ? 'Loading…' : `${managed.length} assigned`}</div>
          </div>
          {loadingManaged && <div>Loading…</div>}
          {!loadingManaged && managed.length === 0 && <div>No assigned accounts</div>}
          {!loadingManaged && managed.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Account Number</th>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Phone</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {managed.slice(0, 20).map(c => {
                  const name = c.fullName || c.companyName || '';
                  return (
                    <tr key={c.accountNumber}>
                      <td><Link to={`/clients/${c.accountNumber}`}>{c.accountNumber}</Link></td>
                      <td>{name}</td>
                      <td>{c.phone || c.companyPhone || ''}</td>
                      <td>{c.status || 'Active'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
