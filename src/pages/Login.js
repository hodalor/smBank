import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setCurrentUserName, saveUser, getUserByUsername, getAppConfig, onConfigUpdate, saveAppConfig } from '../state/ops';
import { apiLogin, fetchConfig, publicChangePassword, publicAdminResetPassword } from '../api';
import { IconLogIn, IconSliders, IconX, IconSave } from '../components/Icons';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [captcha, setCaptcha] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [adminU, setAdminU] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [resetUser, setResetUser] = useState('');
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwd2, setResetPwd2] = useState('');
  const [appCfg, setAppCfg] = useState(getAppConfig());
  const canvasRef = useRef(null);
  const captchaTimerRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const saved = localStorage.getItem('remember_username');
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
  }, []);
  useEffect(() => {
    fetchConfig().then(c => { setAppCfg(c); saveAppConfig(c); }).catch(() => {});
    const off = onConfigUpdate(setAppCfg);
    return () => off && off();
  }, []);
  const regenerateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    setCaptcha(c);
    setCaptchaInput('');
  };
  useEffect(() => {
    if (!captcha) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(22,163,74,${Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(captcha, w / 2, h / 2);
  }, [captcha]);
  useEffect(() => {
    regenerateCaptcha();
    if (captchaTimerRef.current) clearInterval(captchaTimerRef.current);
    captchaTimerRef.current = setInterval(() => regenerateCaptcha(), 60 * 1000);
    return () => { if (captchaTimerRef.current) clearInterval(captchaTimerRef.current); };
  }, []);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setExpired(false);
    if (!captchaInput || captchaInput.toLowerCase() !== captcha.toLowerCase()) {
      setError('Invalid captcha');
      regenerateCaptcha();
      return;
    }
    const uname = (username || '').trim();
    if (!uname || !password) {
      setError('Enter account and password');
      return;
    }
    try {
      const { role, token, passwordChangeRequired } = await apiLogin(uname, password);
      if (token && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('smbank_token', token);
      }
      const existing = getUserByUsername(uname);
      if (!existing) {
        saveUser({ username: uname, role, permsAdd: [], permsRemove: [] });
      } else if (existing.role !== role) {
        saveUser({ ...existing, role });
      }
      if (passwordChangeRequired) {
        localStorage.setItem('force_password_change', '1');
      } else {
        localStorage.removeItem('force_password_change');
      }
    } catch (e) {
      const msg = String((e && e.message) ? e.message : '').toLowerCase();
      if (msg.includes('password_expired')) {
        setExpired(true);
        setError('Password expired — change required');
      } else {
        setError('Invalid username or password');
      }
      regenerateCaptcha();
      return;
    }
    setCurrentUserName(uname);
    if (remember) localStorage.setItem('remember_username', uname);
    else localStorage.removeItem('remember_username');
    if (localStorage.getItem('force_password_change') === '1') navigate('/my-account');
    else navigate('/dashboard');
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f1f5f9' }}>
      <div className="card" style={{ width: 420, padding: 24, borderRadius: 16, boxShadow: '0 10px 30px rgba(2,6,23,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <img src="/logo512.png" alt={appCfg.appName || 'smBank'} style={{ width: 44, height: 44 }} />
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a' }}>{appCfg.appName || 'smBank'}</div>
        </div>
        <form onSubmit={submit} className="stack" style={{ display: 'grid', gap: 12 }}>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="account" />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
          <div className="row" style={{ gap: 8 }}>
            <input className="input" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} placeholder="captcha" style={{ flex: 1 }} />
            <canvas ref={canvasRef} width={100} height={40} style={{ border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }} onClick={regenerateCaptcha} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>remember password</span>
          </label>
          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }}><IconLogIn /><span>Login In</span></button>
        </form>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn" onClick={() => setResetOpen(s => !s)}>{resetOpen ? (<><IconX /><span>Hide Reset</span></>) : (<><IconSliders /><span>Reset Password (Admin)</span></>)}</button>
        </div>
        {resetOpen && (
          <div className="stack" style={{ marginTop: 8, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Reset with Admin Approval</div>
            <input className="input" placeholder="Admin username" value={adminU} onChange={(e) => setAdminU(e.target.value)} />
            <input className="input" placeholder="Admin approval code" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} />
            <input className="input" placeholder="Your username" value={resetUser} onChange={(e) => setResetUser(e.target.value)} />
            <input className="input" type="password" placeholder="New password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
            <input className="input" type="password" placeholder="Confirm new password" value={resetPwd2} onChange={(e) => setResetPwd2(e.target.value)} />
            <button className="btn" onClick={async () => {
              try {
                if (!adminU || !adminCode || !resetUser || !resetPwd) { setError('Fill all reset fields'); return; }
                if (resetPwd !== resetPwd2) { setError('Passwords do not match'); return; }
                if (resetPwd.length < 10 || !/[A-Z]/.test(resetPwd) || !/[a-z]/.test(resetPwd) || !/[0-9]/.test(resetPwd) || !/[^A-Za-z0-9]/.test(resetPwd)) {
                  setError('Password must be ≥10 chars with upper, lower, digit, special');
                  return;
                }
                await publicAdminResetPassword({ adminUsername: adminU, approvalCode: adminCode, username: resetUser, newPassword: resetPwd });
                setError('Password reset. Login and change to your personal password.');
                setResetOpen(false);
                setAdminU(''); setAdminCode(''); setResetUser(''); setResetPwd(''); setResetPwd2('');
              } catch (e3) {
                setError(((e3 && e3.message) ? e3.message : 'Reset failed'));
              }
            }}><IconSave /><span>Reset Password</span></button>
            <div style={{ color: '#64748b', fontSize: 12 }}>Ask an Admin to provide the daily approval code.</div>
          </div>
        )}
        {expired && (
          <div className="stack" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Reset Expired Password</div>
            <input className="input" type="password" placeholder="Current password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            <input className="input" type="password" placeholder="New password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <input className="input" type="password" placeholder="Confirm new password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} />
            <button className="btn" onClick={async () => {
              try {
                if (!username || !oldPwd || !newPwd) { setError('Fill all fields'); return; }
                if (newPwd !== newPwd2) { setError('Passwords do not match'); return; }
                if (newPwd.length < 10 || !/[A-Z]/.test(newPwd) || !/[a-z]/.test(newPwd) || !/[0-9]/.test(newPwd) || !/[^A-Za-z0-9]/.test(newPwd)) {
                  setError('Password must be ≥10 chars with upper, lower, digit, special');
                  return;
                }
                await publicChangePassword(username, oldPwd, newPwd);
                setError('Password updated. Please login.');
                setExpired(false);
                setOldPwd(''); setNewPwd(''); setNewPwd2('');
              } catch (e2) {
                setError(((e2 && e2.message) ? e2.message : 'Failed to update password'));
              }
            }}><IconSave /><span>Update Password</span></button>
          </div>
        )}
      </div>
    </div>
  );
}
