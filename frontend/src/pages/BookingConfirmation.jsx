import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { bookingsApi } from '../api/api';
import { formatPrice } from '../components/PackageCard';
import './BookingConfirmation.css';

export default function BookingConfirmation() {
  const { id }            = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    bookingsApi.getConfirmation(id)
      .then(setBooking)
      .catch(() => setError('Booking not found. Please check your Booking ID.'))
      .finally(() => setLoading(false));
  }, [id]);

  const statusConfig = {
    Pending:   { color: 'var(--color-tertiary)',  bg: 'var(--color-tertiary-fixed)',     icon: 'schedule', msg: 'Your booking is awaiting confirmation from our team.' },
    Confirmed: { color: 'var(--color-secondary)', bg: 'var(--color-secondary-container)',icon: 'check_circle', msg: 'Your booking is confirmed! Pack your bags.' },
    Cancelled: { color: 'var(--color-error)',      bg: 'var(--color-error-container)',    icon: 'cancel',   msg: 'This booking has been cancelled.' },
    Rejected:  { color: 'var(--color-on-surface-variant)', bg: 'var(--color-surface-container-high)', icon: 'block', msg: 'This booking was rejected. Contact us for details.' },
  };

  const paymentLabels = {
    pending:        { label: 'Payment Pending', color: 'var(--color-tertiary)', icon: 'schedule' },
    paid:           { label: 'Paid',            color: 'var(--color-secondary)', icon: 'check_circle' },
    failed:         { label: 'Payment Failed',  color: 'var(--color-error)', icon: 'error' },
    refunded:       { label: 'Refunded',        color: 'var(--color-on-surface-variant)', icon: 'undo' },
    demo_completed: { label: 'Demo Completed',  color: 'var(--color-on-surface-variant)', icon: 'science' },
  };

  if (loading) return (
    <div className="conf-loading">
      <div className="conf-loading__spinner" />
      <p>Loading your booking...</p>
    </div>
  );

  if (error || !booking) return (
    <div className="conf-error container">
      <span className="material-symbols-outlined">error</span>
      <h2>{error || 'Booking not found.'}</h2>
      <Link to="/" className="btn btn-primary">Go Home</Link>
    </div>
  );

  const sc = statusConfig[booking.booking_status] || statusConfig.Pending;
  const pc = paymentLabels[booking.payment_status] || {
    label: booking.payment_status || 'Unknown',
    color: 'var(--color-on-surface-variant)',
    icon: 'help',
  };

  return (
    <div className="conf-page">
      {/* Success Banner */}
      <div className="conf-banner">
        <div className="container conf-banner__content animate-scale-in">
          <div className="conf-banner__icon" style={{ background: sc.bg, color: sc.color }}>
            <span className="material-symbols-outlined">{sc.icon}</span>
          </div>
          <div>
            <div className="text-label-caps conf-banner__booking-id">Booking #{booking.booking_id}</div>
            <h1 className="text-headline-lg conf-banner__title">
              {booking.booking_status === 'Pending'   ? 'Booking Submitted!' :
               booking.booking_status === 'Confirmed' ? 'Booking Confirmed!' : `Booking ${booking.booking_status}`}
            </h1>
            <p className="text-body-md">{sc.msg}</p>
          </div>
        </div>
      </div>

      <div className="container conf-main">
        <div className="conf-layout">
          {/* Left: Booking Details */}
          <div className="conf-details glass-card">
            <h2 className="text-headline-md conf-details__title">Booking Details</h2>

            <div className="conf-detail-grid">
              {/* Customer */}
              <div className="conf-detail-group">
                <div className="conf-detail-group__header text-label-caps">
                  <span className="material-symbols-outlined">person</span> Customer
                </div>
                <div className="conf-detail-row"><span>Name</span><span>{booking.customer_name}</span></div>
                {booking.customer_email && <div className="conf-detail-row"><span>Email</span><span>{booking.customer_email}</span></div>}
                {booking.customer_phone && <div className="conf-detail-row"><span>Phone</span><span>{booking.customer_phone}</span></div>}
              </div>

              {/* Package */}
              <div className="conf-detail-group">
                <div className="conf-detail-group__header text-label-caps">
                  <span className="material-symbols-outlined">luggage</span> Package
                </div>
                <div className="conf-detail-row"><span>Package</span><span>{booking.package_name}</span></div>
                <div className="conf-detail-row"><span>Destination</span><span>{booking.destination}</span></div>
                <div className="conf-detail-row"><span>Duration</span><span>{booking.duration} days</span></div>
              </div>

              {/* Trip */}
              <div className="conf-detail-group">
                <div className="conf-detail-group__header text-label-caps">
                  <span className="material-symbols-outlined">calendar_month</span> Trip
                </div>
                <div className="conf-detail-row"><span>Booking Date</span><span>{booking.booking_date}</span></div>
                {booking.travel_date && <div className="conf-detail-row"><span>Travel Date</span><span>{booking.travel_date}</span></div>}
                <div className="conf-detail-row"><span>Persons</span><span>{booking.number_of_persons}</span></div>
              </div>

              {/* Payment */}
              <div className="conf-detail-group">
                <div className="conf-detail-group__header text-label-caps">
                  <span className="material-symbols-outlined">payments</span> Payment
                </div>
                <div className="conf-detail-row"><span>Per person</span><span>{formatPrice(booking.package_cost)}</span></div>
                <div className="conf-detail-row"><span>× {booking.number_of_persons}</span><span>{formatPrice(booking.total_cost)}</span></div>
                <div className="conf-detail-row conf-detail-row--total">
                  <span className="text-label-caps">Total</span>
                  <span className="text-headline-sm" style={{ color: 'var(--color-primary)' }}>{formatPrice(booking.total_cost)}</span>
                </div>
                <div className="conf-detail-row">
                  <span>Payment Status</span>
                  <span style={{ color: pc.color, fontWeight: 600 }}>{pc.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Next Steps */}
          <div className="conf-next">
            {/* Status badge */}
            <div className="conf-status-card" style={{ background: sc.bg }}>
              <div className="conf-status-card__icon" style={{ color: sc.color }}>
                <span className="material-symbols-outlined">{sc.icon}</span>
              </div>
              <div>
                <div className="text-label-caps" style={{ color: sc.color, fontWeight: 700 }}>Booking Status</div>
                <div className="text-headline-sm" style={{ color: sc.color }}>{booking.booking_status}</div>
              </div>
            </div>

            {/* Payment state is shown separately — an unpaid booking is never "paid" */}
            <div className="conf-status-card" style={{ background: 'var(--color-surface-container-high)' }}>
              <div className="conf-status-card__icon" style={{ color: pc.color }}>
                <span className="material-symbols-outlined">{pc.icon}</span>
              </div>
              <div>
                <div className="text-label-caps" style={{ color: pc.color, fontWeight: 700 }}>Payment Status</div>
                <div className="text-headline-sm" style={{ color: pc.color }}>{pc.label}</div>
              </div>
            </div>

            {booking.booking_status === 'Pending' && (
              <div className="conf-next-steps glass-card">
                <h3 className="text-title-md">What happens next?</h3>
                <div className="conf-steps">
                  {[
                    { icon: 'mark_email_read', text: 'Our team reviews your booking request' },
                    { icon: 'phone_in_talk',   text: 'We may contact you at the provided phone number' },
                    { icon: 'check_circle',    text: 'Booking status updated to Confirmed within 24h' },
                    { icon: 'flight_takeoff',  text: 'Pack your bags and enjoy your trip!' },
                  ].map((step) => (
                    <div key={step.text} className="conf-step">
                      <span className="material-symbols-outlined">{step.icon}</span>
                      <span>{step.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {booking.payment_status === 'pending' && (
              <div className="conf-pay-now glass-card">
                <h3 className="text-title-md">Complete Your Payment</h3>
                <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-md)' }}>
                  Your booking is saved with <strong>Payment Pending</strong> status. You can pay later from your booking
                  history, or complete the UPI payment now to secure it.
                </p>
                <Link to={`/checkout/${booking.confirmation_token || booking.booking_id}`} className="btn btn-primary btn-lg">
                  <span className="material-symbols-outlined">payment</span>
                  Pay Now
                </Link>
              </div>
            )}

            <div className="conf-save-id glass-card">
              <span className="material-symbols-outlined">receipt_long</span>
              <div>
                <div className="text-title-md">Save Your Reference</div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {booking.confirmation_token ? (
                    <>Use your confirmation token + email to check status anytime.<br />
                    Token: <strong style={{wordBreak:'break-all', fontSize:'0.8em'}}>{booking.confirmation_token.slice(0, 24)}…</strong></>
                  ) : (
                    <>Use <strong>#{booking.booking_id}</strong> + your email to check status anytime.</>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="conf-actions">
              <Link to="/booking-status" className="btn btn-primary">
                <span className="material-symbols-outlined">receipt_long</span>
                Check Status
              </Link>
              <Link to="/packages" className="btn btn-ghost">
                <span className="material-symbols-outlined">explore</span>
                More Tours
              </Link>
            </div>

            <a href="tel:9000000000" className="conf-call">
              <span className="material-symbols-outlined">call</span>
              Call 9000000000 for help
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
