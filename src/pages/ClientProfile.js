import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createClient, getClient, updateClient, fetchConfig, uploadMedia } from '../api';
import { showError, showSuccess } from '../components/Toaster';
import { confirm } from '../components/Confirm';

export default function ClientProfile() {
  const { accountNumber } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    branchCode: '',
    accountTypeCode: '',
    createdAt: new Date().toISOString(),
    fullName: '',
    nationalId: '',
    dob: '',
    phone: '',
    email: '',
    address: '',
    dateRegistered: '',
    status: 'Active',
    photo: null,
    idFront: null,
    idBack: null,
    signaturePhoto: null,
    companyName: '',
    registrationNumber: '',
    registrationDate: '',
    registeredAddress: '',
    operatingAddress: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactAddress: '',
    directors: [],
    shareholders: [],
    signatories: [],
    nok1Name: '',
    nok1Phone: '',
    nok1Email: '',
    nok1Address: '',
    nok2Name: '',
    nok2Phone: '',
    nok2Email: '',
    nok2Address: ''
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const uploadNested = async (collection, idx, field, file) => {
    if (!file) return;
    if (!accountNumber) {
      const arr = [...(form[collection] || [])];
      const rec = { ...(arr[idx] || {}) };
      rec[field] = file;
      arr[idx] = rec;
      setForm({ ...form, [collection]: arr });
      return;
    }
    try {
      const up = await uploadMedia(file, { entityType: 'client', entityId: accountNumber, tag: `${collection}_${idx}_${field}` });
      const arr = [...(form[collection] || [])];
      const rec = { ...(arr[idx] || {}) };
      if (field === 'photo') rec.photoUrl = up.url;
      if (field === 'idFront') rec.idFrontUrl = up.url;
      if (field === 'idBack') rec.idBackUrl = up.url;
      arr[idx] = rec;
      setForm({ ...form, [collection]: arr });
      setAttachments(a => [up, ...(a || [])]);
      showSuccess('Uploaded');
    } catch {
      showError('Upload failed');
    }
  };
  const changeFile = async (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, photo: file });
    if (!file) { setPhotoPreview(null); return; }
    if (accountNumber) {
      try {
        const up = await uploadMedia(file, { entityType: 'client', entityId: accountNumber, tag: 'photo' });
        setPhotoPreview(up.url);
        setAttachments(a => [up, ...(a || [])]);
      } catch {
        const url = URL.createObjectURL(file);
        setPhotoPreview(url);
        showError('Upload failed');
      }
    } else {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };
  const changeIdFront = async (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, idFront: file });
    if (!file) { setIdFrontPreview(null); return; }
    if (accountNumber) {
      try {
        const up = await uploadMedia(file, { entityType: 'client', entityId: accountNumber, tag: 'id_front' });
        setIdFrontPreview(up.url);
        setAttachments(a => [up, ...(a || [])]);
      } catch {
        setIdFrontPreview(URL.createObjectURL(file));
        showError('Upload failed');
      }
    } else {
      setIdFrontPreview(URL.createObjectURL(file));
    }
  };
  const changeIdBack = async (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, idBack: file });
    if (!file) { setIdBackPreview(null); return; }
    if (accountNumber) {
      try {
        const up = await uploadMedia(file, { entityType: 'client', entityId: accountNumber, tag: 'id_back' });
        setIdBackPreview(up.url);
        setAttachments(a => [up, ...(a || [])]);
      } catch {
        setIdBackPreview(URL.createObjectURL(file));
        showError('Upload failed');
      }
    } else {
      setIdBackPreview(URL.createObjectURL(file));
    }
  };
  const changeSignature = async (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, signaturePhoto: file });
    if (!file) { setSignaturePreview(null); return; }
    if (accountNumber) {
      try {
        const up = await uploadMedia(file, { entityType: 'client', entityId: accountNumber, tag: 'signature' });
        setSignaturePreview(up.url);
        setAttachments(a => [up, ...(a || [])]);
      } catch {
        setSignaturePreview(URL.createObjectURL(file));
        showError('Upload failed');
      }
    } else {
      setSignaturePreview(URL.createObjectURL(file));
    }
  };
  useEffect(() => {
    let mounted = true;
    // Load config for branches and account types
    fetchConfig().then(cfg => {
      if (!mounted) return;
      setConfig(cfg);
      setForm(f => ({
        ...f,
        branchCode: f.branchCode || (cfg.branches && cfg.branches.find(b => b.active)?.code) || (cfg.branches?.[0]?.code || ''),
        accountTypeCode: f.accountTypeCode || (cfg.accountTypes && cfg.accountTypes.find(a => a.active)?.code) || (cfg.accountTypes?.[0]?.code || ''),
      }));
    }).catch(() => {});
    const load = async () => {
      if (!accountNumber) return;
      try {
        const c = await getClient(accountNumber);
        if (!mounted) return;
        setForm({
          branchCode: c.branchCode || '',
          accountTypeCode: c.accountTypeCode || '',
          createdAt: c.createdAt || new Date().toISOString(),
          fullName: c.fullName || '',
          nationalId: c.nationalId || '',
          dob: c.dob || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          dateRegistered: c.dateRegistered || '',
          status: c.status || 'Active',
          photo: null,
          idFront: null,
          idBack: null,
          signaturePhoto: null,
          companyName: c.companyName || '',
          registrationNumber: c.registrationNumber || '',
          registrationDate: c.registrationDate || '',
          registeredAddress: c.registeredAddress || '',
          operatingAddress: c.operatingAddress || '',
          contactName: c.contactName || '',
          contactPhone: c.contactPhone || '',
          contactEmail: c.contactEmail || '',
          contactAddress: c.contactAddress || '',
          directors: Array.isArray(c.directors) ? c.directors : [],
          shareholders: Array.isArray(c.shareholders) ? c.shareholders : [],
          signatories: Array.isArray(c.signatories) ? c.signatories : [],
          nok1Name: c.nok1Name || '',
          nok1Phone: c.nok1Phone || '',
          nok1Email: c.nok1Email || '',
          nok1Address: c.nok1Address || '',
          nok2Name: c.nok2Name || '',
          nok2Phone: c.nok2Phone || '',
          nok2Email: c.nok2Email || '',
          nok2Address: c.nok2Address || '',
        });
        const catts = Array.isArray(c.attachments) ? c.attachments : (Array.isArray(c.data && c.data.attachments) ? c.data.attachments : []);
        setAttachments(catts);
      } catch {}
    };
    load();
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      if (idFrontPreview) URL.revokeObjectURL(idFrontPreview);
      if (idBackPreview) URL.revokeObjectURL(idBackPreview);
      if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    };
  }, [accountNumber, photoPreview, idFrontPreview, idBackPreview, signaturePreview]);
  const [config, setConfig] = useState({ branches: [], accountTypes: [] });
  const acctType = config.accountTypes?.find(a => a.code === form.accountTypeCode) || null;
  const isIndividual = acctType ? (acctType.supportsIndividual !== false) : true;
  const branchRec = config.branches?.find(b => b.code === form.branchCode) || null;
  const submit = async (e) => {
    e.preventDefault();
    const files = {
      photo: form.photo,
      id_front: form.idFront,
      id_back: form.idBack,
      signature: form.signaturePhoto,
    };
    const payload = { ...form };
    delete payload.photo;
    delete payload.idFront;
    delete payload.idBack;
    delete payload.signaturePhoto;
    if (Array.isArray(payload.directors)) {
      payload.directors = payload.directors.map(d => {
        const x = { ...d };
        delete x.photo; delete x.idFront; delete x.idBack; delete x.signature;
        return x;
      });
    }
    if (Array.isArray(payload.shareholders)) {
      payload.shareholders = payload.shareholders.map(s => {
        const x = { ...s };
        delete x.photo; delete x.idFront; delete x.idBack; delete x.signature;
        return x;
      });
    }
    if (Array.isArray(payload.signatories)) {
      payload.signatories = payload.signatories.map(p => {
        const x = { ...p };
        delete x.photo; delete x.idFront; delete x.idBack; delete x.signature;
        return x;
      });
    }
    if (!isIndividual) {
      payload.fullName = '';
      payload.nationalId = '';
      payload.dob = '';
      payload.phone = payload.contactPhone || payload.phone || '';
      payload.email = payload.contactEmail || payload.email || '';
      payload.address = payload.registeredAddress || payload.operatingAddress || payload.address || '';
    }
    try {
      let acct = accountNumber;
      if (accountNumber) {
        await updateClient(accountNumber, payload);
      } else {
        const created = await createClient(payload);
        acct = created?.accountNumber || created?.id || acct;
      }
      const uploads = [];
      if (files.photo) uploads.push(uploadMedia(files.photo, { entityType: 'client', entityId: acct, tag: 'photo' }));
      if (files.id_front) uploads.push(uploadMedia(files.id_front, { entityType: 'client', entityId: acct, tag: 'id_front' }));
      if (files.id_back) uploads.push(uploadMedia(files.id_back, { entityType: 'client', entityId: acct, tag: 'id_back' }));
      if (files.signature) uploads.push(uploadMedia(files.signature, { entityType: 'client', entityId: acct, tag: 'signature' }));
      if (uploads.length) {
        try { await Promise.allSettled(uploads); } catch {}
      }
      if (acct) {
        try {
          const c = await getClient(acct);
          setAttachments(Array.isArray(c.attachments) ? c.attachments : []);
        } catch {}
      }
      showSuccess('Client saved');
      if (!accountNumber) navigate('/clients');
    } catch (e) {
      if (e && e.message && e.message.includes('duplicate_contact')) showError('Duplicate email/phone/ID detected');
      else showError('Failed to save client');
    }
  };
  const retire = async () => {
    if (form.status === 'Inactive') return;
    if (await confirm('Retire this account? The status will change to Inactive.')) {
      const next = { ...form, status: 'Inactive' };
      setForm(next);
      if (accountNumber) {
        try { await updateClient(accountNumber, { status: 'Inactive' }); showSuccess('Account retired'); } catch { showError('Failed to retire account'); }
      }
    }
  };
  return (
    <div className="stack">
      <h1>{accountNumber ? 'Client Profile' : 'New Client'}</h1>
      {accountNumber && (
        <div className="card row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Account Number</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{accountNumber}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Branch</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{form.branchCode ? `${form.branchCode} - ${branchRec ? branchRec.name : ''}` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Account Type</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{form.accountTypeCode ? `${form.accountTypeCode} - ${acctType ? acctType.name : ''}` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Status</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{form.status}</div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => navigate(`/statements?account=${accountNumber}`)}>View Statement</button>
            <button className="btn btn-primary" onClick={retire} disabled={form.status === 'Inactive'}>
              {form.status === 'Inactive' ? 'Retired' : 'Retire Account'}
            </button>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="form card" style={{ maxWidth: 900 }}>
        <div className="form-grid">
          {accountNumber && (
            <label>
              Account Number
              <input className="input" value={accountNumber} readOnly />
            </label>
          )}
          {!accountNumber && (
            <>
              <label>
                Branch
                <select className="input" name="branchCode" value={form.branchCode} onChange={change}>
                  {(config.branches || []).filter(b => b.active !== false).map(b => (
                    <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Account Type
                <select className="input" name="accountTypeCode" value={form.accountTypeCode} onChange={change}>
                  {(config.accountTypes || []).filter(a => a.active !== false).map(a => (
                    <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {isIndividual && (
            <>
              <label>
                Full Name
                <input className="input" name="fullName" value={form.fullName} onChange={change} required />
              </label>
              <label>
                National ID / Passport Number
                <input className="input" name="nationalId" value={form.nationalId} onChange={change} required />
              </label>
              <label>
                Date of Birth
                <input className="input" type="date" name="dob" value={form.dob} onChange={change} required />
              </label>
              <label>
                Phone Number
                <input className="input" name="phone" value={form.phone} onChange={change} required />
              </label>
              <label>
                Email
                <input className="input" name="email" value={form.email} onChange={change} />
              </label>
              <label>
                Physical Address
                <input className="input" name="address" value={form.address} onChange={change} />
              </label>
            </>
          )}
          <label>
            Date of Registration
            <input className="input" value={new Date(form.createdAt).toLocaleString()} readOnly />
          </label>
          <label>
            Status
            <select className="input" name="status" value={form.status} onChange={change}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          {isIndividual && (
            <>
              <label>
                Photo
                <input className="input" type="file" accept="image/*" onChange={changeFile} />
              </label>
              {photoPreview && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ color: '#64748b', fontSize: 12 }}>Preview</div>
                  <img src={photoPreview} alt="Client" style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                </div>
              )}
              {!photoPreview && attachments.filter(a => (a.tag || '') === 'photo').length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ color: '#64748b', fontSize: 12 }}>Current</div>
                  <img src={attachments.find(a => (a.tag || '') === 'photo').url} alt="Client" style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                </div>
              )}
            </>
          )}
        </div>
          {isIndividual && (
          <div className="stack">
            <h3>KYC Documents</h3>
            <div className="form-grid">
              <label>
                ID Front
                <input className="input" type="file" accept="image/*" onChange={changeIdFront} />
              </label>
              <label>
                ID Back
                <input className="input" type="file" accept="image/*" onChange={changeIdBack} />
              </label>
              <label>
                Signature Photo
                <input className="input" type="file" accept="image/*" onChange={changeSignature} />
              </label>
            </div>
            <div className="row" style={{ gap: 16 }}>
              {idFrontPreview && <img src={idFrontPreview} alt="ID Front" style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />}
              {idBackPreview && <img src={idBackPreview} alt="ID Back" style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />}
              {signaturePreview && <img src={signaturePreview} alt="Signature" style={{ width: 180, height: 120, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)' }} />}
            </div>
            {(!idFrontPreview || !idBackPreview || !signaturePreview) && (
              <div className="row" style={{ gap: 16, marginTop: 8 }}>
                {!idFrontPreview && attachments.filter(a => (a.tag || '') === 'id_front').slice(0,1).map((a,i) => (
                  <img key={`idfront-${i}`} src={a.url} alt="ID Front" style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                ))}
                {!idBackPreview && attachments.filter(a => (a.tag || '') === 'id_back').slice(0,1).map((a,i) => (
                  <img key={`idback-${i}`} src={a.url} alt="ID Back" style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                ))}
                {!signaturePreview && attachments.filter(a => (a.tag || '') === 'signature').slice(0,1).map((a,i) => (
                  <img key={`sig-${i}`} src={a.url} alt="Signature" style={{ width: 180, height: 120, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)' }} />
                ))}
              </div>
            )}
          </div>
        )}
        {!isIndividual && (
          <div className="stack">
            <h3>Company Info</h3>
            <div className="form-grid">
              <label>
                Company Name
                <input className="input" name="companyName" value={form.companyName} onChange={change} required />
              </label>
              <label>
                Registration Number
                <input className="input" name="registrationNumber" value={form.registrationNumber} onChange={change} required />
              </label>
              <label>
                Registration Date
                <input className="input" type="date" name="registrationDate" value={form.registrationDate} onChange={change} required />
              </label>
              <label>
                Registered Address
                <input className="input" name="registeredAddress" value={form.registeredAddress} onChange={change} />
              </label>
              <label>
                Operating Address
                <input className="input" name="operatingAddress" value={form.operatingAddress} onChange={change} />
              </label>
            </div>
            <h3>Company Contact Person</h3>
            <div className="form-grid">
              <label>
                Name
                <input className="input" name="contactName" value={form.contactName} onChange={change} required />
              </label>
              <label>
                Phone
                <input className="input" name="contactPhone" value={form.contactPhone} onChange={change} required />
              </label>
              <label>
                Email
                <input className="input" name="contactEmail" value={form.contactEmail} onChange={change} />
              </label>
              <label>
                Address
                <input className="input" name="contactAddress" value={form.contactAddress} onChange={change} />
              </label>
            </div>
            <h3>Directors</h3>
            {(form.directors || []).map((d, i) => (
              <div key={`dir-${i}`} className="form-grid">
                <label>
                  Name
                  <input className="input" value={d.name || ''} onChange={(e) => {
                    const arr = [...(form.directors || [])]; arr[i] = { ...arr[i], name: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Role
                  <input className="input" value={d.role || ''} onChange={(e) => {
                    const arr = [...(form.directors || [])]; arr[i] = { ...arr[i], role: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  National ID
                  <input className="input" value={d.nationalId || ''} onChange={(e) => {
                    const arr = [...(form.directors || [])]; arr[i] = { ...arr[i], nationalId: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Phone
                  <input className="input" value={d.phone || ''} onChange={(e) => {
                    const arr = [...(form.directors || [])]; arr[i] = { ...arr[i], phone: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Email
                  <input className="input" value={d.email || ''} onChange={(e) => {
                    const arr = [...(form.directors || [])]; arr[i] = { ...arr[i], email: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Passport Photo
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('directors', i, 'photo', file);
                  }} />
                  {d.photoUrl ? <img alt="" src={d.photoUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <label>
                  ID Front
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('directors', i, 'idFront', file);
                  }} />
                  {d.idFrontUrl ? <img alt="" src={d.idFrontUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <label>
                  ID Back
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('directors', i, 'idBack', file);
                  }} />
                  {d.idBackUrl ? <img alt="" src={d.idBackUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => {
                    const arr = (form.directors || []).filter((_, idx) => idx !== i); setForm({ ...form, directors: arr });
                  }}>Remove</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm({ ...form, directors: [ ...(form.directors || []), { name: '', role: '', nationalId: '', phone: '', email: '' } ] })}>Add Director</button>
            <h3>Shareholders</h3>
            {(form.shareholders || []).map((s, i) => (
              <div key={`sh-${i}`} className="form-grid">
                <label>
                  Name
                  <input className="input" value={s.name || ''} onChange={(e) => {
                    const arr = [...(form.shareholders || [])]; arr[i] = { ...arr[i], name: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  National ID
                  <input className="input" value={s.nationalId || ''} onChange={(e) => {
                    const arr = [...(form.shareholders || [])]; arr[i] = { ...arr[i], nationalId: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Phone
                  <input className="input" value={s.phone || ''} onChange={(e) => {
                    const arr = [...(form.shareholders || [])]; arr[i] = { ...arr[i], phone: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Email
                  <input className="input" value={s.email || ''} onChange={(e) => {
                    const arr = [...(form.shareholders || [])]; arr[i] = { ...arr[i], email: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Shares (%)
                  <input className="input" type="number" value={s.sharesPercent || ''} onChange={(e) => {
                    const arr = [...(form.shareholders || [])]; arr[i] = { ...arr[i], sharesPercent: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Passport Photo
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('shareholders', i, 'photo', file);
                  }} />
                  {s.photoUrl ? <img alt="" src={s.photoUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <label>
                  ID Front
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('shareholders', i, 'idFront', file);
                  }} />
                  {s.idFrontUrl ? <img alt="" src={s.idFrontUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <label>
                  ID Back
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('shareholders', i, 'idBack', file);
                  }} />
                  {s.idBackUrl ? <img alt="" src={s.idBackUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => {
                    const arr = (form.shareholders || []).filter((_, idx) => idx !== i); setForm({ ...form, shareholders: arr });
                  }}>Remove</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm({ ...form, shareholders: [ ...(form.shareholders || []), { name: '', nationalId: '', phone: '', email: '', sharesPercent: '' } ] })}>Add Shareholder</button>
            <h3>Signatory Persons</h3>
            {(form.signatories || []).map((p, i) => (
              <div key={`sig-${i}`} className="form-grid">
                <label>
                  Name
                  <input className="input" value={p.name || ''} onChange={(e) => {
                    const arr = [...(form.signatories || [])]; arr[i] = { ...arr[i], name: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Role
                  <input className="input" value={p.role || ''} onChange={(e) => {
                    const arr = [...(form.signatories || [])]; arr[i] = { ...arr[i], role: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  National ID
                  <input className="input" value={p.nationalId || ''} onChange={(e) => {
                    const arr = [...(form.signatories || [])]; arr[i] = { ...arr[i], nationalId: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Phone
                  <input className="input" value={p.phone || ''} onChange={(e) => {
                    const arr = [...(form.signatories || [])]; arr[i] = { ...arr[i], phone: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Email
                  <input className="input" value={p.email || ''} onChange={(e) => {
                    const arr = [...(form.signatories || [])]; arr[i] = { ...arr[i], email: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Passport Photo
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('signatories', i, 'photo', file);
                  }} />
                  {p.photoUrl ? <img alt="" src={p.photoUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <label>
                  ID Front
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('signatories', i, 'idFront', file);
                  }} />
                  {p.idFrontUrl ? <img alt="" src={p.idFrontUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <label>
                  ID Back
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null; if (!file) return;
                    uploadNested('signatories', i, 'idBack', file);
                  }} />
                  {p.idBackUrl ? <img alt="" src={p.idBackUrl} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} /> : null}
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => {
                    const arr = (form.signatories || []).filter((_, idx) => idx !== i); setForm({ ...form, signatories: arr });
                  }}>Remove</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm({ ...form, signatories: [ ...(form.signatories || []), { name: '', role: '', nationalId: '', phone: '', email: '' } ] })}>Add Signatory</button>
          </div>
        )}
        {isIndividual ? (
          <div className="stack">
            <h3>Next of Kin 1</h3>
            <div className="form-grid">
              <label>
                Name
                <input className="input" name="nok1Name" value={form.nok1Name} onChange={change} required />
              </label>
              <label>
                Phone
                <input className="input" name="nok1Phone" value={form.nok1Phone} onChange={change} required />
              </label>
              <label>
                Email
                <input className="input" name="nok1Email" value={form.nok1Email} onChange={change} />
              </label>
              <label>
                Address
                <input className="input" name="nok1Address" value={form.nok1Address} onChange={change} />
              </label>
            </div>
            <h3>Next of Kin 2</h3>
            <div className="form-grid">
              <label>
                Name
                <input className="input" name="nok2Name" value={form.nok2Name} onChange={change} required />
              </label>
              <label>
                Phone
                <input className="input" name="nok2Phone" value={form.nok2Phone} onChange={change} required />
              </label>
              <label>
                Email
                <input className="input" name="nok2Email" value={form.nok2Email} onChange={change} />
              </label>
              <label>
                Address
                <input className="input" name="nok2Address" value={form.nok2Address} onChange={change} />
              </label>
            </div>
          </div>
        ) : (
          <div className="stack">
            <h3>Company Contact Person</h3>
            <div className="form-grid">
              <label>
                Name
                <input className="input" name="contactName" value={form.contactName} onChange={change} required />
              </label>
              <label>
                Phone
                <input className="input" name="contactPhone" value={form.contactPhone} onChange={change} required />
              </label>
              <label>
                Email
                <input className="input" name="contactEmail" value={form.contactEmail} onChange={change} />
              </label>
              <label>
                Address
                <input className="input" name="contactAddress" value={form.contactAddress} onChange={change} />
              </label>
            </div>
          </div>
        )}
        {accountNumber && (
          <div className="stack">
            <h3>Media & Attachments</h3>
            {attachments && attachments.length > 0 ? (
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                {attachments.map((a, i) => (
                  <div key={i} className="card" style={{ padding: 8, width: 220 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{a.tag || a.name || 'file'}</div>
                    {String(a.contentType || '').startsWith('image/') ? (
                      <img src={a.url} alt={a.name || a.tag || 'attachment'} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ fontSize: 12, color: '#64748b' }}>{a.contentType || 'document'}</div>
                    )}
                    <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
                      <a className="btn" href={a.url} target="_blank" rel="noreferrer">Open</a>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{Math.round((Number(a.size || 0) / 1024) * 10) / 10} KB</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card">No media uploaded yet.</div>
            )}
          </div>
        )}
        <div className="row">
          <button className="btn btn-primary" type="submit">Save</button>
          <button className="btn" type="button" onClick={() => navigate('/clients')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
