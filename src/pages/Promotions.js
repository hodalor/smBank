import { useEffect, useState } from 'react';
import { sendPromotions, sendTestSMS, fetchConfig, sendEmailPromotions, sendTestEmail, listUsers } from '../api';
import { showError, showSuccess, showWarning } from '../components/Toaster';
import { hasPermission, PERMISSIONS } from '../state/ops';

export default function Promotions() {
  const allowed = hasPermission(PERMISSIONS.NOTIFY_SEND);
  const [mode, setMode] = useState('all');
  const [channel, setChannel] = useState('sms');
  const [config, setConfig] = useState({ branches: [], accountTypes: [] });
  const [branchCode, setBranchCode] = useState('');
  const [accountTypeCode, setAccountTypeCode] = useState('');
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [activeStatus, setActiveStatus] = useState('');
  const [managers, setManagers] = useState([]);
  const [manager, setManager] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState('');
  const [sending, setSending] = useState(false);
  const [smsSenderId, setSmsSenderId] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  useEffect(() => {
    let mounted = true;
    fetchConfig().then(cfg => { if (mounted) setConfig(cfg || { branches: [], accountTypes: [] }); }).catch(() => {});
    listUsers().then(u => { if (mounted) setManagers(u || []); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  const tokens = numbersText.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  const emails = tokens.filter(t => /@/.test(t));
  const numbers = tokens.filter(t => !/@/.test(t));
  const recipientsCount = mode === 'all'
    ? 'All clients'
    : mode === 'filtered'
      ? `Filtered clients${(selectedBranches.length ? ` • Branches ${selectedBranches.join(',')}` : (branchCode ? ` • Branch ${branchCode}` : ''))}${(selectedTypes.length ? ` • Types ${selectedTypes.join(',')}` : (accountTypeCode ? ` • Type ${accountTypeCode}` : ''))}${activeStatus ? ` • ${activeStatus}` : ''}${manager ? ` • Mgr ${manager}` : ''}`
      : (channel === 'email' ? String(emails.length) : channel === 'sms' ? String(numbers.length) : String(tokens.length));
  const onPreview = () => {
    if (!message.trim()) { showWarning('Enter message'); return; }
    const sample = message.trim().slice(0, 160);
    setPreview(`${sample}${message.trim().length > 160 ? '…' : ''}`);
  };
  const onSend = async () => {
    try {
      if (!allowed) { showError('Not allowed'); return; }
      if (!message.trim()) { showWarning('Enter message'); return; }
      if ((channel === 'email' || channel === 'both') && !subject.trim()) { showWarning('Enter subject for email'); return; }
      setSending(true);
      if (mode === 'all') {
        if (channel === 'sms') {
          const r = await sendPromotions({ segment: 'all-clients', message: message.trim(), senderId: smsSenderId.trim() || undefined });
          showSuccess(`SMS: ${r.sent}/${r.recipients} sent, ${r.failed} failed`);
        } else if (channel === 'email') {
          const r = await sendEmailPromotions({ segment: 'all-clients', subject: subject.trim(), text: message.trim(), from: emailFrom.trim() || undefined });
          showSuccess(`Email: ${r.sent}/${r.recipients} sent, ${r.failed} failed`);
        } else {
          const r1 = await sendPromotions({ segment: 'all-clients', message: message.trim(), senderId: smsSenderId.trim() || undefined });
          const r2 = await sendEmailPromotions({ segment: 'all-clients', subject: subject.trim(), text: message.trim(), from: emailFrom.trim() || undefined });
          showSuccess(`SMS ${r1.sent}/${r1.recipients}; Email ${r2.sent}/${r2.recipients}`);
        }
      } else if (mode === 'filtered') {
        if (!selectedBranches.length && !selectedTypes.length && !manager && !activeStatus && !branchCode && !accountTypeCode) { showWarning('Select at least one filter'); setSending(false); return; }
        const filters = {};
        if (selectedBranches.length) filters.branchCodes = selectedBranches;
        else if (branchCode) filters.branchCode = branchCode;
        if (selectedTypes.length) filters.accountTypeCodes = selectedTypes;
        else if (accountTypeCode) filters.accountTypeCode = accountTypeCode;
        if (manager) filters.manager = manager;
        if (activeStatus) filters.activeStatus = activeStatus;
        if (channel === 'sms') {
          const r = await sendPromotions({ segment: 'filtered-clients', filters, message: message.trim(), senderId: smsSenderId.trim() || undefined });
          showSuccess(`SMS: ${r.sent}/${r.recipients} sent, ${r.failed} failed`);
        } else if (channel === 'email') {
          const r = await sendEmailPromotions({ segment: 'filtered-clients', filters, subject: subject.trim(), text: message.trim(), from: emailFrom.trim() || undefined });
          showSuccess(`Email: ${r.sent}/${r.recipients} sent, ${r.failed} failed`);
        } else {
          const r1 = await sendPromotions({ segment: 'filtered-clients', filters, message: message.trim(), senderId: smsSenderId.trim() || undefined });
          const r2 = await sendEmailPromotions({ segment: 'filtered-clients', filters, subject: subject.trim(), text: message.trim(), from: emailFrom.trim() || undefined });
          showSuccess(`SMS ${r1.sent}/${r1.recipients}; Email ${r2.sent}/${r2.recipients}`);
        }
      } else {
        if (tokens.length === 0) { showWarning('Paste numbers and/or emails'); setSending(false); return; }
        if (channel === 'sms') {
          if (numbers.length === 0) { showWarning('No phone numbers detected'); setSending(false); return; }
          const r = await sendPromotions({ numbers, message: message.trim(), senderId: smsSenderId.trim() || undefined });
          showSuccess(`SMS: ${r.sent}/${r.recipients} sent, ${r.failed} failed`);
        } else if (channel === 'email') {
          if (emails.length === 0) { showWarning('No emails detected'); setSending(false); return; }
          const r = await sendEmailPromotions({ emails, subject: subject.trim(), text: message.trim(), from: emailFrom.trim() || undefined });
          showSuccess(`Email: ${r.sent}/${r.recipients} sent, ${r.failed} failed`);
        } else {
          const actions = [];
          if (numbers.length) actions.push(sendPromotions({ numbers, message: message.trim(), senderId: smsSenderId.trim() || undefined }));
          if (emails.length) actions.push(sendEmailPromotions({ emails, subject: subject.trim(), text: message.trim(), from: emailFrom.trim() || undefined }));
          const [r1, r2] = await Promise.all(actions);
          const smsLine = r1 ? `SMS ${r1.sent}/${r1.recipients}` : 'SMS 0/0';
          const emailLine = r2 ? `Email ${r2.sent}/${r2.recipients}` : 'Email 0/0';
          showSuccess(`${smsLine}; ${emailLine}`);
        }
      }
      setMessage('');
      setNumbersText('');
      setSubject('');
      setPreview('');
      setBranchCode('');
      setAccountTypeCode('');
      setSelectedBranches([]);
      setSelectedTypes([]);
      setActiveStatus('');
      setManager('');
    } catch (e) {
      showError(e && e.message ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };
  const onTest = async () => {
    try {
      if (mode === 'list' && tokens.length > 0) {
        if (channel === 'sms' || channel === 'both') {
          if (numbers.length === 0) { showWarning('No phone numbers detected'); return; }
          await sendTestSMS(numbers[0], message.trim() || 'Test message', smsSenderId.trim() || undefined);
          showSuccess('Test SMS sent to first number');
          return;
        }
        if (channel === 'email') {
          if (emails.length === 0) { showWarning('No emails detected'); return; }
          await sendTestEmail(emails[0], subject.trim() || 'Test', message.trim() || 'Test message', emailFrom.trim() || undefined);
          showSuccess('Test email sent to first address');
          return;
        }
      } else {
        showWarning('Switch to “Paste numbers/emails” and enter one to test');
      }
    } catch (e) {
      showError(e && e.message ? e.message : 'Test failed');
    }
  };
  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>Promotions</h1>
      {!allowed && <div style={{ color: '#dc2626' }}>You do not have permission to send promotions.</div>}
      <div className="card">
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />
            <span>All clients</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={mode === 'filtered'} onChange={() => setMode('filtered')} />
            <span>Filtered clients</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={mode === 'list'} onChange={() => setMode('list')} />
            <span>Paste numbers</span>
          </label>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={channel === 'sms'} onChange={() => setChannel('sms')} />
            <span>SMS</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={channel === 'email'} onChange={() => setChannel('email')} />
            <span>Email</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={channel === 'both'} onChange={() => setChannel('both')} />
            <span>Both</span>
          </label>
        </div>
        {mode === 'filtered' && (
          <div className="stack" style={{ gap: 12, marginTop: 8 }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label>
                Branch
                <select className="input" value={branchCode} onChange={(e) => setBranchCode(e.target.value)}>
                  <option value="">Any</option>
                  {(config.branches || []).filter(b => b.active !== false).map(b => (
                    <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Account Type
                <select className="input" value={accountTypeCode} onChange={(e) => setAccountTypeCode(e.target.value)}>
                  <option value="">Any</option>
                  {(config.accountTypes || []).filter(a => a.active !== false).map(a => (
                    <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ minWidth: 200 }}>
                Active Status
                <select className="input" value={activeStatus} onChange={(e) => setActiveStatus(e.target.value)}>
                  <option value="">Any</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Dormant">Dormant</option>
                  <option value="NDS">NDS</option>
                </select>
              </label>
              <label style={{ minWidth: 200 }}>
                Manager
                <select className="input" value={manager} onChange={(e) => setManager(e.target.value)}>
                  <option value="">Any</option>
                  {managers.map(u => (
                    <option key={u.username} value={u.username}>{u.username}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 280 }}>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 4 }}>Branch Groups</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {(config.branches || []).filter(b => b.active !== false).map(b => (
                    <label key={b.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={selectedBranches.includes(b.code)} onChange={(e) => {
                        if (e.target.checked) setSelectedBranches([...selectedBranches, b.code]);
                        else setSelectedBranches(selectedBranches.filter(x => x !== b.code));
                      }} />
                      <span>{b.code} - {b.name}</span>
                    </label>
                  ))}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <button className="btn" onClick={() => setSelectedBranches((config.branches || []).filter(b => b.active !== false).map(b => b.code))}>Select all</button>
                  <button className="btn" onClick={() => setSelectedBranches([])}>Clear</button>
                </div>
              </div>
              <div style={{ minWidth: 280 }}>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 4 }}>Account Type Groups</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {(config.accountTypes || []).filter(a => a.active !== false).map(a => (
                    <label key={a.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={selectedTypes.includes(a.code)} onChange={(e) => {
                        if (e.target.checked) setSelectedTypes([...selectedTypes, a.code]);
                        else setSelectedTypes(selectedTypes.filter(x => x !== a.code));
                      }} />
                      <span>{a.code} - {a.name}</span>
                    </label>
                  ))}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <button className="btn" onClick={() => setSelectedTypes((config.accountTypes || []).filter(a => a.active !== false).map(a => a.code))}>Select all</button>
                  <button className="btn" onClick={() => setSelectedTypes([])}>Clear</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {mode === 'list' && (
          <div className="stack" style={{ marginTop: 8 }}>
            <textarea className="input" rows="4" placeholder="Paste phone numbers or emails separated by commas, spaces or newlines"
              value={numbersText} onChange={(e) => setNumbersText(e.target.value)} />
            <div style={{ color: '#64748b', fontSize: 12 }}>Detected numbers: {numbers.length} • emails: {emails.length}</div>
          </div>
        )}
        <div className="stack" style={{ marginTop: 8 }}>
          {(channel === 'email' || channel === 'both') && (
            <input className="input" placeholder="Subject (email)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          )}
          <textarea className="input" rows="6" placeholder="Message"
            value={message} onChange={(e) => setMessage(e.target.value)} />
          {(channel === 'sms' || channel === 'both') && (
            <>
              <input
                className="input"
                list="sms-senderids"
                placeholder={`Sender ID (optional)${config.defaultSmsSenderId ? ` • default ${config.defaultSmsSenderId}` : ''}`}
                value={smsSenderId}
                onChange={(e) => setSmsSenderId(e.target.value)}
              />
              <datalist id="sms-senderids">
                {(config.smsSenderIds || []).map((s, i) => <option key={`sid-${i}`} value={s} />)}
              </datalist>
            </>
          )}
          {(channel === 'email' || channel === 'both') && (
            <>
              <input
                className="input"
                list="email-froms"
                placeholder={`From (optional)${config.defaultEmailFrom ? ` • default ${config.defaultEmailFrom}` : ''}`}
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
              <datalist id="email-froms">
                {(config.emailFromAddresses || []).map((s, i) => <option key={`from-${i}`} value={s} />)}
              </datalist>
            </>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={onPreview}>Preview</button>
            <button className="btn" onClick={onTest}>Send Test</button>
            <button className="btn btn-primary" disabled={sending} onClick={onSend}>
              {sending ? 'Sending…' : 'Send Campaign'}
            </button>
          </div>
          {preview && (
            <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Preview</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{preview}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>Recipients: {recipientsCount}</div>
            </div>
          )}
          <div style={{ color: '#64748b', fontSize: 12 }}>
            Tip: Keep messages under 160 characters for a single SMS segment. Country code default is used when numbers don’t start with “+”.
          </div>
        </div>
      </div>
    </div>
  );
}
