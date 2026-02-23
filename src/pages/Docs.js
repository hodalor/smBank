import { useEffect } from 'react';
import { fetchConfig } from '../api';
import { getAppConfig, onConfigUpdate } from '../state/ops';
import { useState } from 'react';

export default function Docs() {
  const [cfg, setCfg] = useState(getAppConfig());
  useEffect(() => onConfigUpdate(setCfg), []);
  useEffect(() => { fetchConfig().then(setCfg).catch(() => {}); }, []);
  const onPrint = () => window.print();
  const now = new Date().toLocaleString();
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <style>
        {`
        @media print {
          .sidebar, .topbar, .loading-host, .app-footer { display: none !important; }
          .content { margin: 0 !important; padding: 0 !important; }
          .print-hide { display: none !important; }
          .doc h1 { page-break-before: auto; }
          .doc h2 { page-break-after: avoid; }
          .doc section { page-break-inside: avoid; }
        }
        .doc h1 { margin: 0 0 6px 0; }
        .doc h2 { margin-top: 20px; }
        .doc code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; }
        .doc table { width: 100%; border-collapse: collapse; }
        .doc th, .doc td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
        .doc .kbd { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        `}
      </style>
      <div className="row print-hide" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>System Documentation</h1>
        <button className="btn btn-primary" onClick={onPrint}>Download PDF</button>
      </div>
      <div style={{ color: '#64748b', marginTop: -6 }} className="print-hide">Generated: {now}</div>
      <div className="doc stack card" style={{ padding: 16 }}>
        <h1>{cfg.appName || 'smBank'} — Product Manual</h1>
        <div style={{ color: '#64748b' }}>This manual describes the architecture, configuration, APIs, and UI of the system.</div>

        <h2>Overview</h2>
        <ul>
          <li>Frontend: React (Create React App) single-page app; API base: <span className="kbd">{process.env.REACT_APP_API_URL || 'http://localhost:5000'}</span></li>
          <li>Backend: Node.js + Express with optional MongoDB; falls back to JSON file-store when DB is unavailable</li>
          <li>Realtime: Socket.IO server emits basic status events</li>
          <li>Auth: HMAC token; Authorization: Bearer; role-based permissions enforced in UI</li>
        </ul>

        <h2>Roles & Permissions</h2>
        <ul>
          <li>Permissions are mapped per role; UI hides or disables features accordingly</li>
          <li>Top-level page guards and action-level checks are implemented throughout</li>
          <li>Users page allows Admin/Super Admin to manage users; non-admins have restricted visibility</li>
        </ul>

        <h2>Key Frontend Features</h2>
        <ul>
          <li>Clients: search, create, update; account numbers use bank+branch+type+serial format</li>
          <li>Transactions: deposits/withdrawals with approvals; statements and records</li>
          <li>Loans: create, approve, list, details; repayments with approvals and statements</li>
          <li>Notifications: promotions (SMS/email), logs and resend; media upload to cloud storage</li>
          <li>Administration: users, config, assets registry, activity and server logs, Super Bin</li>
          <li>Security UX: route guard, idle auto-logout, login captcha auto-refresh</li>
        </ul>

        <h2>Configuration</h2>
        <p>Configuration is editable in the Config page and/or via environment variables. Important fields:</p>
        <ul>
          <li>Branding: appName, footerText, colors, darkMode</li>
          <li>Loans: defaultLoanRate, serviceFeeRate, adminFeeRate, commitmentFeeRate</li>
          <li>Overdue: loanOverdueGraceDays, loanOverdueDailyPenaltyRate</li>
          <li>Banking: bankCode, branches, accountTypes, lastCustomerSerial</li>
          <li>Messaging defaults: smsSenderIds, defaultSmsSenderId, emailFromAddresses, defaultEmailFrom</li>
        </ul>

        <h2>Backend Environment</h2>
        <p>Common variables used by the API:</p>
        <div className="card">
          <table>
            <thead><tr><th>Variable</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>PORT</td><td>HTTP port for API (default 5000)</td></tr>
              <tr><td>MONGODB_URI</td><td>MongoDB connection; enables DB-backed mode</td></tr>
              <tr><td>JWT_SECRET</td><td>Secret for HMAC token signing</td></tr>
              <tr><td>CORS_ORIGIN</td><td>Allowed origins (comma-separated)</td></tr>
              <tr><td>SEED_SUPER_USERNAME / SEED_SUPER_PASSWORD</td><td>Bootstrap Super Admin when DB is available</td></tr>
              <tr><td>ALLOW_ADMIN_TOOLS</td><td>Enables env-based login fallback when STRICT_AUTH is true and DB offline</td></tr>
              <tr><td>STRICT_AUTH</td><td>Force DB-backed login only</td></tr>
              <tr><td>SMS_PROVIDER</td><td>Currently supports 'twilio'</td></tr>
              <tr><td>TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN</td><td>Twilio credentials</td></tr>
              <tr><td>TWILIO_MESSAGING_SERVICE_SID</td><td>Optional Twilio messaging service</td></tr>
              <tr><td>SMS_SENDER_ID / TWILIO_FROM</td><td>Alphanumeric or number sender fallback</td></tr>
              <tr><td>SMS_DEFAULT_COUNTRY_CODE</td><td>E.g., 233</td></tr>
              <tr><td>SMTP_HOST / SMTP_PORT / SMTP_SECURE</td><td>SMTP server config</td></tr>
              <tr><td>SMTP_USER / SMTP_PASS</td><td>SMTP credentials</td></tr>
              <tr><td>EMAIL_FROM</td><td>Default email sender when not overridden</td></tr>
              <tr><td>FB_PROJECT_ID / FB_CLIENT_EMAIL / FB_PRIVATE_KEY / FB_STORAGE_BUCKET</td><td>Firebase Storage upload config</td></tr>
            </tbody>
          </table>
        </div>

        <h2>API Endpoints (Summary)</h2>
        <ul>
          <li>Auth: POST /auth/login</li>
          <li>Users: GET/POST /users, POST /users/:username/password, POST /users/:username/password/reset, POST /users/:username/enable, POST /users/:username/disable</li>
          <li>Clients: GET/POST /clients, GET/POST /clients/:id, GET /directory/:accountNumber</li>
          <li>Transactions: POST /transactions/deposit, POST /transactions/withdraw; approvals and records endpoints</li>
          <li>Loans: GET/POST /loans, POST /loans/:id/approve|reject; repayments: POST /loans/repay, approvals</li>
          <li>Media: POST /media/upload (multipart) → public URL; optional entity linking</li>
          <li>Notifications: test sends; promotions for SMS and email; logs and resend</li>
          <li>Observability: GET /activity, GET /server-logs</li>
          <li>Super Bin: list, restore, delete</li>
          <li>Assets Registry: list, create, update status/assignee</li>
        </ul>

        <h2>Data & Numbering</h2>
        <ul>
          <li>Accounts: 13 digits: 2 bank + 3 branch + 2 type + 6 serial</li>
          <li>Serial is DB-backed when available; otherwise persisted to file store</li>
          <li>Statements and balances exclude loan disbursements from deposit/withdraw totals</li>
        </ul>

        <h2>Security & Policies</h2>
        <ul>
          <li>Passwords expire every 30 days with grace; must-change flows enforced</li>
          <li>Auto-disable users at contract end; logs an audit event</li>
          <li>Dormancy: automated sweep marks accounts dormant after 90 days inactivity</li>
          <li>Frontend auto-logout after prolonged inactivity</li>
        </ul>

        <h2>Build & Deploy</h2>
        <ul>
          <li>Frontend: Netlify (netlify.toml sets base, publish, and NODE_VERSION)</li>
          <li>Backend: Render or Node host; engines pinned to Node 18–22</li>
          <li>Set REACT_APP_API_URL for the frontend to point at your backend</li>
        </ul>

        <h2>Using This Manual</h2>
        <ul>
          <li>Click “Download PDF” to export this page to PDF with a printable layout</li>
          <li>Sections with tables are formatted for A4 portrait printing</li>
          <li>Dynamic values (like app name and currency examples) are drawn from the app’s current config</li>
        </ul>

        <h2>User Manual (Easy Steps)</h2>
        <section>
          <h3>Getting Started</h3>
          <ol>
            <li>Open the app and log in with your username and password.</li>
            <li>Type the four‑letter captcha exactly as shown. Click the image to refresh it.</li>
            <li>If your password is expired, follow the on‑screen steps to change it.</li>
            <li>If you forget your password, ask an Admin for the daily approval code and use “Reset Password (Admin)” on the login page.</li>
          </ol>
          <div style={{ color: '#64748b' }}>Tip: The system logs you out after a few minutes of no mouse movement for safety. Just log in again.</div>
        </section>

        <section>
          <h3>My Account</h3>
          <ul>
            <li>Open My Account from the sidebar.</li>
            <li>Change your password any time. Use at least 10 characters with upper, lower, number, and special characters.</li>
            <li>If an Admin reset your password with an approval code, you will be asked to set your own password after login.</li>
          </ul>
        </section>

        <section>
          <h3>Clients</h3>
          <p>Find and manage customer accounts.</p>
          <h4>Search</h4>
          <ul>
            <li>Select search type: Account Number (10 digits), Name, or National ID.</li>
            <li>Enter a value and click Search. If you leave it empty, the system lists recent clients.</li>
            <li>Open a client using the Open button.</li>
          </ul>
          <h4>Create a New Client</h4>
          <ol>
            <li>Click “New Client”.</li>
            <li>Select Branch and Account Type.</li>
            <li>If Individual: enter Full Name, National ID/Passport, Date of Birth, Phone, Email, Address. You can upload a photo and ID images later.</li>
            <li>If Company: enter Company Name, Registration Number and Date, Addresses, and Contact Person details.</li>
            <li>Save. An account number is generated (bank + branch + type + serial).</li>
            <li>Optional: Upload KYC documents (ID Front, ID Back, Signature) and a photo.</li>
          </ol>
          <h4>Manage an Existing Client</h4>
          <ul>
            <li>Open the client profile to view account number, branch, type, and status.</li>
            <li>Change Status (Active, Inactive, Dormant, NDS). Remarks are required and saved in history.</li>
            <li>If you have permission, assign or reassign an Account Manager with remarks. History is kept.</li>
            <li>Quick Actions: “View Statement” opens statements for the account.</li>
          </ul>
        </section>

        <section>
          <h3>Lookup an Account</h3>
          <p>You can type an Account Number (10 digits), Name, or ID in places like Deposit, Withdraw, and Statements:</p>
          <ul>
            <li>If you enter 10 digits, the system loads that exact account.</li>
            <li>Otherwise, the system searches by name or ID and picks the best match. You can adjust the field and search again.</li>
          </ul>
        </section>

        <section>
          <h3>Make a Deposit</h3>
          <ol>
            <li>Open Deposit. Enter Account Number, Name, or ID and click Lookup.</li>
            <li>Check the client info and Account Status. Deposits aren’t allowed into Inactive accounts.</li>
            <li>Enter Depositor Name, Address, Source of Income, and Amount.</li>
            <li>Select Payment Method (cash, mobile, bank) and add notes if needed.</li>
            <li>Submit for approval. An authorizer reviews and posts the transaction.</li>
          </ol>
          <div style={{ color: '#64748b' }}>Note: The account balance shown on the page excludes loan transactions; it reflects deposits and withdrawals only.</div>
        </section>

        <section>
          <h3>Make a Withdrawal</h3>
          <ol>
            <li>Open Withdraw. Enter Account Number, Name, or ID and click Lookup.</li>
            <li>Confirm Account Status is Active and not NDS (Non‑Debit).</li>
            <li>Enter Amount. The page shows any withdrawal fee and Total Deduct.</li>
            <li>Enter the withdrawer’s ID number, phone, and address.</li>
            <li>Submit for approval. An authorizer reviews and posts the transaction.</li>
          </ol>
          <div style={{ color: '#64748b' }}>If Total Deduct is more than the available balance, reduce the amount or wait for a new deposit.</div>
        </section>

        <section>
          <h3>Transaction Approvals</h3>
          <ul>
            <li>Open Txn Approvals to see pending deposits and withdrawals.</li>
            <li>Review details, then Approve or Reject. Approved items appear in Statements.</li>
          </ul>
        </section>

        <section>
          <h3>Statements</h3>
          <ol>
            <li>Open Statements. Enter Account Number, Name, or ID and click Lookup.</li>
            <li>Filter by Transaction ID, Type (Deposit/Withdrawal), and Date range.</li>
            <li>Download CSV or “Download PDF” for printing.</li>
          </ol>
          <div style={{ color: '#64748b' }}>The balance on this page sums deposits minus withdrawals for the selected filters.</div>
        </section>

        <section>
          <h3>Loans</h3>
          <ul>
            <li>Open Loans to view or create loans (if you have permission).</li>
            <li>Approvals and Repayments have their own pages (Approvals, Repayment Records, Repay Loan).</li>
            <li>Loan statements show due dates, grace days, penalties, and outstanding amounts.</li>
          </ul>
        </section>

        <section>
          <h3>Promotions & Notifications</h3>
          <ul>
            <li>Promotions: send SMS or Email to many customers. Choose sender ID or From address when allowed.</li>
            <li>Notifications: see all sent messages, filter, and resend if needed.</li>
          </ul>
        </section>

        <section>
          <h3>Media Upload</h3>
          <ul>
            <li>Upload files like photos or documents. When linked to a client or a loan, the file is stored with that record.</li>
          </ul>
        </section>

        <section>
          <h3>Assets Registry</h3>
          <ul>
            <li>Register assets, update status (e.g., In Use, Maintenance), and assign to people.</li>
            <li>Each change is logged with remarks for a clear history.</li>
          </ul>
        </section>

        <section>
          <h3>Activity & Server Logs</h3>
          <ul>
            <li>Activity: audit trail for important actions like login, user changes, clients, transactions, loans.</li>
            <li>Server Logs: detailed request and error logs for Admins only.</li>
          </ul>
        </section>

        <section>
          <h3>Users & Roles</h3>
          <ul>
            <li>Users page lets Admins create users, reset passwords with an approval code, and enable/disable accounts.</li>
            <li>You can view users at or below your role in the hierarchy.</li>
          </ul>
        </section>

        <section>
          <h3>Config</h3>
          <ul>
            <li>Admins can change branding, branches, account types, numbering serials, loan and penalty settings.</li>
            <li>Messaging defaults control which sender IDs or From addresses are used when you don’t pick one.</li>
          </ul>
        </section>

        <section>
          <h3>Trash & Recovery (Super Bin)</h3>
          <ul>
            <li>Deleted items can be reviewed and restored by privileged users.</li>
          </ul>
        </section>

        <section>
          <h3>Helpful Tips</h3>
          <ul>
            <li>Use the menu button to show or hide the sidebar. On phones and tablets, it slides in as a drawer.</li>
            <li>If you see “Not authorized”, ask an Admin to grant the right permissions for your role.</li>
            <li>Keep remarks clear when changing statuses or assigning managers. It helps with audits.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
