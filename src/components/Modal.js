export default function Modal({ open, title, subtitle, onClose, children, width }) {
  if (!open) return null;
  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div
        className="card detail-modal form-modal"
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-modal-header">
          <div>
            <div className="detail-modal-title">{title}</div>
            {subtitle ? <div className="detail-modal-subtitle">{subtitle}</div> : null}
          </div>
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
