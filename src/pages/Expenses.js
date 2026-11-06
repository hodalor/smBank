import { useEffect, useMemo, useState } from 'react';
import { canExpenseAction, displayUserName, getCurrentUser, getExpenseGrades, getRoles, hasPermission, PERMISSIONS, saveAppConfig } from '../state/ops';
import { approveExpense, createExpense, fetchConfig, listExpenses, payExpense, rejectExpense, updateConfig } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';
import { confirm, prompt } from '../components/Confirm';
import Pager from '../components/Pager';
import Modal from '../components/Modal';
import { IconCheck, IconDownload, IconFile, IconPlus, IconSave, IconSend, IconX } from '../components/Icons';
import { downloadCsvFile } from '../utils/downloads';
import { openBrandedPrintWindow } from '../utils/printLayouts';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TABS = ['Pending', 'Approved', 'Paid', 'Rejected'];
const blankForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  description: '',
  voucherNo: '',
  amount: '',
  remarks: '',
});

function statusStyle(status) {
  if (status === 'Approved' || status === 'Paid') return { background: '#dcfce7', color: '#0f172a' };
  if (status === 'Rejected') return { background: '#fee2e2', color: '#0f172a' };
  return { background: '#e2e8f0', color: '#0f172a' };
}

export default function Expenses() {
  const canView = canExpenseAction('view');
  const canCreate = canExpenseAction('create');
  const canApprove = canExpenseAction('approve');
  const canPay = canExpenseAction('pay');
  const canAssignGrades = hasPermission(PERMISSIONS.USERS_MANAGE) || hasPermission(PERMISSIONS.CONFIG_MANAGE);
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState('Pending');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [grades, setGrades] = useState(getExpenseGrades());
  const roles = Object.values(getRoles());

  const load = async () => {
    try {
      const list = await listExpenses({ status: tab, month, year });
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    if (!canView) return;
    fetchConfig().then((c) => {
      setCfg(c);
      saveAppConfig(c);
      setGrades(getExpenseGrades(c));
    }).catch(() => {});
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    load();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, tab, month, year]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      showError('Not authorized to create expenses');
      return;
    }
    if (!form.description.trim() || !form.amount) {
      showWarning('Enter description and amount');
      return;
    }
    try {
      await createExpense({
        date: form.date,
        description: form.description.trim(),
        voucherNo: form.voucherNo.trim(),
        amount: Number(form.amount),
        remarks: form.remarks.trim(),
      });
      showSuccess('Expense submitted for approval');
      setForm(blankForm());
      setOpen(false);
      await load();
    } catch (err) {
      showError(err.message || 'Failed to create expense');
    }
  };

  const approve = async (row, e) => {
    if (e) e.stopPropagation();
    try {
      await approveExpense(row.id);
      showSuccess('Expense approved');
      setSelected(null);
      await load();
    } catch (err) {
      showError(err.message || 'Failed to approve');
    }
  };
  const reject = async (row, e) => {
    if (e) e.stopPropagation();
    const remarks = await prompt('Reason for rejection (optional)', {
      title: 'Reject Expense',
      placeholder: 'Remarks',
      confirmText: 'Reject',
    });
    if (remarks == null) return;
    try {
      await rejectExpense(row.id, { remarks: String(remarks || '').trim() });
      showSuccess('Expense rejected');
      setSelected(null);
      await load();
    } catch (err) {
      showError(err.message || 'Failed to reject');
    }
  };
  const markPaid = async (row, e) => {
    if (e) e.stopPropagation();
    const ok = await confirm('Mark this expense as paid?', { title: 'Mark Paid', confirmText: 'Mark Paid' });
    if (!ok) return;
    try {
      await payExpense(row.id);
      showSuccess('Expense marked as paid');
      setSelected(null);
      await load();
    } catch (err) {
      showError(err.message || 'Failed to mark as paid');
    }
  };
  const toggleGrade = (action, role) => {
    setGrades((prev) => {
      const list = new Set(prev[action] || []);
      if (list.has(role)) list.delete(role);
      else list.add(role);
      return { ...prev, [action]: Array.from(list) };
    });
  };
  const saveGrades = async () => {
    try {
      const next = { ...(cfg || {}), expenseGrades: grades };
      const saved = await updateConfig(next);
      setCfg(saved);
      saveAppConfig(saved);
      showSuccess('Expense grades saved');
    } catch (err) {
      showError(err.message || 'Failed to save grades');
    }
  };

  const filtered = rows;
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const totalAmount = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(y - i));
  }, []);

  const exportRows = filtered.map((r) => ({
    date: String(r.date || '').slice(0, 10),
    description: r.description || '',
    voucherNo: r.voucherNo || '',
    amount: gh(r.amount),
    approvedBy: displayUserName(r.approvedBy) || '',
    paidBy: displayUserName(r.paidBy) || '',
    rejectedBy: displayUserName(r.rejectedBy) || '',
    remarks: r.remarks || '',
    status: r.status || '',
  }));
  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'description', label: 'Expense Description' },
    { key: 'voucherNo', label: 'Voucher / Ref. No.' },
    { key: 'amount', label: 'Amount (GH₵)' },
    { key: 'approvedBy', label: 'Approved By' },
    { key: 'paidBy', label: 'Paid By' },
    { key: 'rejectedBy', label: 'Rejected By' },
    { key: 'remarks', label: 'Remarks' },
    { key: 'status', label: 'Status' },
  ];
  const downloadCSV = () => downloadCsvFile(`expenses_${tab.toLowerCase()}.csv`, exportCols.map((c) => c.key), exportRows);
  const exportPdf = () => {
    openBrandedPrintWindow({
      title: 'Bank Expenses Register',
      subtitle: `${tab} expenses`,
      summaryCards: [
        { label: 'Status', value: tab },
        { label: 'Rows', value: String(filtered.length) },
        { label: 'Total', value: gh(totalAmount) },
      ],
      tables: [{ title: `${tab} Expenses`, columns: exportCols, rows: exportRows, emptyText: 'No expenses.' }],
    });
  };

  const tabLabel = (name) => (name === 'Pending' ? 'Pending Approval' : name);
  const actionsFor = (row) => (
    <div className="row" style={{ gap: 6 }}>
      {row.status === 'Pending' && canApprove && (
        <>
          <button className="btn btn-primary" type="button" onClick={(e) => approve(row, e)}><IconCheck /><span>Approve</span></button>
          <button className="btn" type="button" onClick={(e) => reject(row, e)}><IconX /><span>Reject</span></button>
        </>
      )}
      {row.status === 'Approved' && canPay && (
        <button className="btn btn-primary" type="button" onClick={(e) => markPaid(row, e)}><IconSend /><span>Mark Paid</span></button>
      )}
    </div>
  );

  if (!canView) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Bank Expenses Register</h1>
          <div className="dashboard-subtitle">Track pending, approved and paid expenses.</div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={exportPdf}><IconFile /><span>Export PDF</span></button>
          <button className="btn" type="button" onClick={downloadCSV}><IconDownload /><span>Export CSV</span></button>
          {canCreate && (
            <button className="btn btn-primary" type="button" onClick={() => { setForm(blankForm()); setOpen(true); }}>
              <IconPlus /><span>Add Expense</span>
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label>
            Month
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All months</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
          </label>
          <label>
            Year
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div>
            <div className="dashboard-subtitle">Currency</div>
            <div style={{ fontWeight: 700, paddingTop: 8 }}>GH₵</div>
          </div>
          <div>
            <div className="dashboard-subtitle">{tabLabel(tab)} total</div>
            <div style={{ fontWeight: 700, paddingTop: 8 }}>{gh(totalAmount)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="page-tabs">
          {TABS.map((name) => (
            <button key={name} type="button" className={`page-tab${tab === name ? ' active' : ''}`} onClick={() => setTab(name)}>
              {tabLabel(name)}
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense Description</th>
                <th>Voucher / Ref. No.</th>
                <th>Amount (GH₵)</th>
                <th>Approved By</th>
                <th>Paid By</th>
                <th>Remarks</th>
                {(canApprove || canPay) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                  <td>{String(r.date || '').slice(0, 10) || '—'}</td>
                  <td>{r.description}</td>
                  <td>{r.voucherNo || '—'}</td>
                  <td>{gh(r.amount)}</td>
                  <td>{displayUserName(r.approvedBy) || '—'}</td>
                  <td>{displayUserName(r.paidBy) || '—'}</td>
                  <td>{r.remarks || '—'}</td>
                  {(canApprove || canPay) && (
                    <td onClick={(e) => e.stopPropagation()}>{actionsFor(r)}</td>
                  )}
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={canApprove || canPay ? 8 : 7}>No {tabLabel(tab).toLowerCase()} expenses.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
      </div>

      {canAssignGrades && (
        <div className="card">
          <h3>Assign grades</h3>
          <div className="dashboard-subtitle" style={{ marginBottom: 12 }}>Choose which staff grades can create, approve and pay expenses.</div>
          {['create', 'approve', 'pay'].map((action) => (
            <div key={action} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, textTransform: 'capitalize' }}>{action} expenses</div>
              <div className="row" style={{ gap: 12 }}>
                {roles.map((role) => {
                  const locked = role === 'Admin' || role === 'Super Admin';
                  return (
                    <label key={`${action}-${role}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={locked || (grades[action] || []).includes(role)}
                        disabled={locked}
                        onChange={() => toggleGrade(action, role)}
                      />
                      <span>{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="btn btn-primary" type="button" onClick={saveGrades}><IconSave /><span>Save grades</span></button>
        </div>
      )}

      <Modal open={open} title="New Expense" subtitle="Submitted expenses wait for approval" onClose={() => setOpen(false)}>
        <form className="form" onSubmit={submit}>
          <label>
            Date
            <input className="input" type="date" name="date" value={form.date} onChange={change} required />
          </label>
          <label>
            Expense Description
            <input className="input" name="description" value={form.description} onChange={change} placeholder="e.g. Renting of single room" required />
          </label>
          <label>
            Voucher / Ref. No.
            <input className="input" name="voucherNo" value={form.voucherNo} onChange={change} placeholder="Optional" />
          </label>
          <label>
            Amount (GH₵)
            <input className="input" type="number" name="amount" value={form.amount} onChange={change} required min="0" step="0.01" />
          </label>
          <label>
            Remarks
            <input className="input" name="remarks" value={form.remarks} onChange={change} placeholder="Optional" />
          </label>
          <div className="row">
            <button className="btn btn-primary" type="submit"><IconPlus /><span>Submit for Approval</span></button>
            <span style={{ color: '#64748b', fontSize: 13 }}>Created by {getCurrentUser().username || 'you'}</span>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        title="Expense Details"
        subtitle={selected ? `Ref: ${selected.voucherNo || selected.id}` : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="stack">
            <div className="detail-modal-grid">
              <div className="detail-modal-block">
                <div className="detail-modal-label">Status</div>
                <span className="detail-modal-pill" style={statusStyle(selected.status)}>{selected.status}</span>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Amount</div>
                <div className="detail-modal-value">{gh(selected.amount)}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Date</div>
                <div className="detail-modal-value">{String(selected.date || '').slice(0, 10) || '—'}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Voucher / Ref. No.</div>
                <div className="detail-modal-value">{selected.voucherNo || '—'}</div>
              </div>
            </div>
            <div className="detail-modal-notes">
              <div className="detail-modal-label">Expense Description</div>
              <div>{selected.description || '—'}</div>
            </div>
            <div className="detail-modal-grid">
              <div className="detail-modal-block">
                <div className="detail-modal-label">Created By</div>
                <div>{displayUserName(selected.createdBy) || '—'}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Approved By</div>
                <div>{displayUserName(selected.approvedBy) || '—'}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Paid By</div>
                <div>{displayUserName(selected.paidBy) || '—'}</div>
              </div>
              <div className="detail-modal-block">
                <div className="detail-modal-label">Rejected By</div>
                <div>{displayUserName(selected.rejectedBy) || '—'}</div>
              </div>
            </div>
            {(selected.remarks || selected.rejectRemarks) && (
              <div className="detail-modal-notes">
                {selected.remarks ? <div>Remarks: {selected.remarks}</div> : null}
                {selected.rejectRemarks ? <div>Reject reason: {selected.rejectRemarks}</div> : null}
              </div>
            )}
            {actionsFor(selected)}
          </div>
        )}
      </Modal>
    </div>
  );
}
