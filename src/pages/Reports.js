import { useMemo, useState } from 'react';

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export default function Reports() {
  const [reportType, setReportType] = useState('All Clients');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const dataset = useMemo(() => ({
    clients: [
      { account: '4839201746', name: 'Jane Doe', nationalId: 'NID12345', loans: 1, balance: 1270 },
      { account: '7392046158', name: 'John Smith', nationalId: 'NID98765', loans: 0, balance: 200 }
    ],
    loans: [
      { id: 'LN-1001', account: '4839201746', client: 'Jane Doe', principal: 5000, status: 'Active', start: '2026-02-01', due: '2026-08-01', overdue: false, restructured: false, writtenOff: false },
      { id: 'LN-1002', account: '7392046158', client: 'John Smith', principal: 3000, status: 'Pending', start: '2026-03-01', due: '2026-07-01', overdue: false, restructured: false, writtenOff: false },
      { id: 'LN-1003', account: '4839201746', client: 'Jane Doe', principal: 1200, status: 'Written Off', start: '2025-11-10', due: '2026-01-10', overdue: true, restructured: false, writtenOff: true }
    ]
  }), []);

  const rows = useMemo(() => {
    if (reportType === 'All Clients') return dataset.clients;
    if (reportType === 'Clients With Loans') return dataset.clients.filter(c => c.loans > 0);
    if (reportType === 'Overdue Loans') return dataset.loans.filter(l => l.overdue && (!startDate || l.due >= startDate) && (!endDate || l.due <= endDate));
    if (reportType === 'Restructured Loans') return dataset.loans.filter(l => l.restructured);
    if (reportType === 'Written Off Loans') return dataset.loans.filter(l => l.writtenOff);
    return [];
  }, [dataset, reportType, startDate, endDate]);

  const downloadCSV = (filename, tableRows) => {
    let header = [];
    if (reportType.includes('Clients')) header = ['account', 'name', 'nationalId', 'loans', 'balance'];
    else header = ['id', 'account', 'client', 'principal', 'status', 'start', 'due'];
    const data = [header.join(',')].concat(tableRows.map(r => header.map(c => JSON.stringify(r[c] ?? '')).join(','))).join('\\n');
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTable = () => {
    const el = document.getElementById('report-table')?.outerHTML || '';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>Report</title>');
    w.document.write('<style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f1f5f9}</style>');
    w.document.write('</head><body>');
    w.document.write(`<h2>${reportType}</h2>`);
    w.document.write(el);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  return (
    <div className="stack">
      <h1>Reports</h1>
      <div className="card">
        <div className="form-grid">
          <label>
            Report Type
            <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option>All Clients</option>
              <option>Clients With Loans</option>
              <option>Overdue Loans</option>
              <option>Restructured Loans</option>
              <option>Written Off Loans</option>
            </select>
          </label>
          <label>
            Start Date
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={() => downloadCSV(reportType.replace(/\\s+/g,'_'), rows)}>Download CSV</button>
          <button className="btn" onClick={printTable}>Download PDF</button>
        </div>
      </div>
      <div className="card">
        <table id="report-table" className="table">
          <thead>
            {reportType.includes('Clients') ? (
              <tr>
                <th>Account</th>
                <th>Name</th>
                <th>National ID</th>
                <th>Loans</th>
                <th>Balance</th>
              </tr>
            ) : (
              <tr>
                <th>Loan ID</th>
                <th>Account</th>
                <th>Client</th>
                <th>Principal</th>
                <th>Status</th>
                <th>Start</th>
                <th>Due</th>
              </tr>
            )}
          </thead>
          <tbody>
            {reportType.includes('Clients') ? (
              rows.map(r => (
                <tr key={r.account}>
                  <td>{r.account}</td>
                  <td>{r.name}</td>
                  <td>{r.nationalId}</td>
                  <td>{r.loans}</td>
                  <td>{gh(r.balance)}</td>
                </tr>
              ))
            ) : (
              rows.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.account}</td>
                  <td>{r.client}</td>
                  <td>{gh(r.principal)}</td>
                  <td>{r.status}</td>
                  <td>{r.start}</td>
                  <td>{r.due}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
