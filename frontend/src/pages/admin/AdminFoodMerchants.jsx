import { useEffect, useState } from 'react';
import { adminFoodApi } from '../../api/api';
import './AdminFoodMerchants.css';

const STATUS_BADGE = {
  approved: 'badge-confirmed',
  rejected: 'badge-rejected',
  suspended: 'badge-cancelled',
  pending:  'badge-pending',
};

const STATUS_FILTERS = ['', 'pending', 'approved', 'rejected', 'suspended'];

/**
 * Food partner (merchant) management.
 * Approve / reject / suspend merchant applications using the existing
 * api/admin/food_merchants.php backend (server-side admin checks + audit).
 */
export default function AdminFoodMerchants({ showNotif }) {
  const [merchants, setMerchants] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [dialog, setDialog] = useState(null); // {type: 'reject'|'approve'|'suspend', id, name}

  const notify = showNotif || ((msg) => setError(msg));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const data = await adminFoodApi.list(params);
      setMerchants(Array.isArray(data) ? data : (data.merchants || []));
      setAudits(data.audits || []);
    } catch (err) {
      setError(err.message || 'Failed to load merchants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const doAction = async (type, id, text = '') => {
    setActionLoading(`${type}-${id}`);
    try {
      let res;
      if (type === 'approve')  res = await adminFoodApi.approve(id, text);
      else if (type === 'reject') res = await adminFoodApi.reject(id, text || 'Application rejected by admin.');
      else if (type === 'suspend') res = await adminFoodApi.suspend(id, text);
      notify(res.message || `Merchant ${type}d.`);
      await load();
    } catch (err) {
      notify(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
      setDialog(null);
    }
  };

  return (
    <div className="adm-content">
      <div className="adm-page-header">
        <h1 className="text-headline-md">Food Partners</h1>
        <div className="adm-filters">
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Statuses'}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="adminlogin-error" style={{ marginBottom: 'var(--space-md)' }}>
          <span className="material-symbols-outlined">error</span>{error}
        </div>
      )}

      <div className="adm-section glass-card">
        <div className="adm-table-wrap">
          {loading ? (
            <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
              <div className="conf-loading__spinner" />
            </div>
          ) : merchants.length === 0 ? (
            <div className="adm-empty">
              <span className="material-symbols-outlined">restaurant</span>
              <p>No merchants found{statusFilter ? ` with status "${statusFilter}"` : ''}.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Business</th><th>Contact</th><th>Primary Venue</th>
                  <th>Locations</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.merchant_id}>
                    <td>#{m.merchant_id}</td>
                    <td className="text-label-lg">{m.business_name}</td>
                    <td>
                      <div className="text-body-sm">{m.owner_name || '—'}</div>
                      <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{m.email}</div>
                    </td>
                    <td>{m.primary_venue || '—'}</td>
                    <td>{m.location_count}</td>
                    <td><span className={`badge ${STATUS_BADGE[m.status] || 'badge-rejected'}`}>{m.status}</span></td>
                    <td>
                      <div className="adm-table-actions">
                        {m.status === 'pending' && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => doAction('approve', m.merchant_id)}
                              title="Approve application"
                            >
                              <span className="material-symbols-outlined">check_circle</span>
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => setDialog({ type: 'reject', id: m.merchant_id, name: m.business_name })}
                              title="Reject application"
                            >
                              <span className="material-symbols-outlined">block</span>
                            </button>
                          </>
                        )}
                        {m.status === 'approved' && (
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={!!actionLoading}
                            onClick={() => setDialog({ type: 'suspend', id: m.merchant_id, name: m.business_name })}
                            title="Suspend merchant"
                          >
                            <span className="material-symbols-outlined">pause_circle</span>
                          </button>
                        )}
                        {m.status === 'suspended' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={!!actionLoading}
                            onClick={() => doAction('approve', m.merchant_id)}
                            title="Re-approve merchant"
                          >
                            <span className="material-symbols-outlined">play_circle</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {audits.length > 0 && (
        <div className="adm-section glass-card" style={{ marginTop: 'var(--space-md)' }}>
          <div className="adm-section__header">
            <h2 className="text-headline-sm">Recent Merchant Decisions</h2>
          </div>
          <div className="adm-table-wrap">
            <table className="data-table">
              <thead><tr><th>Business</th><th>Action</th><th>By</th><th>When</th></tr></thead>
              <tbody>
                {audits.slice(0, 5).map((a) => (
                  <tr key={a.audit_id}>
                    <td>{a.business_name}</td>
                    <td>{a.action}</td>
                    <td>{a.admin_name || '—'}</td>
                    <td>{String(a.created_at || '').slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Reject / Suspend reason dialog ---- */}
      {dialog && (
        <ReasonDialog
          title={dialog.type === 'reject' ? `Reject "${dialog.name}"` : `Suspend "${dialog.name}"`}
          label={dialog.type === 'reject' ? 'Reason (required)' : 'Note (optional)'}
          requireText={dialog.type === 'reject'}
          onCancel={() => setDialog(null)}
          onSubmit={(text) => doAction(dialog.type, dialog.id, text)}
        />
      )}
    </div>
  );
}

function ReasonDialog({ title, label, requireText, onCancel, onSubmit }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    if (requireText && !text.trim()) {
      setErr('A reason is required.');
      return;
    }
    onSubmit(text.trim());
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" style={{ maxWidth: '420px' }} role="dialog" aria-modal="true">
        <div className="adm-modal-header">
          <h2 className="text-headline-sm">{title}</h2>
          <button className="adm-modal-close" onClick={onCancel} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {err && <div className="adminlogin-error" style={{ marginBottom: 'var(--space-sm)' }}>{err}</div>}
        <div className="input-group">
          <label htmlFor="reject-reason">{label}</label>
          <textarea
            id="reject-reason"
            className="input-field"
            rows="3"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
