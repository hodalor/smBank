import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { directoryLookup, listClients, listPostedTransactions } from '../api';
import { displayUserName, hasPermission, PERMISSIONS } from '../state/ops';
import { showError, showWarning } from '../components/Toaster';
import Pager from '../components/Pager';
import { IconSearch, IconDownload, IconX, IconFile } from '../components/Icons';
import { openBrandedPrintWindow } from '../utils/printLayouts';
import { downloadCsvFile } from '../utils/downloads';

function toCurrency(n) {
  const num = Number(n || 0);
  return num.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });
}

export default function Statements() {
  const [accountNumber, setAccountNumber] = useState('');
  const [txnId, setTxnId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [client, setClient] = useState(null);
  const location = useLocation();
  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const acct = sp.get('accountNumber') || '';
      if (acct) setAccountNumber(acct);
    } catch {}
  }, [location.search]);

  const [postedTx, setPostedTx] = useState([]);
  useEffect(() => {
    const run = async () => {
      try {
        const q = {};
        if (accountNumber) q.accountNumber = accountNumber;
        if (startDate) q.from = startDate;
        if (endDate) q.to = endDate;
        if (txnId) q.id = txnId.trim();
        const tx = await listPostedTransactions(q);
        // Only include deposits and withdrawals for main account statements
        setPostedTx(tx.filter(p => p.kind === 'deposit' || p.kind === 'withdraw'));
      } catch {
        setPostedTx([]);
      }
    };
    run();
  }, [accountNumber, startDate, endDate, txnId]);

  const postedTransactions = useMemo(() => {
    return postedTx.map(p => {
      const type = p.kind === 'deposit' ? 'Deposit' : 'Withdrawal';
      const notes = p.meta?.notes || '';
      return {
        id: p.id,
        account: p.accountNumber,
        type,
        amount: p.amount,
        date: p.approvedAt,
        initiator: displayUserName(p.initiatorName) || '',
        approver: displayUserName(p.approverName) || '',
        notes
      };
    });
  }, [postedTx]);

  const rows = useMemo(() => {
    const combined = [...postedTransactions];
    return combined.filter(t => {
      if (txnId && !String(t.id || '').includes(txnId.trim())) return false;
      if (accountNumber && t.account !== accountNumber) return false;
      if (typeFilter !== 'All' && t.type !== typeFilter) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [postedTransactions, accountNumber, startDate, endDate, typeFilter, txnId]);

  const balance = useMemo(() => {
    return rows.reduce((acc, t) => {
      if (t.type === 'Deposit') return acc + t.amount;
      if (t.type === 'Withdrawal') return acc - t.amount;
      return acc;
    }, 0);
  }, [rows]);

  const downloadCSV = (filename, tableRows, header) => {
    downloadCsvFile(filename, header, tableRows);
  };

  const printTables = () => {
    openBrandedPrintWindow({
      title: `Account Statement ${accountNumber || ''}`.trim(),
      subtitle: 'Savings statement',
      badges: [accountNumber ? `Account ${accountNumber}` : '', startDate ? `From ${startDate}` : '', endDate ? `To ${endDate}` : ''].filter(Boolean),
      summaryCards: [
        { label: 'Customer', value: client?.name || '—' },
        { label: 'Current Balance', value: toCurrency(balance) },
        { label: 'Rows', value: String(rows.length) },
      ],
      sections: client ? [{
        title: 'Customer Details',
        rows: [
          ['Name', client.name || '—'],
          ['National ID', client.nationalId || '—'],
          ['Date of Birth', client.dob || '—'],
          ['Phone', client.phone || '—'],
        ],
      }] : [],
      tables: [{
        title: 'Transactions',
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'date', label: 'Date' },
          { key: 'initiator', label: 'Initiator' },
          { key: 'approver', label: 'Approver' },
          { key: 'notes', label: 'Notes' },
        ],
        rows: rows.map((r) => ({ ...r, amount: toCurrency(r.amount) })),
        emptyText: 'No statement transactions found.',
      }],
    });
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  if (!hasPermission(PERMISSIONS.STATEMENTS_VIEW)) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <div className="dashboard-header">
        <div>
          <h1>Statements</h1>
          <div className="dashboard-subtitle">Preview account activity and export a branded statement with company letterhead.</div>
        </div>
      </div>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <label>
          Account Number
          <div className="row">
            <input className="input" placeholder="Account / Name / ID" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            <button className="btn" type="button" onClick={() => {
              const q = accountNumber.trim();
              if (/^\\d{10}$/.test(q)) {
                directoryLookup(q).then(c => { setClient(c); }).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
              } else {
                listClients({ q }).then(list => {
                  if (list && list.length) {
                    setAccountNumber(list[0].accountNumber);
                    directoryLookup(list[0].accountNumber).then(c => setClient(c)).catch((e) => { setClient(null); if (e && e.status === 404) showError('Account not found'); else showError('Lookup failed'); });
                  }
                  else showWarning('No matching client found');
                }).catch(() => { showError('Lookup failed'); });
              }
            }}><IconSearch /><span>Lookup</span></button>
          </div>
        </label>
        <label>
          Transaction ID
          <input className="input" placeholder="e.g. TX-000000000001 / D-... / W-..." value={txnId} onChange={(e) => setTxnId(e.target.value)} />
        </label>
        {client && (
          <div className="row" style={{ gap: 24 }}>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Name</div><div>{client.name}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>National ID</div><div>{client.nationalId}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>DOB</div><div>{client.dob}</div></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Phone</div><div>{client.phone}</div></div>
          </div>
        )}
        <div className="form-grid">
          <label>
            Start Date
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            Type
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option>All</option>
              <option>Deposit</option>
              <option>Withdrawal</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setAccountNumber(accountNumber)}><IconDownload /><span>Load</span></button>
          <button className="btn" onClick={() => { setAccountNumber(''); }}><IconX /><span>Clear</span></button>
        </div>
      </div>

      <div className="card client-sheet">
        <div className="client-sheet-brand">
          <div className="client-sheet-branding">
            <img src="/logo512.png" alt="smBank" className="client-sheet-logo" />
            <div>
              <div className="client-sheet-brand-title">Statement Preview</div>
              <div className="client-sheet-brand-subtitle">{accountNumber ? `Account ${accountNumber}` : 'Select an account to preview'}</div>
            </div>
          </div>
          <div className="client-sheet-muted">{startDate || endDate ? `${startDate || 'Start'} to ${endDate || 'Today'}` : 'All available dates'}</div>
        </div>
        <div className="client-sheet-body">
          <div className="client-sheet-summary">
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Customer</div><div className="client-sheet-stat-value">{client?.name || '—'}</div></div>
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Current Balance</div><div className="client-sheet-stat-value">{toCurrency(balance)}</div></div>
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Rows</div><div className="client-sheet-stat-value">{rows.length}</div></div>
            <div className="client-sheet-stat"><div className="client-sheet-stat-label">Type Filter</div><div className="client-sheet-stat-value">{typeFilter}</div></div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => downloadCSV(`transactions_${accountNumber || 'all'}.csv`, rows, ['id','account','type','amount','date','initiator','approver','notes'])}><IconDownload /><span>Download CSV</span></button>
            <button className="btn btn-primary" onClick={printTables}><IconFile /><span>Download PDF</span></button>
          </div>
        </div>
      </div>

      <div id="printable-area" className="stack">
        <div className="card">
          <h3>Transactions</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Initiator</th>
                <th>Approver</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.type}</td>
                  <td>{toCurrency(r.amount)}</td>
                  <td>{r.date}</td>
                  <td>{r.initiator ?? r.by ?? ''}</td>
                  <td>{r.approver ?? ''}</td>
                  <td>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
        </div>

        {/* Loan repayments intentionally omitted from main account statements */}
      </div>
    </div>
  );
}
