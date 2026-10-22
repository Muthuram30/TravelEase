import { useState, useEffect, useCallback } from 'react';
import { adminPaymentsApi, adminUpiConfigApi } from '../../api/api';
import { formatPrice } from '../../components/PackageCard';
import './AdminPayments.css';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    date_from: '',
    date_to: '',
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [upiConfig, setUpiConfig] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    merchant_upi_id: '',
    merchant_name: '',
    is_active: false,
    notes: '',
  });
  const [configLoading, setConfigLoading] = useState(false);

  // Status config
  const statusConfig = {
    pending_qr: { label: 'Awaiting Payment', color: 'var(--color-tertiary)', bg: 'var(--color-tertiary-fixed)', icon: 'qr_code' },
    pending_verification: { label: 'Pending Verification', color: 'var(--color-tertiary)', bg: 'var(--color-tertiary-fixed)', icon: 'schedule' },
    verified: { label: 'Verified', color: 'var(--color-secondary)', bg: 'var(--color-secondary-container)', icon: 'check_circle' },
    rejected: { label: 'Rejected', color: 'var(--color-error)', bg: 'var(--color-error-container)', icon: 'cancel' },
    expired: { label: 'Expired', color: 'var(--color-on-surface-variant)', bg: 'var(--color-surface-container-high)', icon: 'timer_off' },
    cancelled: { label: 'Cancelled', color: 'var(--color-on-surface-variant)', bg: 'var(--color-surface-container-high)', icon: 'close' },
  };

  // Load payments
  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      };
      // Remove empty params
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) delete params[key];
      });
      const data = await adminPaymentsApi.list(params);
      setPayments(data.data);
      setPagination(prev => ({ ...prev, total: data.pagination.total, pages: data.pagination.pages }));
    } catch (err) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Load UPI config
  useEffect(() => {
    adminUpiConfigApi.get()
      .then(setUpiConfig)
      .catch(() => setUpiConfig(null));
  }, []);

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // View payment details
  const viewPayment = async (paymentId) => {
    try {
      const data = await adminPaymentsApi.get(paymentId);
      setSelectedPayment(data);
      // Load audit log
      const audit = await adminPaymentsApi.getAuditLog(paymentId);
      setAuditLog(audit);
    } catch (err) {
      setError(err.message || 'Failed to load payment details.');
    }
  };

  // Close detail modal
  const closeDetail = () => {
    setSelectedPayment(null);
    setAuditLog([]);
    setShowAudit(false);
  };

  // Toggle audit log
  const toggleAudit = () => setShowAudit(!showAudit);

  // Verify payment
  const handleVerify = async (paymentId) => {
    const notes = prompt('Verification notes (optional):') || '';
    setActionLoading(paymentId);
    try {
      await adminPaymentsApi.verify(paymentId, notes);
      loadPayments();
      if (selectedPayment?.payment_id === paymentId) {
        viewPayment(paymentId);
      }
    } catch (err) {
      setError(err.message || 'Failed to verify payment.');
    } finally {
      setActionLoading(null);
    }
  };

  // Reject payment
  const handleReject = async (paymentId) => {
    const reason = prompt('Rejection reason (required):');
    if (!reason) return;
    setActionLoading(paymentId);
    try {
      await adminPaymentsApi.reject(paymentId, reason);
      loadPayments();
      if (selectedPayment?.payment_id === paymentId) {
        viewPayment(paymentId);
      }
    } catch (err) {
      setError(err.message || 'Failed to reject payment.');
    } finally {
      setActionLoading(null);
    }
  };

  // Expire payment
  const handleExpire = async (paymentId) => {
    if (!confirm('Mark this payment as expired?')) return;
    setActionLoading(paymentId);
    try {
      await adminPaymentsApi.expire(paymentId);
      loadPayments();
      if (selectedPayment?.payment_id === paymentId) {
        viewPayment(paymentId);
      }
    } catch (err) {
      setError(err.message || 'Failed to expire payment.');
    } finally {
      setActionLoading(null);
    }
  };

  // Open config modal
  const openConfigModal = () => {
    setConfigForm({
      merchant_upi_id: upiConfig?.merchant_upi_id || '',
      merchant_name: upiConfig?.merchant_name || '',
      is_active: upiConfig?.is_active || false,
      notes: upiConfig?.notes || '',
    });
    setShowConfigModal(true);
  };

  // Save config
  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      await adminUpiConfigApi.update(configForm);
      setUpiConfig(configForm);
      setShowConfigModal(false);
    } catch (err) {
      setError(err.message || 'Failed to save config.');
    } finally {
      setConfigLoading(false);
    }
  };

  if (loading && payments.length === 0) {
    return (
      <div className="admin-payments">
        <div className="admin-payments__loading">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="admin-payments">
      {/* Header */}
      <div className="admin-payments__header">
        <div>
          <h1 className="text-headline-lg">Payment Management</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            Manage UPI QR payments, verify transactions, and configure merchant settings.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openConfigModal}>
          <span className="material-symbols-outlined">settings</span>
          UPI Config
        </button>
      </div>

      {/* UPI Config Status */}
      <div className="admin-payments__config-status glass-card">
        <div className="admin-payments__config-info">
          <div className="admin-payments__config-label">Merchant UPI Config</div>
          {upiConfig ? (
            <>
              <div className="admin-payments__config-value">
                {upiConfig.is_active ? (
                  <span className="badge badge-confirmed">Active</span>
                ) : (
                  <span className="badge badge-pending">Inactive</span>
                )}
                <strong> {upiConfig.merchant_name}</strong> ({upiConfig.merchant_upi_id})
              </div>
            </>
          ) : (
            <div className="admin-payments__config-value" style={{ color: 'var(--color-error)' }}>
              <span className="badge badge-rejected">Not Configured</span>
            </div>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={openConfigModal}>
          <span className="material-symbols-outlined">edit</span>
          {upiConfig ? 'Edit Config' : 'Configure'}
        </button>
      </div>

      {/* Filters */}
      <div className="admin-payments__filters glass-card">
        <div className="admin-payments__filter-row">
          <div className="input-group" style={{ flex: 1, minWidth: 250 }}>
            <label>
              <span className="material-symbols-outlined">search</span>
              Search
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Customer, package, UPI ref, UTR..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>
              <span className="material-symbols-outlined">filter_list</span>
              Status
            </label>
            <select className="input-field" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="pending_qr">Awaiting Payment</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="input-group">
            <label>
              <span className="material-symbols-outlined">date_range</span>
              From
            </label>
            <input type="date" className="input-field" value={filters.date_from} onChange={(e) => handleFilterChange('date_from', e.target.value)} />
          </div>
          <div className="input-group">
            <label>
              <span className="material-symbols-outlined">date_range</span>
              To
            </label>
            <input type="date" className="input-field" value={filters.date_to} onChange={(e) => handleFilterChange('date_to', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="admin-payments__table-container glass-card">
        {error && (
          <div className="admin-payments__error">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Booking</th>
              <th>Customer</th>
              <th>Package</th>
              <th>Amount</th>
              <th>Status</th>
              <th>UTR</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-on-surface-variant)' }}>receipt_long</span>
                  <div className="text-body-md" style={{ marginTop: 'var(--space-sm)', color: 'var(--color-on-surface-variant)' }}>No payments found.</div>
                </td>
              </tr>
            ) : (
              payments.map((p) => {
                const sc = statusConfig[p.payment_status] || statusConfig.pending_qr;
                return (
                  <tr key={p.payment_id} onClick={() => viewPayment(p.payment_id)} style={{ cursor: 'pointer' }}>
                    <td className="text-body-sm" style={{ fontFamily: 'monospace' }}>#{p.payment_id}</td>
                    <td className="text-body-sm">
                      <div style={{ fontWeight: 600 }}>Booking #{p.booking_id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>{p.upi_order_ref}</div>
                    </td>
                    <td className="text-body-sm">
                      <div>{p.customer_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>{p.customer_email}</div>
                    </td>
                    <td className="text-body-sm">{p.package_name}</td>
                    <td className="text-body-sm" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {formatPrice(p.amount_expected)} {p.currency}
                    </td>
                    <td>
                      <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '10px', verticalAlign: 'middle', marginRight: '2px' }}>{sc.icon}</span>
                        {sc.label}
                      </span>
                    </td>
                    <td className="text-body-sm" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {p.submitted_utr || <span style={{ color: 'var(--color-on-surface-variant)' }}>—</span>}
                    </td>
                    <td className="text-body-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="admin-payments__actions">
                        <button
                          type="button"
                          className="admin-payments__action-btn"
                          onClick={(e) => { e.stopPropagation(); viewPayment(p.payment_id); }}
                          title="View Details"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        {p.payment_status === 'pending_verification' && (
                          <>
                            <button
                              type="button"
                              className="admin-payments__action-btn admin-payments__action-btn--verify"
                              onClick={(e) => { e.stopPropagation(); handleVerify(p.payment_id); }}
                              disabled={actionLoading === p.payment_id}
                              title="Verify Payment"
                            >
                              <span className="material-symbols-outlined">verified</span>
                            </button>
                            <button
                              type="button"
                              className="admin-payments__action-btn admin-payments__action-btn--reject"
                              onClick={(e) => { e.stopPropagation(); handleReject(p.payment_id); }}
                              disabled={actionLoading === p.payment_id}
                              title="Reject Payment"
                            >
                              <span className="material-symbols-outlined">cancel</span>
                            </button>
                          </>
                        )}
                        {p.payment_status === 'pending_qr' && (
                          <button
                            type="button"
                            className="admin-payments__action-btn admin-payments__action-btn--expire"
                            onClick={(e) => { e.stopPropagation(); handleExpire(p.payment_id); }}
                            disabled={actionLoading === p.payment_id}
                            title="Mark Expired"
                          >
                            <span className="material-symbols-outlined">timer_off</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="admin-payments__pagination">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <span className="material-symbols-outlined">chevron_left</span>
              Previous
            </button>
            <span className="admin-payments__page-info">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
            >
              Next
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="admin-payments__modal-overlay" onClick={closeDetail}>
          <div className="admin-payments__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-payments__modal-header">
              <div>
                <div className="text-headline-md">Payment Details</div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Payment #{selectedPayment.payment_id} • Booking #{selectedPayment.booking_id}
                </div>
              </div>
              <button type="button" className="admin-payments__close" onClick={closeDetail}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="admin-payments__modal-body">
              <div className="admin-payments__modal-grid">
                {/* Left: Payment Info */}
                <div className="admin-payments__modal-section">
                  <h3 className="text-title-md">Payment Information</h3>
                  <div className="admin-payments__detail-grid">
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Payment ID</span>
                      <span className="admin-payments__detail-value" style={{ fontFamily: 'monospace' }}>#{selectedPayment.payment_id}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Booking ID</span>
                      <span className="admin-payments__detail-value">#{selectedPayment.booking_id}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">UPI Order Ref</span>
                      <span className="admin-payments__detail-value" style={{ fontFamily: 'monospace' }}>{selectedPayment.upi_order_ref}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Amount</span>
                      <span className="admin-payments__detail-value" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                        {formatPrice(selectedPayment.amount_expected)} {selectedPayment.currency}
                      </span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Status</span>
                      <span className="admin-payments__detail-value">
                        <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '10px', verticalAlign: 'middle', marginRight: '2px' }}>{sc.icon}</span>
                          {sc.label}
                        </span>
                      </span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Submitted UTR</span>
                      <span className="admin-payments__detail-value" style={{ fontFamily: 'monospace' }}>
                        {selectedPayment.submitted_utr || <span style={{ color: 'var(--color-on-surface-variant)' }}>—</span>}
                      </span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Created</span>
                      <span className="admin-payments__detail-value">{new Date(selectedPayment.created_at).toLocaleString()}</span>
                    </div>
                    {selectedPayment.verified_at && (
                      <div className="admin-payments__detail">
                        <span className="admin-payments__detail-label">Verified</span>
                        <span className="admin-payments__detail-value">{new Date(selectedPayment.verified_at).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedPayment.verified_by_name && (
                      <div className="admin-payments__detail">
                        <span className="admin-payments__detail-label">Verified By</span>
                        <span className="admin-payments__detail-value">{selectedPayment.verified_by_name}</span>
                      </div>
                    )}
                    {selectedPayment.rejection_reason && (
                      <div className="admin-payments__detail" style={{ gridColumn: '1 / -1' }}>
                        <span className="admin-payments__detail-label" style={{ color: 'var(--color-error)' }}>Rejection Reason</span>
                        <span className="admin-payments__detail-value" style={{ color: 'var(--color-error)' }}>{selectedPayment.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Customer & Booking */}
                <div className="admin-payments__modal-section">
                  <h3 className="text-title-md">Customer & Booking</h3>
                  <div className="admin-payments__detail-grid">
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Customer</span>
                      <span className="admin-payments__detail-value">{selectedPayment.customer_name}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Email</span>
                      <span className="admin-payments__detail-value">{selectedPayment.customer_email}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Phone</span>
                      <span className="admin-payments__detail-value">{selectedPayment.customer_phone}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Package</span>
                      <span className="admin-payments__detail-value">{selectedPayment.package_name}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Destination</span>
                      <span className="admin-payments__detail-value">{selectedPayment.destination}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Duration</span>
                      <span className="admin-payments__detail-value">{selectedPayment.duration} days</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Booking Status</span>
                      <span className="admin-payments__detail-value">{selectedPayment.booking_status}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Booking Payment Status</span>
                      <span className="admin-payments__detail-value">{selectedPayment.booking_payment_status}</span>
                    </div>
                  </div>
                </div>

                {/* UPI Details */}
                <div className="admin-payments__modal-section" style={{ gridColumn: '1 / -1' }}>
                  <h3 className="text-title-md">UPI Payment Details</h3>
                  <div className="admin-payments__detail-grid">
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Merchant Name</span>
                      <span className="admin-payments__detail-value">{selectedPayment.merchant_name}</span>
                    </div>
                    <div className="admin-payments__detail">
                      <span className="admin-payments__detail-label">Merchant UPI ID</span>
                      <span className="admin-payments__detail-value" style={{ fontFamily: 'monospace' }}>{selectedPayment.merchant_upi_id}</span>
                    </div>
                    <div className="admin-payments__detail" style={{ gridColumn: '1 / -1' }}>
                      <span className="admin-payments__detail-label">QR Payload</span>
                      <code style={{ display: 'block', wordBreak: 'break-all', background: 'var(--color-surface-container)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', fontSize: '11px' }}>
                        {selectedPayment.qr_payload}
                      </code>
                    </div>
                    {selectedPayment.receipt_path && (
                      <div className="admin-payments__detail" style={{ gridColumn: '1 / -1' }}>
                        <span className="admin-payments__detail-label">Receipt</span>
                        <a href={selectedPayment.receipt_path} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                          <span className="material-symbols-outlined">visibility</span>
                          View Receipt
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit Log */}
                <div className="admin-payments__modal-section" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <h3 className="text-title-md" style={{ margin: 0 }}>Audit Log</h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAudit}>
                      {showAudit ? 'Hide' : 'Show'} Audit Log
                    </button>
                  </div>
                  {showAudit && (
                    <div className="admin-payments__audit-log">
                      {auditLog.length === 0 ? (
                        <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)', textAlign: 'center', padding: 'var(--space-lg)' }}>
                          No audit entries.
                        </div>
                      ) : (
                        auditLog.map((entry) => (
                          <div key={entry.audit_id} className="admin-payments__audit-entry">
                            <div className="admin-payments__audit-entry-header">
                              <span className="admin-payments__audit-status">
                                {entry.old_status ? (
                                  <>
                                    <span className="badge badge-pending">{entry.old_status}</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle', margin: '0 4px' }}>arrow_forward</span>
                                  </>
                                ) : (
                                  <span className="badge badge-pending">Created</span>
                                )}
                                <span className="badge" style={{ background: (() => {
                                  const s = statusConfig[entry.new_status];
                                  return s ? s.bg : 'var(--color-primary-container)';
                                })(), color: (() => {
                                  const s = statusConfig[entry.new_status];
                                  return s ? s.color : 'var(--color-primary)';
                                })() }}>
                                  {entry.new_status}
                                </span>
                              </span>
                              <div className="admin-payments__audit-actor">
                                {entry.actor_type} • {entry.actor_name || 'Unknown'} • {new Date(entry.created_at).toLocaleString()}
                              </div>
                            </div>
                            {entry.details && Object.keys(entry.details).length > 0 && (
                              <div className="admin-payments__audit-details">
                                <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPI Config Modal */}
      {showConfigModal && (
        <div className="admin-payments__modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="admin-payments__modal admin-payments__modal--small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-payments__modal-header">
              <div className="text-headline-md">UPI Merchant Configuration</div>
              <button type="button" className="admin-payments__close" onClick={() => setShowConfigModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="admin-payments__modal-body" style={{ padding: 'var(--space-lg)' }}>
              <div className="input-group">
                <label htmlFor="admin-upi-id">
                  <span className="material-symbols-outlined">account_balance</span>
                  Merchant UPI ID *
                </label>
                <input
                  id="admin-upi-id"
                  type="text"
                  className="input-field"
                  placeholder="merchant@upi"
                  value={configForm.merchant_upi_id}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, merchant_upi_id: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="admin-merchant-name">
                  <span className="material-symbols-outlined">storefront</span>
                  Merchant Display Name *
                </label>
                <input
                  id="admin-merchant-name"
                  type="text"
                  className="input-field"
                  placeholder="TravelEase Merchant"
                  value={configForm.merchant_name}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, merchant_name: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-group__checkbox">
                  <input
                    type="checkbox"
                    checked={configForm.is_active}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span>Active (enable UPI payments)</span>
                </label>
              </div>
              <div className="input-group">
                <label htmlFor="admin-notes">
                  <span className="material-symbols-outlined">notes</span>
                  Notes
                </label>
                <textarea
                  id="admin-notes"
                  className="input-field"
                  rows={3}
                  placeholder="Internal notes..."
                  value={configForm.notes}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="admin-payments__modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowConfigModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveConfig} disabled={configLoading}>
                  {configLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}