import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { packagesApi } from '../api/api';
import { formatPrice } from '../components/PackageCard';
import { getDestinationImage, DESTINATION_IMAGE_MAP } from '../utils/destinationImages';
import DestinationViewer3D from '../components/3d/DestinationViewer3D';
import RouteMapPlanner from '../components/map/RouteMapPlanner';
import './PackageDetails.css';

export default function PackageDetails() {
  const { id }            = useParams();
  const [pkg, setPkg]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeMediaTab, setActiveMediaTab] = useState('gallery');

  useEffect(() => {
    packagesApi.get(id)
      .then((data) => {
        setPkg(data);
        if (data) {
        }
      })
      .catch((err) => setError(err.message || 'Package not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ paddingTop: 'var(--nav-height)', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="text-body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Loading package...</div>
    </div>
  );

  if (error || !pkg) return (
    <div style={{ paddingTop: 'var(--nav-height)', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--color-error)', opacity: 0.5 }}>error</span>
      <p className="text-body-lg">{error || 'Package not found.'}</p>
      <Link to="/packages" className="btn btn-primary">← All Packages</Link>
    </div>
  );

  // Use cover image from API (image_type='primary'), fall back to first image,
  // then to the locally bundled destination artwork
  const img = pkg.images?.find(img => img.image_type === 'primary')?.image_url
           || pkg.images?.[0]?.image_url
           || getDestinationImage(
             typeof pkg.destination === 'object' ? pkg.destination?.name : pkg.destination,
             pkg.package_type || ''
           );

  // Support both old `cost`/`availability` and new `price`/`max_group_size` column names
  const displayPrice = pkg.price ?? pkg.cost ?? 0;
  const displayAvail = pkg.availability ?? pkg.max_group_size ?? 0;
  const isAvailable = displayAvail > 0;

  // Use inclusions from API or fallback to generic list
  const displayInclusions = pkg.inclusions && pkg.inclusions.length > 0
    ? pkg.inclusions
    : [
        { item: `${pkg.duration} Day guided tour` },
        { item: 'All major attractions covered' },
        { item: 'Professional local guide' },
        { item: 'Comfortable transportation' },
        { item: 'Hotel accommodation included' },
        { item: '24/7 TravelEase support' },
      ];

  return (
    <div className="pkgdet-page">
      {/* Hero */}
      <div className="pkgdet-hero">
        <img src={img} alt={pkg.destination?.name || pkg.destination} className="pkgdet-hero__img" />
        <div className="pkgdet-hero__overlay" />
        <div className="container pkgdet-hero__content">
          <Link to="/packages" className="pkgdet-back">
            <span className="material-symbols-outlined">arrow_back</span>
            All Packages
          </Link>
          <div className="pkgdet-hero__dest text-label-caps">
            <span className="material-symbols-outlined">location_on</span>
            {pkg.destination?.name || pkg.destination}
          </div>
          <h1 className="pkgdet-hero__name text-headline-lg">{pkg.package_name}</h1>
        </div>
      </div>

      <div className="container pkgdet-main">
        <div className="pkgdet-layout">
          {/* Left content */}
          <div className="pkgdet-content">
            {/* Stats row */}
            <div className="pkgdet-stats glass-card">
              {[
                { icon: 'schedule', label: 'Duration', value: `${pkg.duration} Days` },
                { icon: 'payments', label: 'Price/person', value: formatPrice(displayPrice) },
                { icon: 'groups', label: 'Availability', value: `${displayAvail} slots` },
              ].map((s) => (
                <div key={s.label} className="pkgdet-stat">
                  <div className="pkgdet-stat__icon">
                    <span className="material-symbols-outlined">{s.icon}</span>
                  </div>
                  <div className="text-label-caps pkgdet-stat__label">{s.label}</div>
                  <div className="pkgdet-stat__value text-headline-sm">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Package Description (if available) */}
            {pkg.description && (
              <div className="pkgdet-section">
                <h2 className="text-headline-md pkgdet-section__title">About This Package</h2>
                <p className="text-body-md" style={{lineHeight: 1.7}}>{pkg.description}</p>
              </div>
            )}

            {/* Experience Destination Stage (Gallery, 3D Depth View, Route Map) */}
            <div className="pkgdet-section glass-card" style={{ padding: 'var(--space-lg)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <h2 className="text-headline-md" style={{ margin: 0 }}>Experience Destination</h2>
                  <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
                    Interactive 3D depth view, verified galleries, and route cartography
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeMediaTab === 'gallery' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveMediaTab('gallery')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>photo_library</span>
                    Gallery
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeMediaTab === '3d' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveMediaTab('3d')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>view_in_ar</span>
                    3D Depth View
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeMediaTab === 'map' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveMediaTab('map')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>map</span>
                    Route Map
                  </button>
                </div>
              </div>

              {activeMediaTab === 'gallery' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  {(pkg.images && pkg.images.length > 0 ? pkg.images : [{ image_url: img, caption: pkg.package_name }]).map((im, idx) => (
                    <div key={im.image_id || idx} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '160px', position: 'relative' }}>
                      <img src={im.image_url || im.image_path} alt={im.caption || pkg.package_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      {im.caption && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {im.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeMediaTab === '3d' && (
                <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-outline-variant)' }}>
                  <DestinationViewer3D
                    imageUrl={pkg.images?.[0]?.image_url || pkg.images?.[0]?.image_path || ''}
                    pointsOfInterest={[
                      { x: 0.5, y: 0.5, label: pkg.destination?.name || pkg.destination, packageId: pkg.package_id }
                    ]}
                  />
                </div>
              )}

              {activeMediaTab === 'map' && (
                <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-outline-variant)', height: '420px' }}>
                  <RouteMapPlanner
                    destination={{
                      name: pkg.destination?.name || pkg.destination,
                      lat: parseFloat(pkg.destination?.latitude || 20.5937),
                      lng: parseFloat(pkg.destination?.longitude || 78.9629)
                    }}
                  />
                </div>
              )}
            </div>

            {/* Highlights / Inclusions */}
            <div className="pkgdet-section">
              <h2 className="text-headline-md pkgdet-section__title">Package Highlights</h2>
              <div className="pkgdet-highlights">
                {displayInclusions.map((inc, idx) => (
                  <div key={inc.inclusion_id || idx} className="pkgdet-highlight">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>{inc.item || inc.inclusion_text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Itinerary - Use API data or show message */}
            <div className="pkgdet-section">
              <h2 className="text-headline-md pkgdet-section__title">Day-by-Day Itinerary</h2>
              {pkg.itinerary && pkg.itinerary.length > 0 ? (
                <div className="pkgdet-itinerary">
                  {pkg.itinerary.map((day, i) => (
                    <div key={day.itinerary_day_id} className={`pkgdet-day animate-fade-up stagger-${Math.min(i+1,5)}`}>
                      <div className="pkgdet-day__marker">
                        <div className="pkgdet-day__dot" />
                        {i < pkg.itinerary.length - 1 && <div className="pkgdet-day__line" />}
                      </div>
                      <div className="pkgdet-day__content">
                        <div className="pkgdet-day__num text-label-caps">Day {day.day_number}</div>
                        <div className="pkgdet-day__title text-title-md">{day.title || day.day_title}</div>
                        <div className="pkgdet-day__desc text-body-sm">{day.description || day.day_description}</div>
                        {day.meals_included && (
                          <div className="pkgdet-day__meta text-label-sm" style={{marginTop: '0.5rem', color: 'var(--color-on-surface-variant)'}}>
                            <span className="material-symbols-outlined" style={{fontSize: '1rem', verticalAlign: 'middle'}}>restaurant</span>
                            {' '}Meals: {day.meals_included}
                          </div>
                        )}
                        {day.activities && (
                          <div className="pkgdet-day__meta text-label-sm" style={{marginTop: '0.25rem', color: 'var(--color-on-surface-variant)'}}>
                            <span className="material-symbols-outlined" style={{fontSize: '1rem', verticalAlign: 'middle'}}>hiking</span>
                            {' '}{day.activities}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm" style={{color: 'var(--color-on-surface-variant)', fontStyle: 'italic'}}>
                  Detailed itinerary will be shared upon booking confirmation. Contact us at 9000000000 for more information.
                </p>
              )}
            </div>

            {/* Exclusions (if available) */}
            {pkg.exclusions && pkg.exclusions.length > 0 && (
              <div className="pkgdet-section">
                <h2 className="text-headline-md pkgdet-section__title">Not Included</h2>
                <div className="pkgdet-exclusions" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {pkg.exclusions.map((exc) => (
                    <div key={exc.exclusion_id} style={{display: 'flex', alignItems: 'flex-start', gap: '0.5rem'}}>
                      <span className="material-symbols-outlined" style={{color: 'var(--color-error)', fontSize: '1.25rem'}}>cancel</span>
                      <span className="text-body-sm">{exc.item || exc.exclusion_text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Booking card */}
          <div className="pkgdet-sidebar">
            <div className="pkgdet-book-card glass-card">
              <div className="text-label-caps pkgdet-book-card__tag">Book This Package</div>
              <div className="pkgdet-book-card__price">
                <div className="text-label-caps" style={{ color: 'var(--color-on-surface-variant)' }}>Starting from</div>
                <div className="text-headline-lg" style={{ color: 'var(--color-primary)' }}>{formatPrice(displayPrice)}</div>
                <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>per person</div>
              </div>

              <div className="pkgdet-book-card__details">
                <div className="pkgdet-book-card__detail">
                  <span className="material-symbols-outlined">schedule</span>
                  <span>{pkg.duration} Days / {pkg.duration - 1} Nights</span>
                </div>
                <div className="pkgdet-book-card__detail">
                  <span className="material-symbols-outlined">location_on</span>
                  <span>{pkg.destination?.name || pkg.destination}</span>
                </div>
                <div className="pkgdet-book-card__detail">
                  <span className="material-symbols-outlined">groups</span>
                  <span>{displayAvail} slots available</span>
                </div>
              </div>

              {isAvailable ? (
                <Link to={`/book/${pkg.package_id}`} className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined">flight_takeoff</span>
                  Book Now
                </Link>
              ) : (
                <div className="pkgdet-book-card__full">
                  <span className="material-symbols-outlined">block</span>
                  This package is currently fully booked.
                </div>
              )}

              <a href="tel:9000000000" className="pkgdet-book-card__call">
                <span className="material-symbols-outlined">call</span>
                Call 9000000000 to inquire
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
