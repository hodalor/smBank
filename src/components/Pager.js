import React from 'react';
import { IconArrowLeft, IconArrowRight } from './Icons';

export default function Pager({ total = 0, page = 1, pageSize = 10, onPageChange, onPageSizeChange }) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const prev = () => onPageChange && onPageChange(Math.max(1, page - 1));
  const next = () => onPageChange && onPageChange(Math.min(pages, page + 1));
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
      <div style={{ color: '#64748b', fontSize: 12 }}>
        Showing page {page} of {pages} • {total} items
      </div>
      <div className="row" style={{ gap: 8 }}>
        <label>
          <span style={{ marginRight: 6, color: '#64748b', fontSize: 12 }}>Page size</span>
          <select className="input" value={pageSize} onChange={e => onPageSizeChange && onPageSizeChange(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button className="btn" onClick={prev} disabled={page <= 1}><IconArrowLeft /><span>Prev</span></button>
        <button className="btn" onClick={next} disabled={page >= pages}><IconArrowRight /><span>Next</span></button>
      </div>
    </div>
  );
}
