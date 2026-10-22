import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { demoPaymentsApi, bookingsApi } from '../api/api';
import { formatPrice } from '../components/PackageCard';
import { useAuth } from '../context/AuthContext';
import './Checkout.css';

// ============================================================
// TravelEase — Demo QR Payment Checkout
// NO REAL PAYMENT GATEWAY. For UI demonstration only.
// No UPI PIN, no OTP, no card details, no real money.
// ============================================================

export default function Checkout() {
  const { id } = useParams(); // booking_id or confirmation_token
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [demoComplete, setDemoComplete] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const confettiRef = useRef(null);

  // ---- Load booking on mount ----
  useEffect(() => {
    const loadBooking = async () => {
      try {
        // First try demo endpoint (works with token or id)
        let data;
        try {
          data = await demoPaymentsApi.getCheckout(id);
        } catch {
          // Fallback: try standard booking confirmation endpoint
          data = await bookingsApi.getConfirmation(id);
        }
        setBooking(data);
      } catch (err) {
        setError(err.message || 'Failed to load booking details.');
      } finally {
        setLoading(false);
      }
    };
    loadBooking();
  }, [id]);

  // ---- Generate local QR code when booking loads ----
  useEffect(() => {
    if (!booking) return;

    // Demo QR payload — harmless, clearly labelled, no real UPI destination
    const demoPayload = [
      'TRAVELEASE_DEMO',
      `REF:${booking.confirmation_token || ('BK' + booking.booking_id)}`,
      `AMT:INR${Number(booking.total_cost).toFixed(2)}`,
      `PKG:${(booking.package_name || '').replace(/[^\w\s]/g, '').trim().toUpperCase()}`,
      'THIS_IS_NOT_A_REAL_PAYMENT',
    ].join('|');

    QRCode.toDataURL(demoPayload, {
      width: 280,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, [booking]);

  // ---- Simulate demo payment ----
  const handleSimulate = async () => {
    if (!booking || simulating) return;
    setSimulating(true);
    setError('');

    try {
      await demoPaymentsApi.simulate(booking.booking_id);
      setDemoComplete(true);
      // Trigger confetti animation
      if (confettiRef.current) {
        confettiRef.current.classList.add('checkout-confetti--active');
      }
    } catch (err) {
      // If demo endpoint fails, still show success locally (it's just a demo)
      console.warn('Demo simulate endpoint unavailable, showing local demo completion:', err.message);
      setDemoComplete(true);
    } finally {
      setSimulating(false);
    }
  };

  const handleCopyRef = () => {
    const ref = booking?.confirmation_token || String(booking?.booking_id);
    navigator.clipboard.writeText(ref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="checkout-page">
        <div className="checkout-loading">
          <div className="checkout-loading__spinner" />
          <div className="text-body-lg">Loading checkout…</div>
        </div>
      </div>
    );
  }

  // ---- Error state (no booking found) ----
  if (error && !booking) {
    return (
      <div className="checkout-page">
        <div className="container checkout-error">
          <span className="material-symbols-outlined">error</span>
          <h2>{error}</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            The booking may not exist or you may not have access to it.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
            <Link to="/book" className="btn btn-primary">Book Again</Link>
            <Link to="/" className="btn btn-secondary">Go Home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const bookingRef = booking.confirmation_token || `BK${booking.booking_id}`;
  const shortRef = bookingRef.length > 16 ? bookingRef.substring(0, 8) + '…' + bookingRef.slice(-6) : bookingRef;
  const amount = Number(booking.total_cost || 0);

  // ---- Demo Complete State ----
  if (demoComplete) {
    return (
      <div className="checkout-page">
        <div ref={confettiRef} className="checkout-confetti" />
        <div className="container" style={{ padding: '4rem var(--space-md)' }}>
          <div className="checkout-success-card glass-card">
            <div className="checkout-success__icon">
              <span className="material-symbols-outlined">task_alt</span>
            </div>
            <div className="checkout-demo-badge">
              <span className="material-symbols-outlined">science</span>
              DEMO MODE
            </div>
            <h1 className="text-headline-md checkout-success__title">
              Demo Payment Completed
            </h1>
            <p className="text-body-md checkout-success__subtitle">
              No Real Transaction — This was a demonstration only.
            </p>

            <div className="checkout-success__notice">
              <span className="material-symbols-outlined">info</span>
              <span>
                <strong>No money was transferred.</strong> This demo simulated the payment flow
                without any real financial transaction, UPI PIN, OTP, or card details.
                Your booking is still <strong>Pending</strong> and requires admin confirmation.
              </span>
            </div>

            <div className="checkout-success__details">
              <div className="checkout-success__row">
                <span className="material-symbols-outlined">luggage</span>
                <span>{booking.package_name}</span>
              </div>
              <div className="checkout-success__row">
                <span className="material-symbols-outlined">location_on</span>
                <span>{booking.destination}</span>
              </div>
              <div className="checkout-success__row">
                <span className="material-symbols-outlined">receipt_long</span>
                <span title={bookingRef}>Ref: {shortRef}</span>
              </div>
              <div className="checkout-success__row">
                <span className="material-symbols-outlined">currency_rupee</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                  {formatPrice(amount)} — Demo Only
                </span>
              </div>
            </div>

            <div className="checkout-success__actions">
              <Link
                to={`/booking-confirmation/${bookingRef}`}
                className="btn btn-primary btn-lg btn-pill"
              >
                <span className="material-symbols-outlined">visibility</span>
                View Booking
              </Link>
              <Link to="/packages" className="btn btn-secondary btn-pill">
                <span className="material-symbols-outlined">explore</span>
                Explore More
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main Checkout Page ----
  return (
    <div className="checkout-page">
      {/* Header */}
      <div className="checkout-hero">
        <div className="container">
          <Link to="/packages" className="checkout-back">
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Packages
          </Link>
          <div className="checkout-demo-pill">
            <span className="material-symbols-outlined">science</span>
            Demo Checkout
          </div>
          <h1 className="text-headline-lg">{booking.package_name}</h1>
          <p className="text-body-md">{booking.destination} • {booking.duration || booking.package_cost ? `${booking.duration} days` : ''}</p>
        </div>
      </div>

      <div className="container checkout-main">
        {/* Demo Mode Notice */}
        <div className="checkout-demo-notice">
          <span className="material-symbols-outlined">science</span>
          <div>
            <div className="checkout-demo-notice__title">Demo Mode</div>
            <div className="checkout-demo-notice__desc">
              This QR code does <strong>not</strong> process real payments. No UPI PIN, OTP, card details,
              or real money is involved. Use <em>Simulate Payment for Demo</em> to complete the UI flow.
            </div>
          </div>
        </div>

        <div className="checkout-layout">
          {/* Left: QR + Demo Payment */}
          <div className="checkout-content">

            {/* Order Summary */}
            <div className="checkout-summary glass-card">
              <div className="checkout-summary__header">
                <div className="text-title-md">Order Summary</div>
                <div className="text-label-caps" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Booking #{booking.booking_id}
                </div>
              </div>

              <div className="checkout-summary__items">
                <div className="checkout-summary__row">
                  <span>{booking.package_name}</span>
                  <span>× {booking.number_of_persons} person{booking.number_of_persons > 1 ? 's' : ''}</span>
                </div>
                <div className="checkout-summary__row">
                  <span>Per person</span>
                  <span className="checkout-summary__price">{formatPrice(booking.package_cost)}</span>
                </div>
                {booking.travel_date && (
                  <div className="checkout-summary__row">
                    <span>Travel Date</span>
                    <span>{new Date(booking.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
                <div className="checkout-summary__divider" />
                <div className="checkout-summary__row checkout-summary__row--total">
                  <span className="text-label-caps">Total (Demo)</span>
                  <span className="text-headline-sm" style={{ color: 'var(--color-primary)' }}>
                    {formatPrice(amount)}
                  </span>
                </div>
              </div>

              <div className="checkout-summary__details">
                <div className="checkout-summary__detail">
                  <span className="material-symbols-outlined">person</span>
                  <span>{booking.customer_name}</span>
                </div>
                {booking.customer_email && (
                  <div className="checkout-summary__detail">
                    <span className="material-symbols-outlined">email</span>
                    <span>{booking.customer_email}</span>
                  </div>
                )}
                <div className="checkout-summary__detail">
                  <span className="material-symbols-outlined">call</span>
                  <span>{booking.customer_phone}</span>
                </div>
              </div>

              {/* Booking Reference */}
              <div className="checkout-ref-row">
                <div className="checkout-ref-box">
                  <span className="text-label-caps checkout-ref-box__label">Booking Reference</span>
                  <code className="checkout-ref-box__code" title={bookingRef}>{shortRef}</code>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-pill checkout-ref-copy"
                  onClick={handleCopyRef}
                  title="Copy full reference"
                >
                  <span className="material-symbols-outlined">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Demo QR Code */}
            <div className="checkout-qr glass-card">
              <div className="checkout-qr__header">
                <div className="text-title-md">Demo Payment QR</div>
                <div className="checkout-demo-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>science</span>
                  Demo Only
                </div>
              </div>

              <div className="checkout-qr__code">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Demo QR Code — Not for real payments"
                    className="checkout-qr__img"
                  />
                ) : (
                  <div className="checkout-qr__placeholder">
                    <span className="material-symbols-outlined">qr_code_2</span>
                    <span>Generating QR…</span>
                  </div>
                )}
                <div className="checkout-qr__watermark">DEMO — NOT FOR REAL PAYMENT</div>
              </div>

              <div className="checkout-qr__info">
                <div className="checkout-qr__ref">
                  <span className="text-label-caps">Demo Payload Contains</span>
                  <code>TRAVELEASE_DEMO | Booking Ref | ₹{amount.toFixed(2)}</code>
                </div>
                <p className="checkout-qr__disclaimer">
                  <span className="material-symbols-outlined">warning</span>
                  This QR cannot be scanned for real payment. It contains only demo data.
                </p>
              </div>
            </div>

            {/* Demo Payment Button */}
            <div className="checkout-simulate glass-card">
              <div className="checkout-simulate__header">
                <span className="material-symbols-outlined checkout-simulate__icon">science</span>
                <div>
                  <div className="text-title-md">Demo Payment</div>
                  <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Click to simulate the complete payment UI flow — no real transaction.
                  </div>
                </div>
              </div>

              <div className="checkout-simulate__amount">
                <span className="text-label-caps">Amount Displayed</span>
                <span className="text-headline-md" style={{ color: 'var(--color-primary)' }}>
                  {formatPrice(amount)}
                </span>
                <span className="checkout-simulate__demo-note">Demo Only — ₹0 actual charge</span>
              </div>

              {error && (
                <div className="checkout-error-inline">
                  <span className="material-symbols-outlined">error</span>
                  {error}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-lg checkout-simulate__btn"
                onClick={handleSimulate}
                disabled={simulating}
                id="simulate-payment-btn"
              >
                {simulating ? (
                  <>
                    <span className="book-spinner" />
                    Processing Demo…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">play_circle</span>
                    Simulate Payment for Demo
                  </>
                )}
              </button>

              <p className="checkout-simulate__legal">
                <span className="material-symbols-outlined">gavel</span>
                Clicking this button does <strong>not</strong> initiate any real payment.
                No UPI PIN, OTP, bank account, or card details are required or used.
                This is for demonstration purposes only.
              </p>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="checkout-sidebar">
            {/* Help */}
            <div className="checkout-help glass-card">
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-secondary)' }}>support_agent</span>
              <div>
                <div className="text-title-md">Need Help?</div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Our team is here to assist you.
                </div>
              </div>
              <a href="tel:9000000000" className="btn btn-secondary btn-pill" style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
                <span className="material-symbols-outlined">call</span>
                Call 9000000000
              </a>
            </div>

            {/* Demo Info */}
            <div className="checkout-demo-info glass-card" style={{ marginTop: 'var(--space-lg)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--color-tertiary)' }}>science</span>
              <div className="text-label-caps" style={{ marginTop: 'var(--space-xs)', color: 'var(--color-tertiary)' }}>Demo Mode Active</div>
              <ul className="checkout-security__list">
                <li>No real payment gateway</li>
                <li>No UPI PIN or OTP required</li>
                <li>No card or bank details</li>
                <li>QR contains only demo data</li>
                <li>Booking stays Pending until admin confirms</li>
              </ul>
            </div>

            {/* Booking Status Link */}
            <div className="glass-card" style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-sm)' }}>
                Want to check booking status?
              </div>
              <Link
                to={`/booking-confirmation/${bookingRef}`}
                className="btn btn-secondary btn-pill"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined">visibility</span>
                View Booking
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}