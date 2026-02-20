import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setCurrentUserName } from '../state/ops';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    setCurrentUserName(username || 'Admin');
    navigate('/dashboard');
  };
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={submit} style={{ width: 320, display: 'grid', gap: 12 }}>
        <h2>Admin Login</h2>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button type="submit" style={{ padding: 10 }}>Login</button>
      </form>
    </div>
  );
}
