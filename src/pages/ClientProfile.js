import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function ClientProfile() {
  const { accountNumber } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    accountType: 'Individual',
    createdAt: new Date().toISOString(),
    fullName: '',
    nationalId: '',
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
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const changeFile = (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, photo: file });
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  };
  const changeIdFront = (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, idFront: file });
    if (file) setIdFrontPreview(URL.createObjectURL(file));
    else setIdFrontPreview(null);
  };
  const changeIdBack = (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, idBack: file });
    if (file) setIdBackPreview(URL.createObjectURL(file));
    else setIdBackPreview(null);
  };
  const changeSignature = (e) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, signaturePhoto: file });
    if (file) setSignaturePreview(URL.createObjectURL(file));
    else setSignaturePreview(null);
  };
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      if (idFrontPreview) URL.revokeObjectURL(idFrontPreview);
      if (idBackPreview) URL.revokeObjectURL(idBackPreview);
      if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    };
  }, [photoPreview, idFrontPreview, idBackPreview, signaturePreview]);
  const submit = (e) => {
    e.preventDefault();
    navigate('/clients');
  };
  const retire = () => {
    if (form.status === 'Inactive') return;
    if (window.confirm('Retire this account? The status will change to Inactive.')) {
      setForm({ ...form, status: 'Inactive' });
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
          <label>
            Account Type
            <select className="input" name="accountType" value={form.accountType} onChange={change}>
              <option value="Individual">Individual</option>
              <option value="Business">Business</option>
            </select>
          </label>
          {form.accountType === 'Individual' && (
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
          {form.accountType === 'Individual' && (
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
            </>
          )}
        </div>
        {form.accountType === 'Individual' && (
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
          </div>
        )}
        {form.accountType === 'Business' && (
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
            <h3>Company Representative</h3>
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
            {form.directors.map((d, i) => (
              <div key={i} className="form-grid">
                <label>
                  Name
                  <input className="input" value={d.name || ''} onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], name: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Role
                  <input className="input" value={d.role || ''} onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], role: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  National ID
                  <input className="input" value={d.nationalId || ''} onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], nationalId: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Phone
                  <input className="input" value={d.phone || ''} onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], phone: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Email
                  <input className="input" value={d.email || ''} onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], email: e.target.value }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  ID Front
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], idFront: e.target.files?.[0] || null }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  ID Back
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], idBack: e.target.files?.[0] || null }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Signature
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], signature: e.target.files?.[0] || null }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <label>
                  Passport Photo
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.directors]; arr[i] = { ...arr[i], photo: e.target.files?.[0] || null }; setForm({ ...form, directors: arr });
                  }} />
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => {
                    const arr = form.directors.filter((_, idx) => idx !== i); setForm({ ...form, directors: arr });
                  }}>Remove</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm({ ...form, directors: [...form.directors, { name: '', role: '', nationalId: '', phone: '', email: '' }] })}>Add Director</button>
            <h3>Shareholders</h3>
            {form.shareholders.map((s, i) => (
              <div key={i} className="form-grid">
                <label>
                  Name
                  <input className="input" value={s.name || ''} onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], name: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  National ID
                  <input className="input" value={s.nationalId || ''} onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], nationalId: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Phone
                  <input className="input" value={s.phone || ''} onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], phone: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Email
                  <input className="input" value={s.email || ''} onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], email: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Shares (%)
                  <input className="input" type="number" value={s.sharesPercent || ''} onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], sharesPercent: e.target.value }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  ID Front
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], idFront: e.target.files?.[0] || null }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  ID Back
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], idBack: e.target.files?.[0] || null }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Signature
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], signature: e.target.files?.[0] || null }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <label>
                  Passport Photo
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.shareholders]; arr[i] = { ...arr[i], photo: e.target.files?.[0] || null }; setForm({ ...form, shareholders: arr });
                  }} />
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => {
                    const arr = form.shareholders.filter((_, idx) => idx !== i); setForm({ ...form, shareholders: arr });
                  }}>Remove</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm({ ...form, shareholders: [...form.shareholders, { name: '', nationalId: '', phone: '', email: '', sharesPercent: '' }] })}>Add Shareholder</button>
            <h3>Signatory Persons</h3>
            {form.signatories.map((p, i) => (
              <div key={i} className="form-grid">
                <label>
                  Name
                  <input className="input" value={p.name || ''} onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], name: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Role
                  <input className="input" value={p.role || ''} onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], role: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  National ID
                  <input className="input" value={p.nationalId || ''} onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], nationalId: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Phone
                  <input className="input" value={p.phone || ''} onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], phone: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Email
                  <input className="input" value={p.email || ''} onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], email: e.target.value }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  ID Front
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], idFront: e.target.files?.[0] || null }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  ID Back
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], idBack: e.target.files?.[0] || null }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Signature
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], signature: e.target.files?.[0] || null }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <label>
                  Passport Photo
                  <input className="input" type="file" accept="image/*" onChange={(e) => {
                    const arr = [...form.signatories]; arr[i] = { ...arr[i], photo: e.target.files?.[0] || null }; setForm({ ...form, signatories: arr });
                  }} />
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => {
                    const arr = form.signatories.filter((_, idx) => idx !== i); setForm({ ...form, signatories: arr });
                  }}>Remove</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm({ ...form, signatories: [...form.signatories, { name: '', role: '', nationalId: '', phone: '', email: '' }] })}>Add Signatory</button>
          </div>
        )}
        {form.accountType === 'Individual' ? (
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
        <div className="row">
          <button className="btn btn-primary" type="submit">Save</button>
          <button className="btn" type="button" onClick={() => navigate('/clients')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
