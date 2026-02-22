import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setCurrentUserName, saveUser, getUserByUsername, getAppConfig, onConfigUpdate, saveAppConfig } from '../state/ops';
import { apiLogin, fetchConfig } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [marchCode, setMarchCode] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [appCfg, setAppCfg] = useState(getAppConfig());
  const canvasRef = useRef(null);
  const captchaTimerRef = useRef(null);
  const navigate = useNavigate();
  const superCandidate = useMemo(() => {
    const u = (username || '').trim().toLowerCase();
    return u === 'super' || u === 'superadmin';
  }, [username]);
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
      const { role, token } = await apiLogin(uname, password);
      if (token && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('smbank_token', token);
      }
      const existing = getUserByUsername(uname);
      if (!existing) {
        saveUser({ username: uname, role, permsAdd: [], permsRemove: [] });
      } else if (existing.role !== role) {
        saveUser({ ...existing, role });
      }
    } catch (e) {
      setError('Invalid username or password');
      regenerateCaptcha();
      return;
    }
    setCurrentUserName(uname);
    if (remember) localStorage.setItem('remember_username', uname);
    else localStorage.removeItem('remember_username');
    navigate('/dashboard');
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
          <input className="input" value={marchCode} onChange={(e) => setMarchCode(e.target.value)} placeholder="march code" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>remember password</span>
          </label>
          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
          {superCandidate ? (
            <div style={{ fontSize: 12, color: '#0ea5e9' }}>Super Admin login</div>
          ) : (
            <div style={{ fontSize: 12, color: '#64748b' }}>Tip: use “super” or “superadmin” for Super Admin</div>
          )}
          <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }}>Login In</button>
        </form>
      </div>
    </div>
  );
}
