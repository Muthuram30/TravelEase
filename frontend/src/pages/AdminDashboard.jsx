import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, authApi, adminBookingsApi, touristsApi, packagesApi } from '../api/api';
import { formatPrice } from '../components/PackageCard';
import AdminPayments from './admin/AdminPayments';
import './AdminDashboard.css';

// ---- Admin sidebar nav items ----
const NAV = [
  { id: 'dashboard', icon: 'dashboard',        label: 'Dashboard' },
  { id: 'bookings',  icon: 'confirmation_number',label: 'Bookings' },
  { id: 'packages',  icon: 'luggage',           label: 'Packages' },
  { id: 'tourists',  icon: 'groups',             label: 'Tourists' },
  { id: 'payments',  icon: 'payments',           label: 'Payments' },
  { id: 'food',      icon: 'restaurant',         label: 'Food Partners' },
];

const STATUS_BADGE = {
  Pending:   'badge-pending',
  Confirmed: 'badge-confirmed',
  Cancelled: 'badge-cancelled',
  Rejected:  'badge-rejected',
};

export default function AdminDashboard() {
  const navigate              = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [admin, setAdmin]     = useState(null);
  const [stats, setStats]     = useState(null);
  const [bookings, setBookings] = useState([]);
  const [packages, setPackages] = useState([]);
  const [tourists, setTourists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [notification, setNotification]   = useState('');
  const [searchTerm, setSearchTerm]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [modal, setModal]     = useState({ type: '', data: null });

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  // Verify admin auth on load
  useEffect(() => {
    authApi.me()
      .then((user) => {
        if (user.role !== 'admin') throw new Error('Admin access required');
        setAdmin(user);
      })
      .catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  // Load data based on active tab
  useEffect(() => {
    if (!admin) return;
    if (activeTab === 'dashboard') dashboardApi.getStats().then(setStats).catch(() => {});
    if (activeTab === 'bookings')  loadBookings();
    if (activeTab === 'packages')  packagesApi.list().then(setPackages).catch(() => {});
    if (activeTab === 'tourists')  touristsApi.list().then(setTourists).catch(() => {});
  }, [activeTab, admin]);

  const loadBookings = () => {
    const params = {};
    if (searchTerm)   params.search = searchTerm;
    if (statusFilter) params.status = statusFilter;
    adminBookingsApi.list(params).then(setBookings).catch(() => {});
  };

  useEffect(() => {
    if (activeTab === 'bookings' && admin) loadBookings();
  }, [searchTerm, statusFilter]);

  const handleLogout = async () => {
    await authApi.logout();
    navigate('/admin/login');
  };

  const handleBookingAction = async (id, action) => {
    setActionLoading(`${action}-${id}`);
    try {
      await adminBookingsApi[action](id);
      showNotif(`Booking #${id} ${action}ed successfully.`);
      loadBookings();
      if (activeTab === 'dashboard') dashboardApi.getStats().then(setStats);
    } catch (err) {
      showNotif(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleDeletePackage = async (id) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    try {
      await packagesApi.delete(id);
      setPackages((p) => p.filter((pkg) => pkg.package_id !== id));
      showNotif('Package deleted.');
    } catch (err) {
      showNotif(`Error: ${err.message}`);
    }
  };

  const handleDeleteTourist = async (id) => {
    if (!confirm('Delete this tourist? This cannot be undone.')) return;
    try {
      await touristsApi.delete(id);
      setTourists((t) => t.filter((t2) => t2.tourist_id !== id));
      showNotif('Tourist deleted.');
    } catch (err) {
      showNotif(`Error: ${err.message}`);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="conf-loading__spinner" />
    </div>
  );

  return (
    <div className="adm-layout">
      {/* ---- Notification Toast ---- */}
      {notification && (
        <div className="adm-toast animate-fade-up">{notification}</div>
      )}

      {/* ---- Sidebar ---- */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar__brand">
          <div className="adm-sidebar__logo">
            <span className="material-symbols-outlined">flight_takeoff</span>
          </div>
          <div>
            <div className="adm-sidebar__name text-title-md">TravelEase</div>
            <div className="text-label-caps adm-sidebar__sub">Admin Portal</div>
          </div>
        </div>

        <nav className="adm-sidebar__nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`adm-nav-item ${activeTab === item.id ? 'adm-nav-item--active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="adm-sidebar__footer">
          {admin && (
            <div className="adm-admin-info">
              <div className="adm-admin-avatar">
                {(admin.full_name || admin.username || 'A')[0].toUpperCase()}
              </div>
              <div>
                <div className="text-label-lg">{admin.full_name || admin.username}</div>
                <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>Administrator</div>
              </div>
            </div>
          )}
          <div className="adm-sidebar__links">
            <Link to="/" className="adm-link text-label-md">
              <span className="material-symbols-outlined">home</span> Public Site
            </Link>
            <button className="adm-link text-label-md" onClick={handleLogout}>
              <span className="material-symbols-outlined">logout</span> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ---- Main Content ---- */}
      <main className="adm-main">
        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === 'dashboard' && stats && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="text-headline-md">Dashboard</h1>
                <p className="text-body-sm" style={{color:'var(--color-on-surface-variant)'}}>Overview of TravelEase operations</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="adm-stats-grid">
              {[
                { label: 'Total Tourists',  value: stats.total_tourists,  icon: 'groups',      color: 'var(--color-primary)' },
                { label: 'Tour Packages',   value: stats.total_packages,  icon: 'luggage',     color: 'var(--color-secondary)' },
                { label: 'Total Bookings',  value: stats.total_bookings,  icon: 'confirmation_number', color: 'var(--color-tertiary)' },
                { label: 'Revenue (Conf.)', value: formatPrice(stats.total_revenue), icon: 'payments', color: 'var(--color-primary)' },
              ].map((s) => (
                <div key={s.label} className="adm-stat">
                  <div className="adm-stat__icon" style={{background:`${s.color}18`, color:s.color}}>
                    <span className="material-symbols-outlined">{s.icon}</span>
                  </div>
                  <div className="adm-stat__value text-headline-lg">{s.value}</div>
                  <div className="adm-stat__label text-body-sm">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Booking Status Breakdown */}
            <div className="adm-cards-row">
              {[
                { label: 'Pending',   value: stats.pending_bookings,   cls: 'badge-pending' },
                { label: 'Confirmed', value: stats.confirmed_bookings, cls: 'badge-confirmed' },
                { label: 'Cancelled', value: stats.cancelled_bookings, cls: 'badge-cancelled' },
                { label: 'Rejected',  value: stats.rejected_bookings,  cls: 'badge-rejected' },
              ].map((s) => (
                <div key={s.label} className="adm-status-card glass-card">
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <div className="text-headline-lg adm-status-card__val">{s.value}</div>
                  <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>bookings</div>
                </div>
              ))}
            </div>

            {/* Next Client */}
            {stats.next_client && (
              <div className="adm-next-client glass-card">
                <div className="adm-next-client__header">
                  <div>
                    <div className="text-label-caps" style={{color:'var(--color-tertiary)'}}>Next Client to Assist</div>
                    <div className="text-headline-sm">{stats.next_client.customer_name}</div>
                    <div className="text-body-sm" style={{color:'var(--color-on-surface-variant)'}}>
                      {stats.next_client.customer_phone} · {stats.next_client.customer_email}
                    </div>
                  </div>
                  <div>
                    <span className="badge badge-pending">Pending</span>
                    <div className="text-label-caps" style={{marginTop: '4px', color:'var(--color-on-surface-variant)'}}>Booking #{stats.next_client.booking_id}</div>
                  </div>
                </div>
                <div className="adm-next-client__pkg">
                  <span className="material-symbols-outlined">luggage</span>
                  <span>{stats.next_client.package_name} — {stats.next_client.destination}</span>
                  <span className="adm-next-client__cost">{formatPrice(stats.next_client.total_cost)}</span>
                </div>
                <div className="adm-next-client__actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => { setActiveTab('bookings'); setStatusFilter('Pending'); }}>
                    View Pending Bookings
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Recent bookings */}
            <div className="adm-section glass-card">
              <div className="adm-section__header">
                <h2 className="text-headline-sm">Recent Bookings</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('bookings')}>
                  View All <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
              <div className="adm-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th><th>Customer</th><th>Package</th><th>Amount</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_bookings.map((b) => (
                      <tr key={b.booking_id}>
                        <td>#{b.booking_id}</td>
                        <td>{b.customer_name}</td>
                        <td>{b.package_name}</td>
                        <td>{formatPrice(b.total_cost)}</td>
                        <td><span className={`badge ${STATUS_BADGE[b.booking_status]}`}>{b.booking_status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Revenue by destination */}
            {stats.revenue_by_destination.length > 0 && (
              <div className="adm-section glass-card">
                <div className="adm-section__header">
                  <h2 className="text-headline-sm">Revenue by Destination</h2>
                </div>
                <div className="adm-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Destination</th><th>Bookings</th><th>Revenue</th></tr>
                    </thead>
                    <tbody>
                      {stats.revenue_by_destination.map((r) => (
                        <tr key={r.destination}>
                          <td>{r.destination}</td>
                          <td>{r.total_bookings}</td>
                          <td>{formatPrice(r.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== BOOKINGS TAB ===== */}
        {activeTab === 'bookings' && (
          <div className="adm-content">
            <div className="adm-page-header">
              <h1 className="text-headline-md">Manage Bookings</h1>
              <div className="adm-filters">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search customer, package..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option>Pending</option>
                  <option>Confirmed</option>
                  <option>Cancelled</option>
                  <option>Rejected</option>
                </select>
              </div>
            </div>

            <div className="adm-section glass-card">
              <div className="adm-table-wrap">
                {bookings.length === 0 ? (
                  <div className="adm-empty">
                    <span className="material-symbols-outlined">inbox</span>
                    <p>No bookings found.</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th><th>Customer</th><th>Package</th><th>Date</th>
                        <th>Persons</th><th>Cost</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.booking_id}>
                          <td>#{b.booking_id}</td>
                          <td>
                            <div className="text-label-lg">{b.customer_name}</div>
                            <div className="text-body-sm" style={{color:'var(--color-on-surface-variant)'}}>{b.customer_phone}</div>
                          </td>
                          <td>
                            <div>{b.package_name}</div>
                            <div className="text-body-sm" style={{color:'var(--color-on-surface-variant)'}}>{b.destination}</div>
                          </td>
                          <td>{b.booking_date}</td>
                          <td>{b.number_of_persons}</td>
                          <td>{formatPrice(b.total_cost)}</td>
                          <td><span className={`badge ${STATUS_BADGE[b.booking_status]}`}>{b.booking_status}</span></td>
                          <td>
                            <div className="adm-table-actions">
                              {b.booking_status === 'Pending' && (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={!!actionLoading}
                                    onClick={() => handleBookingAction(b.booking_id, 'confirm')}
                                    title="Confirm"
                                  >
                                    {actionLoading === `confirm-${b.booking_id}`
                                      ? '...' : <span className="material-symbols-outlined">check_circle</span>}
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    disabled={!!actionLoading}
                                    onClick={() => handleBookingAction(b.booking_id, 'reject')}
                                    title="Reject"
                                  >
                                    {actionLoading === `reject-${b.booking_id}`
                                      ? '...' : <span className="material-symbols-outlined">block</span>}
                                  </button>
                                </>
                              )}
                              {b.booking_status === 'Confirmed' && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={!!actionLoading}
                                  onClick={() => handleBookingAction(b.booking_id, 'cancel')}
                                  title="Cancel"
                                >
                                  {actionLoading === `cancel-${b.booking_id}`
                                    ? '...' : <span className="material-symbols-outlined">cancel</span>}
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
          </div>
        )}

        {/* ===== PACKAGES TAB ===== */}
        {activeTab === 'packages' && (
          <div className="adm-content">
            <div className="adm-page-header">
              <h1 className="text-headline-md">Manage Packages</h1>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'package', data: null })}>
                <span className="material-symbols-outlined">add</span> Add Package
              </button>
            </div>

            <div className="adm-section glass-card">
              <div className="adm-table-wrap">
                {packages.length === 0 ? (
                  <div className="adm-empty"><span className="material-symbols-outlined">luggage</span><p>No packages found.</p></div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>ID</th><th>Package Name</th><th>Destination</th><th>Duration</th><th>Cost</th><th>Availability</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {packages.map((p) => (
                        <tr key={p.package_id}>
                          <td>#{p.package_id}</td>
                          <td className="text-label-lg">{p.package_name}</td>
                          <td>{p.destination}</td>
                          <td>{p.duration} days</td>
                          <td>{formatPrice(p.cost)}</td>
                          <td><span className={p.availability <= 5 ? 'adm-avail-low' : ''}>{p.availability}</span></td>
                          <td>
                            <div className="adm-table-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'package', data: p })}>
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeletePackage(p.package_id)}>
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== TOURISTS TAB ===== */}
        {activeTab === 'tourists' && (
          <div className="adm-content">
            <div className="adm-page-header">
              <h1 className="text-headline-md">Manage Tourists</h1>
              <div className="adm-filters">
                <input type="text" className="input-field" placeholder="Search tourists..."
                  onChange={(e) => touristsApi.list({ search: e.target.value }).then(setTourists).catch(() => {})}
                  style={{ minWidth: 220 }}
                />
              </div>
            </div>

            <div className="adm-section glass-card">
              <div className="adm-table-wrap">
                {tourists.length === 0 ? (
                  <div className="adm-empty"><span className="material-symbols-outlined">groups</span><p>No tourists found.</p></div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {tourists.map((t) => (
                        <tr key={t.tourist_id}>
                          <td>#{t.tourist_id}</td>
                          <td className="text-label-lg">{t.name}</td>
                          <td>{t.phone}</td>
                          <td>{t.email || '—'}</td>
                          <td>{t.address || '—'}</td>
                          <td>
                            <div className="adm-table-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'tourist', data: t })}>
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTourist(t.tourist_id)}>
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== PAYMENTS TAB ===== */}
        {activeTab === 'payments' && <AdminPayments />}

        {/* ===== FOOD PARTNERS TAB ===== */}
        {activeTab === 'food' && <AdminPayments />}
      </main>

      {/* ---- Modal: Package form ---- */}
      {modal.type === 'package' && (
        <PackageModal
          pkg={modal.data}
          onClose={() => setModal({ type: '', data: null })}
          onSave={(savedPkg) => {
            if (modal.data) {
              setPackages((prev) => prev.map((p) => p.package_id === savedPkg.package_id ? savedPkg : p));
              showNotif('Package updated.');
            } else {
              setPackages((prev) => [...prev, savedPkg]);
              showNotif('Package created.');
            }
            setModal({ type: '', data: null });
          }}
        />
      )}

      {/* ---- Modal: Tourist form ---- */}
      {modal.type === 'tourist' && (
        <TouristModal
          tourist={modal.data}
          onClose={() => setModal({ type: '', data: null })}
          onSave={(saved) => {
            if (modal.data) {
              setTourists((prev) => prev.map((t) => t.tourist_id === saved.tourist_id ? saved : t));
              showNotif('Tourist updated.');
            } else {
              setTourists((prev) => [...prev, saved]);
              showNotif('Tourist added.');
            }
            setModal({ type: '', data: null });
          }}
        />
      )}
    </div>
  );
}

/* ---- Package CRUD Modal ---- */
function PackageModal({ pkg, onClose, onSave }) {
  const [form, setForm]     = useState({
    package_name: pkg?.package_name || '',
    destination:  pkg?.destination  || '',
    duration:     pkg?.duration     || 1,
    cost:         pkg?.cost         || '',
    availability: pkg?.availability || 0,
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(pkg?.cover_image_url || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setImageError('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
      e.target.value = '';
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageError('File too large. Maximum size is 5MB.');
      e.target.value = '';
      return;
    }

    setImageError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview && !pkg?.cover_image_url) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(pkg?.cover_image_url || null);
    setImageError('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      e.target.files = dt.files;
      handleImageSelect(e);
    }
  };

  const uploadCoverImage = async (packageId) => {
    if (!imageFile) return null;

    setUploadingImage(true);
    setImageError('');

    try {
      const formData = new FormData();
      formData.append('package_id', packageId);
      formData.append('images[]', imageFile);
      formData.append('caption_0', '');
      formData.append('display_order_0', '1');
      formData.append('image_type', 'primary');

      const data = await packagesApi.images.upload(formData);

      if (data.uploaded && data.uploaded.length > 0) {
        const imageUrl = data.uploaded[0].image_url;
        
        // Update the package with the cover image URL
        await packagesApi.update(packageId, { cover_image_url: imageUrl });
        
        // Clean up
        if (imagePreview && !pkg?.cover_image_url) {
          URL.revokeObjectURL(imagePreview);
        }
        
        return imageUrl;
      }
      throw new Error('No image uploaded');
    } catch (err) {
      setImageError(err.message || 'Failed to upload image');
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let data;
      if (pkg) {
        data = await packagesApi.update(pkg.package_id, { 
          ...form, 
          duration: Number(form.duration), 
          cost: Number(form.cost), 
          availability: Number(form.availability) 
        });
      } else {
        data = await packagesApi.create({ 
          ...form, 
          duration: Number(form.duration), 
          cost: Number(form.cost), 
          availability: Number(form.availability) 
        });
      }

      // Upload cover image if selected
      if (imageFile && data.package_id) {
        await uploadCoverImage(data.package_id);
      }

      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:') && !pkg?.cover_image_url) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview, pkg?.cover_image_url]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }}>
        <div className="adm-modal-header">
          <h2 className="text-headline-sm">{pkg ? 'Edit Package' : 'Add Package'}</h2>
          <button className="adm-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        {error && <div className="adminlogin-error" style={{marginBottom:'var(--space-md)'}}><span className="material-symbols-outlined">error</span>{error}</div>}
        <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          {[
            { name: 'package_name', label: 'Package Name', type: 'text', required: true },
            { name: 'destination',  label: 'Destination',  type: 'text', required: true },
            { name: 'duration',     label: 'Duration (days)', type: 'number', min: 1 },
            { name: 'cost',         label: 'Cost per person (₹)', type: 'number', min: 0 },
            { name: 'availability', label: 'Available Slots', type: 'number', min: 0 },
          ].map((f) => (
            <div className="input-group" key={f.name}>
              <label htmlFor={`pkg-${f.name}`}>{f.label}</label>
              <input id={`pkg-${f.name}`} name={f.name} type={f.type} className="input-field"
                value={form[f.name]} onChange={handle} required={f.required} min={f.min} />
            </div>
          ))}

          {/* Package Cover Image Upload */}
          <div className="input-group">
            <label>
              <span className="material-symbols-outlined">image</span>
              Package Cover Photo
            </label>
            <div className="image-upload-area">
              <div
                className={`image-dropzone ${imagePreview ? 'has-image' : ''}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={(e) => e.target === e.currentTarget && document.getElementById('pkg-cover-image')?.click()}
              >
                {imagePreview ? (
                  <div className="image-preview-wrapper">
                    <img src={imagePreview} alt="Cover preview" className="image-preview" />
                    <button
                      type="button"
                      className="image-remove-btn"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                      title="Remove image"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined upload-icon">cloud_upload</span>
                    <p className="upload-text">Drag & drop an image here, or click to browse</p>
                    <p className="upload-hint">JPG, PNG, WebP • Max 5MB</p>
                  </>
                )}
                <input
                  id="pkg-cover-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>
              {imageError && <p className="upload-error">{imageError}</p>}
              {uploadingImage && <p className="upload-progress">Uploading image...</p>}
            </div>
          </div>

          <div style={{ display:'flex', gap:'var(--space-sm)', justifyContent:'flex-end', marginTop: 'var(--space-md)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving || uploadingImage}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploadingImage}>
              {saving ? '...' : (uploadingImage ? 'Uploading...' : (pkg ? 'Update' : 'Create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Tourist CRUD Modal ---- */
function TouristModal({ tourist, onClose, onSave }) {
  const [form, setForm]     = useState({
    name:    tourist?.name    || '',
    phone:   tourist?.phone   || '',
    email:   tourist?.email   || '',
    address: tourist?.address || '',
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = tourist
        ? await touristsApi.update(tourist.tourist_id, form)
        : await touristsApi.create(form);
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="adm-modal-header">
          <h2 className="text-headline-sm">{tourist ? 'Edit Tourist' : 'Add Tourist'}</h2>
          <button className="adm-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        {error && <div className="adminlogin-error" style={{marginBottom:'var(--space-md)'}}><span className="material-symbols-outlined">error</span>{error}</div>}
        <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          {[
            { name: 'name',    label: 'Full Name',    type: 'text', required: true },
            { name: 'phone',   label: 'Phone',        type: 'tel',  required: true },
            { name: 'email',   label: 'Email',        type: 'email' },
            { name: 'address', label: 'Address',      type: 'text' },
          ].map((f) => (
            <div className="input-group" key={f.name}>
              <label htmlFor={`tou-${f.name}`}>{f.label}</label>
              <input id={`tou-${f.name}`} name={f.name} type={f.type} className="input-field"
                value={form[f.name]} onChange={handle} required={f.required} />
            </div>
          ))}
          <div style={{ display:'flex', gap:'var(--space-sm)', justifyContent:'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '...' : (tourist ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}