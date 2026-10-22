import { useEffect, useState } from 'react';
import { adminUsersApi } from '../../api/api';
import { formatPrice } from '../../components/PackageCard';
import './AdminUsers.css';

// ---- Role filter chips for the premium management preset ----
const ROLE_FILTERS = [
  { id: '',            label: 'All Users' },
  { id: 'user',        label: 'Regular' },
  { id: 'premium',     label: 'Premium' },
  { id: 'admin',       label: 'Admins' },
];

const ACCOUNT_FILTERS = [
  { id: '',         label: 'Any Status' },
  { id: 'active',   label: 'Active' },
  { id: 'inactive', label: 'Deactivated' },
];

const ROLE_BADGE = {
  admin:   'badge-confirmed',
  premium: 'badge-pending',
  user:    'badge-rejected',
};

const ROLE_LABEL = {
  admin:   'Administrator',
  premium: 'Premium',
  user:    'Regular',
};

/**
 * Convert a premium expiry date to a short human status string.
 */
function premiumExpiryLabel(expiry) {
  if (!expiry) return null;
  const days = Math.floor((new Date(expiry) - new Date()) / 86400000);
  if (days > 31) return `Expires in ${Math.floor(days / 30)} months`;
  if (days > 0)  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  return 'Expired';
}

/**
 * Users & Premium management section for the admin portal.
 * Pass `presetRole` ("premium") from the sidebar to open with the
 * premium accounts pre-filtered.
 */
