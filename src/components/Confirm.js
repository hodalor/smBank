import React from 'react';
import { createRoot } from 'react-dom/client';

export function confirm(message) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    const close = (v) => {
      resolve(v);
      setTimeout(() => {
        root.unmount();
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 0);
    };
    const Modal = () => (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
        <div className="card" style={{ maxWidth: 420, padding: 16, display: 'grid', gap: 12 }}>
          <div>{message}</div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => close(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => close(true)}>Confirm</button>
          </div>
        </div>
      </div>
    );
    root.render(<Modal />);
  });
}
