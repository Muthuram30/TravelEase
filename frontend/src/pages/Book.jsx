import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { packagesApi, bookingsApi } from '../api/api';
import { formatPrice } from '../components/PackageCard';
import { useTheme } from '../context/ThemeContext';
import './Book.css';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function Book() {
  const { packageId } = useParams();
  const navigate      = useNavigate();
  const { applyBookingDestination } = useTheme();

  const [packages, setPackages]   = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  const [form, setForm] = useState({
    customer_name:    '',
    customer_email:   '',
    customer_phone:   '',
    customer_address: '',
    package_id:       packageId || '',
    booking_date:     today(),
    travel_date:      '',
    number_of_persons: 1,
  });

  // One key per booking attempt: double-clicks / retries reuse the same booking.
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  });

  // Load packages
  useEffect(() => {
    packagesApi.list({ available: true })
      .then((data) => {
        setPackages(data);
        if (packageId) {
          const found = data.find((p) => String(p.package_id) === String(packageId));
          setSelectedPkg(found || null);
        }
      })
      .catch(() => setError('Failed to load packages.'))
      .finally(() => setLoading(false));
  }, [packageId]);

  // When package selection changes
  useEffect(() => {
    if (form.package_id) {
      const found = packages.find((p) => String(p.package_id) === String(form.package_id));
      setSelectedPkg(found || null);
    } else {
      setSelectedPkg(null);
    }
  }, [form.package_id, packages]);

  // Support both old (cost/availability) and new (price/max_group_size) schema
  const pkgPrice = selectedPkg ? (selectedPkg.price ?? selectedPkg.cost ?? 0) : 0;
  const pkgAvail = selectedPkg ? (selectedPkg.availability ?? selectedPkg.max_group_size ?? 0) : 0;
  const totalCost = pkgPrice * form.number_of_persons;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e, payLater = false) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!form.customer_name.trim()) return setError('Name is required.');
    if (!form.customer_phone.trim()) return setError('Phone number is required.');
    if (!form.package_id) return setError('Please select a package.');
    if (!form.booking_date) return setError('Booking date is required.');
    if (form.number_of_persons < 1) return setError('At least 1 person required.');

    if (selectedPkg && form.number_of_persons > pkgAvail) {
      return setError(`Only ${pkgAvail} slots available for this package.`);
    }

    setSubmitting(true);
    try {
      const data = await bookingsApi.create({
        ...form,
        number_of_persons: Number(form.number_of_persons),
        package_id:        Number(form.package_id),
        pay_later:         payLater,
        idempotency_key:   idempotencyKey,
      });
      // A completed booking is the only moment a destination changes the theme.
      applyBookingDestination(selectedPkg || { destination: data.destination });
      // Navigate based on payment choice
      const bookingRef = data.confirmation_token || data.booking_id;
      if (payLater) {
        navigate(`/booking-confirmation/${bookingRef}`);
      } else {
        navigate(`/checkout/${bookingRef}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ paddingTop: 'var(--nav-height)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span className="text-body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Loading...</span>
    </div>
  );

  return (
    <div className="book-page">
      {/* Header */}
      <div className="book-header">
        <div className="container">
          <Link to="/packages" className="book-header__back">
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Packages
          </Link>
          <h1 className="text-headline-lg">Plan & Book Your Tour</h1>
          <p className="text-body-md">Fill in your details and we'll confirm your booking within 24 hours.</p>
        </div>
      </div>

      <div className="container book-layout">
        {/* ---- Booking Form ---- */}
        <form className="book-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="book-error">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          {/* Section 1: Package */}
          <div className="book-section glass-card">
            <div className="book-section__head">
              <div className="book-section__num">1</div>
              <div>
                <div className="text-title-md">Select Tour Package</div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Choose from our available packages</div>
              </div>
            </div>
            <div className="input-group">
              <label htmlFor="book-pkg">
                <span className="material-symbols-outlined">luggage</span>
                Tour Package
              </label>
              <select
                id="book-pkg"
                name="package_id"
                className="input-field"
                value={form.package_id}
                onChange={handleChange}
                required
              >
                <option value="">— Select a package —</option>
                {packages.map((p) => (
                  <option key={p.package_id} value={p.package_id}>
                    {p.package_name} — {typeof p.destination === 'object' ? p.destination?.name : p.destination} ({p.duration} days, {formatPrice(p.price ?? p.cost ?? 0)}/person)
                  </option>
                ))}
              </select>
            </div>

            {selectedPkg && (
              <div className="book-pkg-preview">
                <div className="book-pkg-preview__info">
                  <span className="material-symbols-outlined">location_on</span>
                  <div>
                    <div className="text-title-md">{selectedPkg.package_name}</div>
                    <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {selectedPkg.destination} • {selectedPkg.duration} days • {selectedPkg.availability} slots available
                    </div>
                  </div>
                </div>
                <div className="book-pkg-preview__price text-headline-md">{formatPrice(selectedPkg.cost)}<span className="text-body-sm">/person</span></div>
              </div>
            )}
          </div>

          {/* Section 2: Personal Details */}
          <div className="book-section glass-card">
            <div className="book-section__head">
              <div className="book-section__num">2</div>
              <div>
                <div className="text-title-md">Your Details</div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>We'll use these to confirm your booking</div>
              </div>
            </div>
            <div className="book-form__grid">
              <div className="input-group">
                <label htmlFor="book-name">
                  <span className="material-symbols-outlined">person</span>
                  Full Name *
                </label>
                <input id="book-name" name="customer_name" type="text" className="input-field"
                  placeholder="Your full name" value={form.customer_name} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label htmlFor="book-phone">
                  <span className="material-symbols-outlined">call</span>
                  Phone Number *
                </label>
                <input id="book-phone" name="customer_phone" type="tel" className="input-field"
                  placeholder="+91 XXXXX XXXXX" value={form.customer_phone} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label htmlFor="book-email">
                  <span className="material-symbols-outlined">email</span>
                  Email Address
                </label>
                <input id="book-email" name="customer_email" type="email" className="input-field"
                  placeholder="your@email.com" value={form.customer_email} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label htmlFor="book-addr">
                  <span className="material-symbols-outlined">home</span>
                  Address
                </label>
                <input id="book-addr" name="customer_address" type="text" className="input-field"
                  placeholder="City, State" value={form.customer_address} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Section 3: Trip Details */}
          <div className="book-section glass-card">
            <div className="book-section__head">
              <div className="book-section__num">3</div>
              <div>
                <div className="text-title-md">Trip Details</div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Set your dates and group size</div>
              </div>
            </div>
            <div className="book-form__grid">
              <div className="input-group">
                <label htmlFor="book-bdate">
                  <span className="material-symbols-outlined">calendar_today</span>
                  Booking Date *
                </label>
                <input id="book-bdate" name="booking_date" type="date" className="input-field"
                  value={form.booking_date} min={today()} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label htmlFor="book-tdate">
                  <span className="material-symbols-outlined">flight_takeoff</span>
                  Travel Date
                </label>
                <input id="book-tdate" name="travel_date" type="date" className="input-field"
                  value={form.travel_date} min={form.booking_date || today()} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label htmlFor="book-persons">
                  <span className="material-symbols-outlined">groups</span>
                  Number of Persons *
                </label>
                <input id="book-persons" name="number_of_persons" type="number" className="input-field"
                  min={1} max={selectedPkg?.availability || 50}
                  value={form.number_of_persons} onChange={handleChange} required />
              </div>
            </div>
          </div>

          <div className="book-actions">
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={(e) => handleSubmit(e, true)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="book-spinner" />
                  Processing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">schedule</span>
                  Pay Later
                </>
              )}
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-lg book-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="book-spinner" />
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">flight_takeoff</span>
                  Pay Now
                </>
              )}
            </button>
          </div>

          <p className="book-note text-body-sm">
            <span className="material-symbols-outlined">info</span>
            <strong>Pay Now:</strong> Proceed to UPI QR checkout immediately.<br/>
            <strong>Pay Later:</strong> Booking confirmed with <strong>Payment Pending</strong> status. You can pay anytime from booking history.
          </p>
        </form>

        {/* ---- Price Summary ---- */}
        <div className="book-summary">
          <div className="book-summary-card glass-card">
            <div className="text-label-caps book-summary-card__tag">Price Summary</div>

            {selectedPkg ? (
              <>
                <div className="book-summary-item">
                  <span>Package</span>
                  <span className="book-summary-value">{selectedPkg.package_name}</span>
                </div>
                <div className="book-summary-item">
                  <span>Destination</span>
                  <span className="book-summary-value">{selectedPkg.destination}</span>
                </div>
                <div className="book-summary-item">
                  <span>Duration</span>
                  <span className="book-summary-value">{selectedPkg.duration} days</span>
                </div>
                <div className="book-summary-item">
                  <span>Per person</span>
                  <span className="book-summary-value">{formatPrice(selectedPkg.cost)}</span>
                </div>
                <div className="book-summary-item">
                  <span>Persons</span>
                  <span className="book-summary-value">× {form.number_of_persons}</span>
                </div>
                <div className="book-summary-divider" />
                <div className="book-summary-total">
                  <span className="text-label-caps">Total (estimate)</span>
                  <span className="text-headline-md" style={{ color: 'var(--color-primary)' }}>
                    {formatPrice(totalCost)}
                  </span>
                </div>
                <p className="book-summary-note text-label-caps">
                  Final price confirmed by server
                </p>
              </>
            ) : (
              <div className="book-summary-empty">
                <span className="material-symbols-outlined">luggage</span>
                Select a package to see pricing
              </div>
            )}
          </div>

          {/* Contact card */}
          <div className="book-help-card glass-card">
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-secondary)' }}>support_agent</span>
            <div>
              <div className="text-title-md">Need help choosing?</div>
              <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Our travel experts are ready to help.
              </div>
            </div>
            <a href="tel:9000000000" className="btn btn-secondary btn-pill">
              <span className="material-symbols-outlined">call</span>
              9000000000
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
