import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, authApi, adminBookingsApi, touristsApi, packagesApi } from '../api/api';
import { formatPrice } from '../components/PackageCard';
import AdminPayments from './admin/AdminPayments';
import AdminUsers from './admin/AdminUsers';
import AdminFoodMerchants from './admin/AdminFoodMerchants';
import AdminActivity from './admin/AdminActivity';
import './AdminDashboard.css';

// ---- Admin sidebar nav items ----
const NAV = [
  { id: 'dashboard', icon: 'dashboard',         label: 'Overview' },
  { id: 'bookings',  icon: 'confirmation_number', label: 'Bookings' },
  { id: 'packages',  icon: 'luggage',           label: 'Packages' },
  { id: 'tourists',  icon: 'person_pin',        label: 'Tourists' },
  { id: 'users',     icon: 'groups',            label: 'Users' },
  { id: 'premium',   icon: 'workspace_premium', label: 'Premium Management' },
  { id: 'payments',  icon: 'payments',          label: 'Payments' },
  { id: 'food',      icon: 'restaurant',        label: 'Food Partners' },
  { id: 'activity',  icon: 'history',           label: 'Activity Log' },
];

const STATUS_BADGE = {
  Pending:   'badge-pending',
  Confirmed: 'badge-confirmed',
  Cancelled: 'badge-cancelled',
  Rejected:  'badge-rejected',
};

const PAY_BADGE = {
  pending: 'adm-pay-badge', paid: 'adm-pay-badge adm-pay-badge--paid',
  failed:  'adm-pay-badge adm-pay-badge--failed', refunded: 'adm-pay-badge',
  demo_completed: 'adm-pay-badge',
};

const packageIsActive = (pkg) => {
  if (pkg?.is_active === undefined || pkg?.is_active === null) return true;
  return pkg.is_active === true || pkg.is_active === 1 || pkg.is_active === '1';
};

const BOOKER_BADGE = {
  premium: { cls: 'adm-booker adm-booker--premium', label: 'Premium' },
  admin:   { cls: 'adm-booker adm-booker--admin',   label: 'Admin' },
  user:    { cls: 'adm-booker adm-booker--regular', label: 'Regular' },
};

