import { getAppConfig } from '../state/ops';

function safeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderValue(value) {
  if (value == null || value === '') return '—';
  return safeHtml(value);
}

function renderSummaryCards(cards = []) {
  if (!cards.length) return '';
  return `
    <div class="summary-grid">
      ${cards.map((card) => `
        <div class="summary-card">
          <div class="summary-label">${safeHtml(card.label || '')}</div>
          <div class="summary-value">${renderValue(card.value)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSections(sections = []) {
  return sections.map((section) => `
    <div class="section">
      <div class="section-title">${safeHtml(section.title || '')}</div>
      <div class="detail-grid">
        ${(section.rows || []).map(([label, value]) => `
          <div class="detail-item">
            <div class="detail-label">${safeHtml(label || '')}</div>
            <div class="detail-value">${renderValue(value)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderTables(tables = []) {
  return tables.map((table) => `
    <div class="section">
      <div class="section-title">${safeHtml(table.title || '')}</div>
      <table>
        <thead>
          <tr>${(table.columns || []).map((col) => `<th>${safeHtml(col.label || '')}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${(table.rows || []).length ? (table.rows || []).map((row) => `
            <tr>${(table.columns || []).map((col) => `<td>${renderValue(row[col.key])}</td>`).join('')}</tr>
          `).join('') : `<tr><td colspan="${Math.max(1, (table.columns || []).length)}">${safeHtml(table.emptyText || 'No records')}</td></tr>`}
        </tbody>
      </table>
    </div>
  `).join('');
}

export function openBrandedPrintWindow({
  title = 'Document',
  subtitle = '',
  badges = [],
  summaryCards = [],
  sections = [],
  tables = [],
  htmlContent = '',
  footerNote = '',
  autoPrint = true,
}) {
  if (typeof window === 'undefined') return;
  const cfg = getAppConfig();
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) return;

  const contactItems = [cfg.companyPhone || '', cfg.companyEmail || '', cfg.defaultEmailFrom || ''].filter(Boolean);
  const body = `
    <div class="sheet">
      <div class="brand">
        <div class="brand-left">
          <img src="/logo512.png" alt="${safeHtml(cfg.appName || 'smBank')}" class="logo" />
          <div>
            <div class="app-name">${safeHtml(cfg.appName || 'smBank')}</div>
            <div class="app-subtitle">${safeHtml(subtitle || footerNote || 'Generated system document')}</div>
            ${contactItems.length ? `<div class="contact-line">${contactItems.map((item) => safeHtml(item)).join(' | ')}</div>` : ''}
          </div>
        </div>
        <div class="generated-at">Generated ${safeHtml(new Date().toLocaleString())}</div>
      </div>
      <div class="body">
        <div class="hero">
          <div>
            <div class="title">${safeHtml(title)}</div>
            ${badges.length ? `<div class="badges">${badges.map((item) => `<span class="badge">${safeHtml(item)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        ${renderSummaryCards(summaryCards)}
        ${renderSections(sections)}
        ${renderTables(tables)}
        ${htmlContent ? `<div class="section doc-html">${htmlContent}</div>` : ''}
        <div class="footer">${safeHtml(cfg.footerText || '© smBank')}</div>
      </div>
    </div>
  `;

  popup.document.open();
  popup.document.write(`<!doctype html>
<html>
  <head>
    <title>${safeHtml(title)} - ${safeHtml(cfg.appName || 'smBank')}</title>
    <meta charset="utf-8" />
    <base href="${safeHtml(window.location.origin)}/" />
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
      .sheet { background: #ffffff; border: 1px solid #dbe2ea; border-radius: 20px; overflow: hidden; }
      .brand { background: linear-gradient(135deg, ${safeHtml(cfg.primary || '#0f172a')}, #1d4ed8); color: ${safeHtml(cfg.primaryContrast || '#ffffff')}; padding: 22px 24px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
      .brand-left { display: flex; align-items: center; gap: 14px; }
      .logo { width: 58px; height: 58px; border-radius: 14px; background: rgba(255,255,255,0.14); padding: 6px; object-fit: contain; }
      .app-name { font-size: 28px; font-weight: 800; }
      .app-subtitle, .generated-at { font-size: 13px; opacity: 0.92; }
      .contact-line { font-size: 12px; margin-top: 6px; opacity: 0.95; }
      .body { padding: 24px; display: grid; gap: 18px; }
      .title { font-size: 30px; font-weight: 800; margin-bottom: 10px; }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; }
      .badge { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #eff6ff; color: #1d4ed8; }
      .summary-grid, .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .summary-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
      .summary-card, .detail-item { border: 1px solid #dbe2ea; border-radius: 14px; padding: 14px; background: linear-gradient(180deg, #ffffff, #f8fafc); }
      .summary-label, .detail-label { color: #64748b; font-size: 12px; margin-bottom: 6px; }
      .summary-value { font-size: 18px; font-weight: 800; }
      .detail-value { font-size: 15px; font-weight: 600; word-break: break-word; }
      .section { display: grid; gap: 12px; }
      .section-title { font-size: 16px; font-weight: 800; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; }
      th, td { border-bottom: 1px solid #dbe2ea; padding: 10px 12px; text-align: left; font-size: 13px; }
      th { background: #f1f5f9; }
      .doc-html { line-height: 1.55; }
      .doc-html h1, .doc-html h2, .doc-html h3, .doc-html h4 { margin: 0 0 10px; }
      .doc-html p, .doc-html ul, .doc-html ol { margin: 0 0 10px; }
      .doc-html table { margin-top: 8px; }
      .doc-html code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; }
      .footer { text-align: right; color: #64748b; font-size: 12px; margin-top: 8px; }
      @media print {
        body { padding: 0; background: #ffffff; }
        .sheet { border: 0; border-radius: 0; }
      }
    </style>
  </head>
  <body>${body}${autoPrint ? '<script>(function(){ var printed = false; function runPrint(){ if (printed) return; printed = true; setTimeout(function(){ try { window.focus(); window.print(); } catch (e) {} }, 250); } if (document.readyState === "complete") runPrint(); else window.addEventListener("load", runPrint, { once: true }); setTimeout(runPrint, 700); })();</script>' : ''}</body>
</html>`);
  popup.document.close();
  try { popup.focus(); } catch {}
  return popup;
}
