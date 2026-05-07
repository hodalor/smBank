import React from 'react';
import { createRoot } from 'react-dom/client';
import { IconX, IconCheck } from './Icons';

function mountDialog(renderDialog) {
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
    root.render(renderDialog(close));
  });
}

function Shell({ title = 'Confirm', children, actions }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: 16 }}>
      <div className="card" style={{ width: 'min(100%, 440px)', padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {children}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {actions}
        </div>
      </div>
    </div>
  );
}

export function confirm(message, options = {}) {
  const { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel' } = options;
  return mountDialog((close) => (
    <Shell
      title={title}
      actions={
        <>
          <button className="btn" onClick={() => close(false)}><IconX /><span>{cancelText}</span></button>
          <button className="btn btn-primary" onClick={() => close(true)}><IconCheck /><span>{confirmText}</span></button>
        </>
      }
    >
      <div>{message}</div>
    </Shell>
  ));
}

export function prompt(message, options = {}) {
  const {
    title = 'Input Required',
    confirmText = 'OK',
    cancelText = 'Cancel',
    placeholder = '',
    defaultValue = '',
    required = false,
  } = options;
  return mountDialog((close) => {
    const Modal = () => {
      const [value, setValue] = React.useState(defaultValue);
      const trimmed = String(value || '').trim();
      const submit = () => {
        if (required && !trimmed) return;
        close(value);
      };
      return (
        <Shell
          title={title}
          actions={
            <>
              <button className="btn" onClick={() => close(null)}><IconX /><span>{cancelText}</span></button>
              <button className="btn btn-primary" onClick={submit} disabled={required && !trimmed}><IconCheck /><span>{confirmText}</span></button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div>{message}</div>
            <input
              className="input"
              autoFocus
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') close(null);
              }}
            />
          </div>
        </Shell>
      );
    };
    return <Modal />;
  });
}