export default function AdminDashboard() {
  const navigate              = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [admin, setAdmin]     = useState(null);
  const [stats, setStats]     = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [bookingPages, setBookingPages] = useState({ page: 1, pages: 1, total: 0 });
  const [packages, setPackages] = useState([]);
  const [packageSearch, setPackageSearch] = useState('');
  const [tourists, setTourists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [notification, setNotification]   = useState('');
  const [searchTerm, setSearchTerm]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [modal, setModal]     = useState({ type: '', data: null });
  const [detailBooking, setDetailBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectTarget, setRejectTarget]   = useState(null); // {id, name}
  const [confirm, setConfirm]             = useState(null);
  const searchTimer = useRef(null);

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const loadDashboardStats = async () => {
    setStatsLoading(true);
    setDashboardError('');
    try {
      setStats(await dashboardApi.getStats());
    } catch (err) {
      setDashboardError(err.message || 'Could not load dashboard statistics. Check the PHP backend and database connection.');
    } finally {
      setStatsLoading(false);
    }
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
    if (activeTab === 'dashboard') loadDashboardStats();
    if (activeTab === 'bookings')  loadBookings(1);
    if (activeTab === 'packages')  loadPackages();
    if (activeTab === 'tourists')  touristsApi.list().then(setTourists).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, admin]);

  function loadBookings(page = 1) {
    const params = { page, limit: 20 };
    if (searchTerm)     params.search = searchTerm;
    if (statusFilter)   params.status = statusFilter;
    if (userRoleFilter) params.user_role = userRoleFilter;
    adminBookingsApi.list(params).then((data) => {
      setBookings(Array.isArray(data) ? data : (data?.data || []));
      setBookingPages(data?.pagination || { page: 1, pages: 1, total: 0 });
    }).catch((err) => showNotif(`Error: ${err.message}`));
  }

  function loadPackages() {
    packagesApi.list({ include_inactive: 1 }).then((data) => {
      setPackages(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }

  useEffect(() => {
    if (activeTab === 'bookings' && admin) {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => loadBookings(1), 350);
      return () => clearTimeout(searchTimer.current);
    }
  }, [searchTerm, statusFilter, userRoleFilter, admin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await authApi.logout();
    navigate('/admin/login');
  };

  const handleConfirmBooking = (id, name) => {
    setConfirm({
      title: `Approve booking #${id}?`,
      body: `${name} will be confirmed and one slot will be reserved. Payment verification is a separate step.`,
      onRun: async () => {
        setActionLoading(`confirm-${id}`);
        try {
          await adminBookingsApi.confirm(id);
          showNotif(`Booking #${id} approved. Payment verification is a separate step.`);
          loadBookings(bookingPages.page);
          if (activeTab === 'dashboard') loadDashboardStats();
        } catch (err) {
          showNotif(`Error: ${err.message}`);
        } finally {
          setActionLoading('');
        }
      },
    });
  };

  const openRejectDialog = (id, name) => setRejectTarget({ id, name });

  const handleRejectBooking = async (id, reason) => {
    setActionLoading(`reject-${id}`);
    try {
      await adminBookingsApi.reject(id, reason);
      showNotif(`Booking #${id} rejected.`);
      loadBookings(bookingPages.page);
      if (activeTab === 'dashboard') loadDashboardStats();
    } catch (err) {
      showNotif(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleCancelBooking = (id, name) => {
    setConfirm({
      title: `Cancel booking #${id}?`,
      body: `${name}'s booking will be cancelled. If it was approved, availability will be restored.`,
      onRun: async () => {
        setActionLoading(`cancel-${id}`);
        try {
          await adminBookingsApi.cancel(id);
          showNotif(`Booking #${id} cancelled. Availability restored.`);
          loadBookings(bookingPages.page);
        } catch (err) {
          showNotif(`Error: ${err.message}`);
        } finally {
          setActionLoading('');
        }
      },
    });
  };

  const openBookingDetail = async (id) => {
    setDetailLoading(true);
    try {
      const booking = await adminBookingsApi.get(id);
      setDetailBooking(booking);
    } catch (err) {
      showNotif(`Error: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  // ---- Package handlers ----
  const handleDeactivatePackage = (pkg) => {
    setConfirm({
      title: `Deactivate "${pkg.package_name}"?`,
      body: 'The package will be hidden from the public listing and cannot be newly booked. Existing bookings and history are preserved.',
      onRun: async () => {
        setActionLoading(`deact-${pkg.package_id}`);
        try {
          const res = await packagesApi.deactivate(pkg.package_id);
          if (res.already_in_state) {
            showNotif(res.message);
          } else {
            setPackages((prev) => prev.map((p) => (p.package_id === pkg.package_id && res.package ? res.package : p)));
            showNotif(res.message || 'Package deactivated.');
          }
        } catch (err) {
          showNotif(`Error: ${err.message}`);
        } finally {
          setActionLoading('');
        }
      },
    });
  };

  const handleActivatePackage = async (pkg) => {
    setActionLoading(`act-${pkg.package_id}`);
    try {
      const res = await packagesApi.activate(pkg.package_id);
      if (!res.already_in_state && res.package) {
        setPackages((prev) => prev.map((p) => (p.package_id === pkg.package_id ? res.package : p)));
      }
      showNotif(res.message || 'Package activated.');
    } catch (err) {
      showNotif(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleDeletePackage = (id, name) => {
    setConfirm({
      title: `Delete "${name}"?`,
      body: 'This permanently removes the package. If it has bookings or payment history, the server will refuse and you should deactivate it instead.',
      danger: true,
      onRun: async () => {
        setActionLoading(`del-${id}`);
        try {
          await packagesApi.delete(id);
          setPackages((p) => p.filter((pkg) => pkg.package_id !== id));
          showNotif('Package deleted.');
        } catch (err) {
          showNotif(`Error: ${err.message}`);
        } finally {
          setActionLoading('');
        }
      },
    });
  };

  const handleDeleteTourist = (id, name) => {
    setConfirm({
      title: `Delete tourist "${name}"?`,
      body: 'This cannot be undone. Tourists with booking history cannot be deleted.',
      danger: true,
      onRun: async () => {
        setActionLoading(`delt-${id}`);
        try {
          await touristsApi.delete(id);
          setTourists((t) => t.filter((t2) => t2.tourist_id !== id));
          showNotif('Tourist deleted.');
        } catch (err) {
          showNotif(`Error: ${err.message}`);
        } finally {
          setActionLoading('');
        }
      },
    });
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="conf-loading__spinner" />
    </div>
  );

  const filteredPackages = packageSearch
    ? packages.filter((p) =>
        p.package_name.toLowerCase().includes(packageSearch.toLowerCase()) ||
        p.destination.toLowerCase().includes(packageSearch.toLowerCase()))
    : packages;

  return (
    <div className="adm-layout">
      {/* ---- Notification Toast ---- */}
      {notification && (
        <div className="adm-toast animate-fade-up" role="status">{notification}</div>
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

        <nav className="adm-sidebar__nav" aria-label="Admin sections">
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
        <nav className="adm-mobile-nav" aria-label="Admin sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`adm-nav-item ${activeTab === item.id ? 'adm-nav-item--active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <Link to="/" className="adm-nav-item adm-mobile-nav__link"><span className="material-symbols-outlined">home</span>Public Site</Link>
          <button className="adm-nav-item adm-mobile-nav__logout" onClick={handleLogout}><span className="material-symbols-outlined">logout</span>Logout</button>
        </nav>

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'dashboard' && !stats && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="text-headline-md">Overview</h1>
                <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Live statistics from TravelEase operations</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadDashboardStats} disabled={statsLoading}>
                <span className="material-symbols-outlined">refresh</span> {statsLoading ? 'Loading…' : 'Retry'}
              </button>
            </div>
            {dashboardError && <div className="adminlogin-error" role="alert"><span className="material-symbols-outlined">error</span>{dashboardError}</div>}
            {!dashboardError && <div className="adm-empty"><div className="conf-loading__spinner" /><p>Loading dashboard…</p></div>}
          </div>
        )}

        {activeTab === 'dashboard' && stats && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="text-headline-md">Overview</h1>
                <p className="text-body-sm" style={{color:'var(--color-on-surface-variant)'}}>Live statistics from TravelEase operations</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadDashboardStats} disabled={statsLoading}>
                <span className="material-symbols-outlined">refresh</span> {statsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            {dashboardError && <div className="adminlogin-error" role="alert"><span className="material-symbols-outlined">error</span>{dashboardError}</div>}

            {/* Main Stats Grid */}
            <div className="adm-stats-grid">
              {[
                { label: 'Registered Users',     value: stats.total_users ?? '—',       icon: 'person',      color: 'var(--color-primary)' },
                { label: 'Tourists',             value: stats.total_tourists ?? 0,      icon: 'groups',      color: 'var(--color-primary)' },
                { label: 'Active Packages',      value: `${stats.active_packages ?? 0} / ${stats.total_packages ?? 0}`, icon: 'luggage', color: 'var(--color-secondary)' },
                { label: 'Revenue (Collected)',  value: formatPrice(stats.total_revenue || 0), icon: 'payments', color: 'var(--color-primary)' },
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

            {/* Action queues + role split */}
            <div className="adm-cards-row">
              {[
                { label: 'Pending',     value: stats.pending_bookings,      cls: 'badge-pending',   icon: 'hourglass_empty',   tab: 'bookings' },
                { label: 'Approved',    value: stats.confirmed_bookings,    cls: 'badge-confirmed', icon: 'check_circle',      tab: 'bookings', status: 'Confirmed' },
                { label: 'Rejected',    value: stats.rejected_bookings,     cls: 'badge-rejected',  icon: 'block',             tab: 'bookings' },
                { label: 'Cancelled',   value: stats.cancelled_bookings,    cls: 'badge-cancelled', icon: 'cancel',            tab: 'bookings' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="adm-status-card glass-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setActiveTab(s.tab); setStatusFilter(s.status || s.label); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveTab(s.tab)}
                >
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <div className="text-headline-lg adm-status-card__val">{s.value ?? 0}</div>
                  <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>bookings</div>
                </div>
              ))}
            </div>

            <div className="adm-cards-row">
              {[
                { label: 'Regular Users',   value: stats.regular_users ?? 0,   icon: 'person' },
                { label: 'Premium Users',   value: stats.premium_users ?? 0,   icon: 'workspace_premium', tab: 'premium' },
                { label: 'Admins',          value: stats.admin_users ?? 0,     icon: 'shield' },
                { label: 'Payment Reviews Awaiting', value: stats.pending_verifications ?? 0, icon: 'fact_check', tab: 'payments' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="adm-status-card glass-card"
                  style={{ cursor: s.tab ? 'pointer' : 'default' }}
                  onClick={() => s.tab && setActiveTab(s.tab)}
                  role={s.tab ? 'button' : undefined}
                  tabIndex={s.tab ? 0 : undefined}
                >
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-tertiary)' }}>{s.icon}</span>
                  <div className="text-headline-lg adm-status-card__val">{s.value}</div>
                  <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>{s.label}</div>
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
                    Review Pending Bookings
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Recent bookings */}
            <div className="adm-section glass-card">
              <div className="adm-section__header">
                <h2 className="text-headline-sm">Recent Booking Activity</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('bookings')}>
                  View All <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
              <div className="adm-table-wrap">
                {(stats.recent_bookings || []).length === 0 ? (
                  <div className="adm-empty"><span className="material-symbols-outlined">inbox</span><p>No bookings yet.</p></div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th><th>Customer</th><th>Package</th><th>Amount</th><th>Booking</th><th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_bookings.map((b) => (
                        <tr key={b.booking_id} onClick={() => openBookingDetail(b.booking_id)} style={{cursor:'pointer'}}>
                          <td>#{b.booking_id}</td>
                          <td>{b.customer_name}</td>
                          <td>{b.package_name}</td>
                          <td>{formatPrice(b.total_cost)}</td>
                          <td><span className={`badge ${STATUS_BADGE[b.booking_status] || 'badge-rejected'}`}>{b.booking_status}</span></td>
                          <td>{b.payment_status ? <span className={PAY_BADGE[b.payment_status] || 'adm-pay-badge'}>{b.payment_status}</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Revenue by destination */}
            {(stats.revenue_by_destination || []).length > 0 && (
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
              <h1 className="text-headline-md">Booking Requests</h1>
              <div className="adm-filters">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search ID, customer, package, destination..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ minWidth: 220 }}
                  aria-label="Search bookings"
                />
                <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by booking status">
                  <option value="">All Statuses</option>
                  <option>Pending</option>
                  <option>Confirmed</option>
                  <option>Cancelled</option>
                  <option>Rejected</option>
                </select>
                <select className="input-field" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} aria-label="Filter by booker type">
                  <option value="">All Bookers</option>
                  <option value="regular">Regular Users</option>
                  <option value="premium">Premium Users</option>
                </select>
              </div>
            </div>

            <div className="adm-section glass-card">
              <div className="adm-table-wrap">
                {bookings.length === 0 ? (
                  <div className="adm-empty">
                    <span className="material-symbols-outlined">inbox</span>
                    <p>No bookings match these filters.</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th><th>Customer</th><th>Package</th><th>Travel</th>
                        <th>Persons</th><th>Amount</th><th>Booking</th><th>Payment</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.booking_id} onClick={() => openBookingDetail(b.booking_id)} style={{cursor:'pointer'}}>
                          <td>#{b.booking_id}</td>
                          <td>
                            <div className="text-label-lg">{b.customer_name}</div>
                            <div className="text-body-sm" style={{color:'var(--color-on-surface-variant)'}}>{b.customer_phone}</div>
                            {b.user_role && (
                              <span className={BOOKER_BADGE[b.user_role]?.cls || 'adm-booker'}>
                                {BOOKER_BADGE[b.user_role]?.label || b.user_role}
                              </span>
                            )}
                          </td>
                          <td>
                            <div>{b.package_name}</div>
                            <div className="text-body-sm" style={{color:'var(--color-on-surface-variant)'}}>{b.destination}</div>
                          </td>
                          <td>{b.travel_date || b.booking_date}</td>
                          <td>{b.number_of_persons}</td>
                          <td>{formatPrice(b.total_cost)}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[b.booking_status] || 'badge-rejected'}`}>{b.booking_status}</span>
                            {b.rejection_reason && (
                              <div className="text-label-caps adm-decision-note" title={b.rejection_reason}>
                                reason: {b.rejection_reason.length > 22 ? b.rejection_reason.slice(0, 22) + '…' : b.rejection_reason}
                              </div>
                            )}
                            {b.decision_by_name && b.decision_at && (
                              <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>
                                by {b.decision_by_name}
                              </div>
                            )}
                          </td>
                          <td>
                            {b.payment_status
                              ? <span className={PAY_BADGE[b.payment_status] || 'adm-pay-badge'}>{b.payment_status}</span>
                              : <span style={{color:'var(--color-on-surface-variant)'}}>—</span>}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="adm-table-actions">
                              {b.booking_status === 'Pending' && (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={!!actionLoading}
                                    onClick={() => handleConfirmBooking(b.booking_id, b.customer_name)}
                                    title="Approve booking"
                                  >
                                    {actionLoading === `confirm-${b.booking_id}`
                                      ? '...' : <span className="material-symbols-outlined">check_circle</span>}
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    disabled={!!actionLoading}
                                    onClick={() => openRejectDialog(b.booking_id, b.customer_name)}
                                    title="Reject booking (reason requested)"
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
                                  onClick={() => handleCancelBooking(b.booking_id, b.customer_name)}
                                  title="Cancel booking"
                                >
                                  {actionLoading === `cancel-${b.booking_id}`
                                    ? '...' : <span className="material-symbols-outlined">cancel</span>}
                                </button>
                              )}
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openBookingDetail(b.booking_id)}
                                title="View details"
                              >
                                <span className="material-symbols-outlined">visibility</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {bookingPages.pages > 1 && (
                <div className="adm-pagination">
                  <button className="btn btn-ghost btn-sm" disabled={bookingPages.page <= 1} onClick={() => loadBookings(bookingPages.page - 1)}>Previous</button>
                  <span className="text-body-sm">Page {bookingPages.page} of {bookingPages.pages} · {bookingPages.total} total</span>
                  <button className="btn btn-ghost btn-sm" disabled={bookingPages.page >= bookingPages.pages} onClick={() => loadBookings(bookingPages.page + 1)}>Next</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== PACKAGES TAB ===== */}
        {activeTab === 'packages' && (
          <div className="adm-content">
            <div className="adm-page-header">
              <h1 className="text-headline-md">Manage Packages</h1>
              <div className="adm-filters">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search name or destination..."
                  value={packageSearch}
                  onChange={(e) => setPackageSearch(e.target.value)}
                  style={{ minWidth: 200 }}
                  aria-label="Search packages"
                />
                <button className="btn btn-primary" onClick={() => setModal({ type: 'package', data: null })}>
                  <span className="material-symbols-outlined">add</span> Add Package
                </button>
              </div>
            </div>

            <div className="adm-section glass-card">
              <div className="adm-table-wrap">
                {filteredPackages.length === 0 ? (
                  <div className="adm-empty">
                    <span className="material-symbols-outlined">luggage</span>
                    <p>No packages {packageSearch ? 'match your search' : 'found'}.</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th><th>Package</th><th>Destination</th><th>Duration</th>
                        <th>Cost</th><th>Availability</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPackages.map((p) => (
                        <tr key={p.package_id}>
                          <td>#{p.package_id}</td>
                          <td className="text-label-lg">{p.package_name}</td>
                          <td>{p.destination}</td>
                          <td>{p.duration} days</td>
                          <td>{formatPrice(p.cost)}</td>
                          <td><span className={p.availability <= 5 ? 'adm-avail-low' : ''}>{p.availability}</span></td>
                          <td>
                            {packageIsActive(p)
                              ? <span className="badge badge-confirmed">Active</span>
                              : <span className="badge badge-cancelled">Deactivated</span>}
                          </td>
                          <td>
                            <div className="adm-table-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'package', data: p })} title="Edit details">
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              {!packageIsActive(p) && (
                                <button
                                  className="btn btn-success btn-sm"
                                  disabled={!!actionLoading}
                                  onClick={() => handleActivatePackage(p)}
                                  title="Re-activate (available to book again)"
                                >
                                  <span className="material-symbols-outlined">visibility</span>
                                </button>
                              )}
                              {packageIsActive(p) && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={!!actionLoading}
                                  onClick={() => handleDeactivatePackage(p)}
                                  title="Deactivate (archive; keeps bookings & history)"
                                >
                                  <span className="material-symbols-outlined">archive</span>
                                </button>
                              )}
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={!!actionLoading}
                                onClick={() => handleDeletePackage(p.package_id, p.package_name)}
                                title="Delete permanently (blocked if bookings exist)"
                              >
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
                <button className="btn btn-primary" onClick={() => setModal({ type: 'tourist', data: null })}>
                  <span className="material-symbols-outlined">add</span> Add Tourist
                </button>
                <input type="text" className="input-field" placeholder="Search tourists..."
                  onChange={(e) => touristsApi.list({ search: e.target.value }).then(setTourists).catch(() => {})}
                  style={{ minWidth: 220 }}
                  aria-label="Search tourists"
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
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={!!actionLoading}
                                onClick={() => handleDeleteTourist(t.tourist_id, t.name)}
                              >
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

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && <AdminUsers presetRole="" showNotif={showNotif} />}

        {/* ===== PREMIUM MANAGEMENT TAB ===== */}
        {activeTab === 'premium' && <AdminUsers presetRole="premium" showNotif={showNotif} />}

        {/* ===== PAYMENTS TAB ===== */}
        {activeTab === 'payments' && <AdminPayments />}

        {/* ===== FOOD PARTNERS TAB ===== */}
        {activeTab === 'food' && <AdminFoodMerchants showNotif={showNotif} />}

        {/* ===== ADMIN ACTIVITY LOG ===== */}
        {activeTab === 'activity' && <AdminActivity showNotif={showNotif} />}
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
              showNotif('Package created. Use "Deactivate" later to archive it without touching history.');
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

      {/* ---- Booking detail modal ---- */}
      {(detailBooking || detailLoading) && (
        <BookingDetailModal
          booking={detailBooking}
          loading={detailLoading}
          onClose={() => setDetailBooking(null)}
          onApprove={(b) => { setDetailBooking(null); handleConfirmBooking(b.booking_id, b.customer_name); }}
          onReject={(b) => { setDetailBooking(null); openRejectDialog(b.booking_id, b.customer_name); }}
          actionLoading={actionLoading}
        />
      )}

      {/* ---- Reject reason dialog ---- */}
      {rejectTarget && (
        <RejectReasonDialog
          bookingId={rejectTarget.id}
          customerName={rejectTarget.name}
          busy={!!actionLoading}
          onClose={() => setRejectTarget(null)}
          onSubmit={(reason) => handleRejectBooking(rejectTarget.id, reason)}
        />
      )}

      {/* ---- Confirm dialog ---- */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          danger={confirm.danger}
          onClose={() => setConfirm(null)}
          onConfirm={async () => { await confirm.onRun(); setConfirm(null); }}
        />
      )}
    </div>
  );
}

/* ---- Booking detail modal ---- */
function BookingDetailModal({ booking, loading, onClose, onApprove, onReject, actionLoading }) {
  if (loading || !booking) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-box" style={{ maxWidth: '520px', padding: 'var(--space-xl)', textAlign: 'center' }}>
          <div className="conf-loading__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} role="dialog" aria-modal="true" aria-label={`Booking ${booking.booking_id} details`}>
        <div className="adm-modal-header">
          <h2 className="text-headline-sm">Booking #{booking.booking_id}</h2>
          <button className="adm-modal-close" onClick={onClose} aria-label="Close"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="adm-detail-grid">
          <div><span className="text-label-caps">Status</span>
            <div><span className={`badge ${STATUS_BADGE[booking.booking_status] || 'badge-rejected'}`}>{booking.booking_status}</span></div>
          </div>
          <div><span className="text-label-caps">Payment</span>
            <div>{booking.payment_status ? <span className={PAY_BADGE[booking.payment_status] || 'adm-pay-badge'}>{booking.payment_status}</span> : '—'}</div>
          </div>
          <div><span className="text-label-caps">Customer</span><div className="text-body-md">{booking.customer_name}</div></div>
          <div><span className="text-label-caps">Booker Account</span>
            <div className="text-body-md">
              {booking.user_role
                ? `Registered · ${booking.user_role}`
                : (booking.customer_email === booking.user_account_email ? 'Registered' : 'Guest')}
            </div>
          </div>
          <div><span className="text-label-caps">Contact</span>
            <div className="text-body-md">{booking.customer_phone}<br />{booking.customer_email}</div>
          </div>
          <div><span className="text-label-caps">Package</span>
            <div className="text-body-md">{booking.package_name} · {booking.destination}</div>
          </div>
          <div><span className="text-label-caps">Travel Date</span><div className="text-body-md">{booking.travel_date || booking.booking_date}</div></div>
          <div><span className="text-label-caps">Booked On</span><div className="text-body-md">{String(booking.created_at || booking.booking_date).slice(0, 10)}</div></div>
          <div><span className="text-label-caps">Persons</span><div className="text-body-md">{booking.number_of_persons}</div></div>
          <div><span className="text-label-caps">Total</span><div className="text-body-md">{formatPrice(booking.total_cost)}</div></div>
          {booking.special_requests && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span className="text-label-caps">Special Requests</span>
              <div className="text-body-md">{booking.special_requests}</div>
            </div>
          )}
        </div>

        {/* Decision metadata (schema via migration 015) */}
        {(booking.rejection_reason || booking.decision_by_name) && (
          <div className="adm-decision-box">
            {booking.decision_by_name && (
              <div className="text-body-sm">
                <strong>Decision:</strong> {booking.decision_by_name} · {String(booking.decision_at || '').slice(0, 19)}
              </div>
            )}
            {booking.rejection_reason && (
              <div className="text-body-sm" style={{ color: 'var(--color-error)' }}>
                <strong>Reason:</strong> {booking.rejection_reason}
              </div>
            )}
          </div>
        )}

        {/* Separate UPI payment workflow info — never merged with booking approval */}
        <div className="adm-detail-grid" style={{ marginTop: 'var(--space-sm)' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="text-label-caps">UPI Payment Attempt</span>
            {booking.payment ? (
              <div className="text-body-sm">
                {booking.payment.payment_status} · ref {booking.payment.upi_order_ref}
                {booking.payment.submitted_utr ? ` · UTR ${booking.payment.submitted_utr}` : ''}
                {booking.payment.created_at ? ` · ${String(booking.payment.created_at).slice(0, 16)}` : ''}
                <div className="text-label-caps" style={{ marginTop: 4 }}>
                  Verify payments from the Payments tab — booking approval is separate
                </div>
              </div>
            ) : (
              <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                No payment attempt recorded.
              </div>
            )}
          </div>
        </div>

        {booking.booking_status === 'Pending' && (
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
            <button className="btn btn-danger" disabled={!!actionLoading} onClick={() => onReject(booking)}>Reject</button>
            <button className="btn btn-secondary" disabled={!!actionLoading} onClick={() => onApprove(booking)}>Approve</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Reject reason dialog ---- */
function RejectReasonDialog({ bookingId, customerName, busy, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [localErr, setLocalErr] = useState('');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '440px' }} role="dialog" aria-modal="true">
        <div className="adm-modal-header">
          <h2 className="text-headline-sm">Reject Booking #{bookingId}</h2>
          <button className="adm-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {localErr && <div className="adminlogin-error" style={{ marginBottom: 'var(--space-sm)' }}><span className="material-symbols-outlined">error</span>{localErr}</div>}
        <div className="input-group">
          <label htmlFor="reject-booking-reason">Reason shown to {customerName} (optional)</label>
          <textarea
            id="reject-booking-reason"
            className="input-field"
            rows="3"
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Package fully booked for that date"
            style={{ fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              if (reason.length > 2000) { setLocalErr('Reason too long.'); return; }
              onSubmit(reason.trim());
            }}
          >
            {busy ? 'Working...' : 'Reject Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Generic confirmation dialog ---- */
function ConfirmDialog({ title, body, danger, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '430px' }} role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="adm-modal-header">
          <h2 className="text-headline-sm">{title}</h2>
          <button className="adm-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-body-md" style={{ margin: 'var(--space-md) 0' }}>{body}</p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Package CRUD Modal ---- */
function PackageModal({ pkg, onClose, onSave }) {
  const [form, setForm]     = useState({
    package_name: pkg?.package_name || '',
    destination:  pkg?.destination  || '',
    description:  pkg?.description  || '',
    duration:     pkg?.duration     || 1,
    cost:         pkg?.cost         || '',
    availability: pkg?.availability || 0,
  });
  const [error, setError]   = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(pkg?.cover_image_url || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* Frontend validation — mirrors the server-side rules in packages/manage.php */
  const validateForm = (f) => {
    const errs = {};
    if (!f.package_name?.trim()) errs.package_name = 'Package name is required.';
    else if (f.package_name.length > 100) errs.package_name = 'Max 100 characters.';
    if (!f.destination?.trim()) errs.destination = 'Destination is required.';
    else if (f.destination.length > 100) errs.destination = 'Max 100 characters.';
    if (!(Number(f.duration) > 0) || Number(f.duration) > 365) errs.duration = 'Duration must be 1–365 days.';
    if (!(Number(f.cost) > 0) || Number(f.cost) > 99999999) errs.cost = 'Cost must be a positive number.';
    if (Number(f.availability) < 0 || Number(f.availability) > 1000000) errs.availability = 'Availability cannot be negative.';
    if (f.description && f.description.length > 10000) errs.description = 'Description too long (max 10,000 characters).';
    return errs;
  };

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

    const errs = validateForm(form);
    setFieldErr(errs);
    if (Object.keys(errs).length > 0) {
      setSaving(false);
      return;
    }

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

  const FIELDS = [
    { name: 'package_name', label: 'Package Name', type: 'text', required: true },
    { name: 'destination',  label: 'Destination',  type: 'text', required: true },
    { name: 'duration',     label: 'Duration (days)', type: 'number', min: 1 },
    { name: 'cost',         label: 'Cost per person (₹)', type: 'number', min: 0 },
    { name: 'availability', label: 'Available Slots', type: 'number', min: 0 },
  ];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }}>
        <div className="adm-modal-header">
          <h2 className="text-headline-sm">{pkg ? 'Edit Package' : 'Add Package'}</h2>
          <button className="adm-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        {error && <div className="adminlogin-error" style={{marginBottom:'var(--space-md)'}}><span className="material-symbols-outlined">error</span>{error}</div>}
        <form onSubmit={handleSave} noValidate style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          {FIELDS.map((f) => (
            <div className="input-group" key={f.name}>
              <label htmlFor={`pkg-${f.name}`}>{f.label}{f.required ? ' *' : ''}</label>
              <input id={`pkg-${f.name}`} name={f.name} type={f.type} className="input-field"
                value={form[f.name]} onChange={handle} required={f.required} min={f.min}
                aria-invalid={!!fieldErr[f.name]}
                aria-describedby={fieldErr[f.name] ? `pkg-${f.name}-err` : undefined} />
              {fieldErr[f.name] && (
                <div id={`pkg-${f.name}-err`} className="upload-error" role="alert">{fieldErr[f.name]}</div>
              )}
            </div>
          ))}

          <div className="input-group">
            <label htmlFor="pkg-description">Description</label>
            <textarea
              id="pkg-description"
              name="description"
              className="input-field"
              rows="4"
              maxLength={10000}
              value={form.description}
              onChange={handle}
              placeholder="What travellers get on this package — highlights, inclusions, please note..."
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div className="text-label-caps" style={{ color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>
              {form.description.length}/10000
            </div>
          </div>

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
              {imageError && <p className="upload-error" role="alert">{imageError}</p>}
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