export default function AdminUsers({ presetRole = '', showNotif }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(presetRole);
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [detail, setDetail] = useState(null);        // open user detail modal
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // {type, id, label}

  const notify = showNotif || ((msg) => setError(msg));

  const load = async (page = pagination.page) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await adminUsersApi.list(params);
      setUsers(Array.isArray(data?.data) ? data.data : []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  // Reload when filters change (debounced on search)
  useEffect(() => {
    if (search === undefined) return;
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const user = await adminUsersApi.get(id);
      setDetail(user);
    } catch (err) {
      notify(`Error: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id, extra } = confirmAction;
    setActionLoading(`${type}-${id}`);
    try {
      let res;
      if (type === 'activate')      res = await adminUsersApi.setActive(id, true);
      else if (type === 'deactivate') res = await adminUsersApi.setActive(id, false);
      else if (type === 'grant')      res = await adminUsersApi.grantPremium(id, extra || 12);
      else if (type === 'revoke')     res = await adminUsersApi.revokePremium(id);
      notify(res.message || 'Done.');
      setConfirmAction(null);
      await load();
    } catch (err) {
      notify(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="adm-content">
      <div className="adm-page-header">
        <div>
          <h1 className="text-headline-md">Users & Premium</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            Manage registered accounts, premium access, and account status ({pagination.total} accounts)
          </p>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="adm-filters" style={{ marginBottom: 'var(--space-md)' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
          aria-label="Search users"
        />
        <select className="input-field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
          {ROLE_FILTERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by account status">
          {ACCOUNT_FILTERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => load()}>Refresh</button>
      </div>

      {error && (
        <div className="adminlogin-error" style={{ marginBottom: 'var(--space-md)' }}>
          <span className="material-symbols-outlined">error</span>{error}
        </div>
      )}

      {/* ---- Users Table ---- */}
      <div className="adm-section glass-card">
        <div className="adm-table-wrap">
          {loading ? (
            <div className="adm-empty" style={{ padding: 'var(--space-lg)' }}>
              <div className="conf-loading__spinner" />
            </div>
          ) : users.length === 0 ? (
            <div className="adm-empty">
              <span className="material-symbols-outlined">group</span>
              <p>No accounts match these filters.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Account</th><th>Email</th><th>Role</th>
                  <th>Premium</th><th>Status</th><th>Joined</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const expiryLabel = premiumExpiryLabel(u.premium_expiry);
                  // PDO may serialize MySQL booleans as the strings '1'/'0'.
                  const active = u.is_active === true || u.is_active === 1 || u.is_active === '1';
                  return (
                    <tr key={u.user_id}>
                      <td>#{u.user_id}</td>
                      <td>
                        <button className="adm-user-link" onClick={() => openDetail(u.user_id)} title="View details">
                          {u.full_name}
                        </button>
                      </td>
                      <td>{u.email}</td>
                      <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role] || u.role}</span></td>
                      <td>
                        {u.role === 'premium' || u.premium_since
                          ? <span className="text-body-sm">{expiryLabel || 'Active'}</span>
                          : <span className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>—</span>}
                      </td>
                      <td>
                        <span className={`badge ${active ? 'badge-confirmed' : 'badge-rejected'}`}>
                          {active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>{u.created_at ? String(u.created_at).slice(0, 10) : '—'}</td>
                      <td>
                        <div className="adm-table-actions">
                          {u.role !== 'premium' ? (
                            <button
                              className="btn btn-gold btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => setConfirmAction({ type: 'grant', id: u.user_id, label: `Grant premium to ${u.full_name}?` })}
                              title="Grant premium access"
                            >
                              <span className="material-symbols-outlined">workspace_premium</span>
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => setConfirmAction({ type: 'revoke', id: u.user_id, label: `Revoke premium for ${u.full_name}?` })}
                              title="Revoke premium access"
                            >
                              <span className="material-symbols-outlined">cancel</span>
                            </button>
                          )}
                          {active ? (
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => setConfirmAction({ type: 'deactivate', id: u.user_id, label: `Deactivate account ${u.email}? The user will not be able to log in.` })}
                              title="Deactivate account"
                            >
                              <span className="material-symbols-outlined">block</span>
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => setConfirmAction({ type: 'activate', id: u.user_id, label: `Re-activate account ${u.email}?` })}
                              title="Activate account"
                            >
                              <span className="material-symbols-outlined">check_circle</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ---- Pagination ---- */}
        {pagination.pages > 1 && (
          <div className="adm-pagination" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
            <button className="btn btn-ghost btn-sm" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>
              Previous
            </button>
            <span className="text-body-sm">Page {pagination.page} of {pagination.pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>
              Next
            </button>
          </div>
        )}
      </div>

      {/* ---- Confirmation dialog ---- */}
      {confirmAction && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setConfirmAction(null)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} role="dialog" aria-modal="true">
            <div className="adm-modal-header">
              <h2 className="text-headline-sm">Confirm Action</h2>
              <button className="adm-modal-close" onClick={() => setConfirmAction(null)} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p style={{ margin: 'var(--space-md) 0' }}>{confirmAction.label}</p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={runConfirmAction}
                disabled={!!actionLoading}
              >
                {actionLoading ? 'Working...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- User detail modal ---- */}
      {(detail || detailLoading) && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal-box" style={{ maxWidth: '640px' }} role="dialog" aria-modal="true">
            <div className="adm-modal-header">
              <h2 className="text-headline-sm">{detail ? detail.full_name : 'Loading…'}</h2>
              <button className="adm-modal-close" onClick={() => setDetail(null)} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {detailLoading || !detail ? (
              <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                <div className="conf-loading__spinner" />
              </div>
            ) : (
              <div className="adm-user-detail">
                <div className="adm-detail-grid">
                  <div><span className="text-label-caps">Email</span><div className="text-body-md">{detail.email}</div></div>
                  <div><span className="text-label-caps">Phone</span><div className="text-body-md">{detail.phone || '—'}</div></div>
                  <div>
                    <span className="text-label-caps">Role</span>
                    <div><span className={`badge ${ROLE_BADGE[detail.role]}`}>{ROLE_LABEL[detail.role] || detail.role}</span></div>
                  </div>
                  <div>
                    <span className="text-label-caps">Account Status</span>
                    <div>
                      <span className={`badge ${detail.is_active ? 'badge-confirmed' : 'badge-rejected'}`}>
                        {detail.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-label-caps">Premium Since</span>
                    <div className="text-body-md">{detail.premium_since || '—'}</div>
                  </div>
                  <div>
                    <span className="text-label-caps">Premium Expiry</span>
                    <div className="text-body-md">
                      {detail.premium_expiry || '—'}
                      {premiumExpiryLabel(detail.premium_expiry) && (
                        <span className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {' '}· {premiumExpiryLabel(detail.premium_expiry)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div><span className="text-label-caps">Registered</span><div className="text-body-md">{detail.created_at ? String(detail.created_at).slice(0, 10) : '—'}</div></div>
                  <div><span className="text-label-caps">Last Login</span><div className="text-body-md">{detail.last_login || 'Never'}</div></div>
                </div>

                <h3 className="text-headline-sm" style={{ margin: 'var(--space-md) 0 var(--space-sm)' }}>
                  Booking History
                </h3>
                {detail.bookings.length === 0 ? (
                  <div className="adm-empty" style={{ padding: 'var(--space-md)' }}>
                    <span className="material-symbols-outlined">confirmation_number</span>
                    <p>No bookings found for this account.</p>
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th><th>Package</th><th>Date</th><th>Amount</th>
                          <th>Booking</th><th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.bookings.map((b) => (
                          <tr key={b.booking_id}>
                            <td>#{b.booking_id}</td>
                            <td>{b.package_name}<div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{b.destination}</div></td>
                            <td>{b.booking_date}</td>
                            <td>{formatPrice(b.total_cost)}</td>
                            <td><span className="badge badge-pending">{b.booking_status}</span></td>
                            <td>
                              <span className={`adm-pay-badge ${b.payment_status === 'paid' ? 'adm-pay-badge--paid' : b.payment_status === 'failed' ? 'adm-pay-badge--failed' : ''}`}>
                                {b.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
