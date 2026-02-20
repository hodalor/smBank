import { useEffect, useState } from 'react';

const EVT = 'app:toast';

export function showSuccess(message) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { type: 'success', message } }));
}
export function showWarning(message) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { type: 'warning', message } }));
}
export function showError(message) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { type: 'error', message } }));
}

export default function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const t = { id: `${Date.now()}-${Math.random()}`, ...e.detail };
      setItems((list) => [t, ...list]);
      setTimeout(() => {
        setItems((list) => list.filter((x) => x.id !== t.id));
      }, 4000);
    };
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
  }, []);
  const bg = (type) => {
    if (type === 'success') return '#16a34a';
    if (type === 'warning') return '#d97706';
    return '#dc2626';
  };
  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, display: 'grid', gap: 8, zIndex: 9999 }}>
      {items.map(t => (
        <div key={t.id} style={{ minWidth: 260, maxWidth: 360, padding: '10px 14px', borderRadius: 8, background: bg(t.type), color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ marginRight: 12 }}>{t.message}</div>
          <button onClick={() => setItems(list => list.filter(x => x.id !== t.id))} style={{ background: 'transparent', border: 0, color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
      ))}
    </div>
  );
}
