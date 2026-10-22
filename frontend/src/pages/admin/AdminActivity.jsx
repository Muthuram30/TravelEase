import { useEffect, useState } from 'react';
import { adminAuditApi } from '../../api/api';
import './AdminActivity.css';

const ENTITY_TYPES = [
  { value: '', label: 'All activity' },
  { value: 'booking', label: 'Bookings' },
  { value: 'package', label: 'Packages' },
  { value: 'user', label: 'Users / Premium' },
  { value: 'tourist', label: 'Tourists' },
];

function prettyAction(value = '') {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDetails(value) {
  if (!value) return '—';
  let details = value;
  if (typeof value === 'string') {
    try { details = JSON.parse(value); } catch { return value; }
  }
  if (typeof details !== 'object' || Array.isArray(details)) return String(details);
  return Object.entries(details)
    .filter(([, item]) => item !== null && item !== undefined && item !== '')
    .map(([key, item]) => `${prettyAction(key)}: ${typeof item === 'object' ? JSON.stringify(item) : item}`)
    .join(' · ') || '—';
}

export default function AdminActivity() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (requestedPage = page) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminAuditApi.list({ page: requestedPage, limit: 25, search, entity_type: entityType });
      setRows(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
      setPage(requestedPage);
    } catch (err) {
      setError(err.message || 'Could not load the activity log.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => load(1), 250);
    return () => clearTimeout(timer);
    // load uses the current filter values; filter changes reset to page 1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, entityType]);

  return (
    <div className="adm-content">
      <div className="adm-page-header">
        <div>
          <h1 className="text-headline-md">Admin Activity Log</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            Recorded package, booking, account, and tourist changes · {pagination.total} entries
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => load(page)} disabled={loading}>
          <span className="material-symbols-outlined">refresh</span> Refresh
        </button>
      </div>

      <div className="adm-filters adm-activity-filters">
        <input
          className="input-field"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search action, admin, ID, details…"
          aria-label="Search activity log"
        />
        <select className="input-field" value={entityType} onChange={(event) => setEntityType(event.target.value)} aria-label="Filter activity type">
          {ENTITY_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
        </select>
      </div>

      {error && <div className="adminlogin-error" role="alert"><span className="material-symbols-outlined">error</span>{error}</div>}

      <div className="adm-section glass-card">
        <div className="adm-table-wrap">
          {loading ? (
            <div className="adm-empty"><div className="conf-loading__spinner" /><p>Loading activity…</p></div>
          ) : rows.length === 0 ? (
            <div className="adm-empty"><span className="material-symbols-outlined">history</span><p>No activity matches these filters.</p></div>
          ) : (
            <table className="data-table adm-activity-table">
              <thead>
                <tr><th>Date &amp; Time</th><th>Action</th><th>Entity</th><th>Admin</th><th>Details</th><th>Change</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.audit_id}>
                    <td className="adm-activity-time">{row.created_at ? new Date(String(row.created_at).replace(' ', 'T')).toLocaleString() : '—'}</td>
                    <td><span className="badge badge-confirmed">{prettyAction(row.action)}</span></td>
                    <td>{prettyAction(row.entity_type)}{row.entity_id ? ` #${row.entity_id}` : ''}</td>
                    <td>{row.actor_name || (row.actor_id ? `Admin #${row.actor_id}` : 'Admin')}</td>
                    <td className="adm-activity-details">{formatDetails(row.details)}</td>
                    <td>{row.old_value || '—'}{row.new_value ? ` → ${row.new_value}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {pagination.pages > 1 && (
          <div className="adm-pagination" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Previous</button>
            <span className="text-body-sm">Page {page} of {pagination.pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pagination.pages || loading} onClick={() => load(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
