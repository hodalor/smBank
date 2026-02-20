import { useState } from 'react';
import { uploadMedia } from '../api';
import { hasPermission, PERMISSIONS } from '../state/ops';
import { showError, showSuccess } from '../components/Toaster';

export default function MediaUpload() {
  const allowed = hasPermission(PERMISSIONS.MEDIA_UPLOAD);
  const [file, setFile] = useState(null);
  const [entityType, setEntityType] = useState('client');
  const [entityId, setEntityId] = useState('');
  const [tag, setTag] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return showError('Select a file');
    setLoading(true);
    setResult(null);
    try {
      const data = await uploadMedia(file, { entityType: entityId ? entityType : undefined, entityId: entityId || undefined, tag: tag || undefined });
      setResult(data);
      showSuccess('Uploaded');
    } catch (err) {
      showError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  if (!allowed) return <div className="card">Not authorized.</div>;
  return (
    <div className="stack">
      <h1>Media Upload</h1>
      <form className="card" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label>File</label>
            <input type="file" onChange={e => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Entity Type</label>
            <select value={entityType} onChange={e => setEntityType(e.target.value)}>
              <option value="client">Client</option>
              <option value="loan">Loan</option>
            </select>
          </div>
          <div className="form-group">
            <label>Entity ID</label>
            <input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="Optional (e.g. account number or loan id)" />
          </div>
          <div className="form-group">
            <label>Tag</label>
            <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Uploading…' : 'Upload'}</button>
          </div>
        </div>
      </form>
      {result && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Result</div>
          <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            URL: <a href={result.url} target="_blank" rel="noreferrer">{result.url}</a>
          </div>
        </div>
      )}
    </div>
  );
}
