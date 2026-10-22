import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../api/api';
import { formatPrice } from '../components/PackageCard';
import './BookingStatus.css';

const STATUS_CONFIG = {
  Pending:   { color: 'var(--color-tertiary)',   icon: 'schedule',      label: 'Pending',   desc: 'Awaiting admin confirmation' },
  Confirmed: { color: 'var(--color-secondary)',  icon: 'check_circle',  label: 'Confirmed', desc: 'Your booking is confirmed!' },
  Cancelled: { color: 'var(--color-error)',       icon: 'cancel',        label: 'Cancelled', desc: 'This booking was cancelled.' },
  Rejected:  { color: 'var(--color-on-surface-variant)', icon: 'block', label: 'Rejected',  desc: 'Booking was rejected.' },
};

const PAYMENT_LABELS = {
  pending:        'Payment Pending',
  paid:           'Paid',
  failed:         'Payment Failed',
  refunded:       'Refunded',
  demo_completed: 'Demo Completed',
};

export default function BookingStatus() {
  const [bookingId, setBookingId] = useState('');
  const [email, setEmail]         = useState('');
  const [booking, setBooking]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [searched, setSearched]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBooking(null);
    setSearched(false);

    if (!bookingId.trim() || !email.trim()) {
      return setError('Booking ID and email are both required.');
    }

    setLoading(true);
    try {
      const data = await bookingsApi.checkStatus(bookingId.trim(), email.trim());
      setBooking(data);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'No booking found with this ID and email.');
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const sc = booking ? (STATUS_CONFIG[booking.booking_status] || STATUS_CONFIG.Pending) : null;

  return (
    <div className="bstatus-page">
      {/* Hero */}
      <div className="bstatus-hero">
        <div className="container">
          <div className="text-label-caps bstatus-hero__tag">My Booking</div>
          <h1 className="text-headline-lg">Check Booking Status</h1>
          <p className="text-body-md">Enter your Booking ID and email to see real-time status.</p>
        </div>
      </div>

      <div className="container bstatus-main">
        {/* Search Card */}
        <div className="bstatus-search glass-card">
          <form className="bstatus-form" onSubmit={handleSubmit}>
            <div className="bstatus-form__title text-headline-sm">Find Your Booking</div>

            {error && (
              <div className="bstatus-error">
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}

            <div className="bstatus-form__fields">
              <div className="input-group">
                <label htmlFor="bstatus-id">
                  <span className="material-symbols-outlined">receipt_long</span>
                  Booking ID
                </label>
                <input
                  id="bstatus-id"
                  type="text"
                  className="input-field"
                  placeholder="e.g. 123"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="bstatus-email">
                  <span className="material-symbols-outlined">email</span>
                  Email Address
                </label>
                <input
                  id="bstatus-email"
                  type="email"
                  className="input-field"
                  placeholder="Email used during booking"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <><span className="book-spinner" /> Searching...</>
              ) : (
                <><span className="material-symbols-outlined">search</span> Check Status</>
              )}
            </button>
          </form>

          {/* No email? Help */}
          <div className="bstatus-noemail text-body-sm">
            <span className="material-symbols-outlined">info</span>
            <span>Booked without an email? Call <a href="tel:9000000000">9000000000</a> for help.</span>
          </div>
        </div>

        {/* Result */}
        {searched && booking && sc && (
          <div className="bstatus-result glass-card animate-scale-in">
            {/* Status Banner */}
            <div className="bstatus-status-row">
              <div className="bstatus-status-icon" style={{ color: sc.color }}>
                <span className="material-symbols-outlined">{sc.icon}</span>
              </div>
              <div>
                <div className="bstatus-status-label text-headline-md" style={{ color: sc.color }}>
                  {sc.label}
                </div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{sc.desc}</div>
              </div>
              <div className="bstatus-booking-id text-label-caps">
                Booking #{booking.booking_id}
              </div>
            </div>

            {/* Details Grid */}
            <div className="bstatus-details">
              {[
                { label: 'Customer',    icon: 'person',          value: booking.customer_name },
                { label: 'Package',     icon: 'luggage',         value: booking.package_name },
                { label: 'Destination', icon: 'location_on',     value: booking.destination },
                { label: 'Duration',    icon: 'schedule',        value: `${booking.duration} days` },
                { label: 'Booking Date',icon: 'calendar_today',  value: booking.booking_date },
                { label: 'Travel Date', icon: 'flight_takeoff',  value: booking.travel_date || '—' },
                { label: 'Persons',     icon: 'groups',          value: booking.number_of_persons },
                { label: 'Total Cost',  icon: 'payments',        value: formatPrice(booking.total_cost), highlight: true },
                {
                  label: 'Payment',
                  icon: 'account_balance_wallet',
                  value: PAYMENT_LABELS[booking.payment_status] || booking.payment_status || 'Unknown',
                  highlight: booking.payment_status === 'paid',
                },
              ].map((item) => (
                <div key={item.label} className="bstatus-detail-row">
                  <div className="bstatus-detail-label">
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span className="text-label-caps">{item.label}</span>
                  </div>
                  <div className={`bstatus-detail-value text-body-md ${item.highlight ? 'bstatus-detail-value--highlight' : ''}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="bstatus-footer">
              {booking.payment_status === 'pending' && (
                <Link to={`/checkout/${booking.confirmation_token || booking.booking_id}`} className="btn btn-primary btn-pill">
                  <span className="material-symbols-outlined">payment</span>
                  Pay Now
                </Link>
              )}
              <a href="tel:9000000000" className="btn btn-ghost btn-pill">
                <span className="material-symbols-outlined">call</span>
                9000000000
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
