import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { packagesApi } from '../api/api';
import PackageCard from '../components/PackageCard';
import RecommendationEngine from '../components/recommendations/RecommendationEngine';
import './Home.css';

const DESTINATIONS = [
  { name: 'Kerala',      tag: 'Backwaters',    img: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=500&q=80', category: 'Nature' },
  { name: 'Goa',         tag: 'Beach',         img: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=500&q=80', category: 'Beach' },
  { name: 'Rajasthan',   tag: 'Heritage',      img: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=500&q=80', category: 'Heritage' },
  { name: 'Kashmir',     tag: 'Hill Station',  img: 'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=500&q=80', category: 'Hill Station' },
  { name: 'Andaman',     tag: 'Islands',       img: 'https://images.unsplash.com/photo-1586861256632-9ba3c4c0e0b7?w=500&q=80', category: 'Beach' },
  { name: 'Darjeeling',  tag: 'Tea Hills',     img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=500&q=80', category: 'Nature' },
];

const CATEGORIES = [
  { label: 'Beach',       icon: 'surfing',        color: 'var(--color-primary)' },
  { label: 'Hill Station',icon: 'terrain',         color: 'var(--color-secondary)' },
  { label: 'Heritage',    icon: 'temple_hindu',    color: 'var(--color-tertiary)' },
  { label: 'Adventure',   icon: 'hiking',          color: 'var(--color-error)' },
  { label: 'Nature',      icon: 'forest',          color: 'var(--color-secondary)' },
  { label: 'Sightseeing', icon: 'visibility',      color: 'var(--color-primary)' },
  { label: 'Photography', icon: 'photo_camera',    color: 'var(--color-on-surface)' },
  { label: 'Cruise',      icon: 'directions_boat', color: 'var(--color-primary-container)' },
];

const STATS = [
  { value: '50+', label: 'Destinations', icon: 'explore',       color: 'var(--color-primary)' },
  { value: '1K+', label: 'Happy Travelers', icon: 'groups',     color: 'var(--color-secondary)' },
  { value: '25+', label: 'Tour Packages', icon: 'luggage',      color: 'var(--color-tertiary)' },
  { value: '24/7',label: 'Customer Support', icon: 'support_agent', color: 'var(--color-primary)' },
];

export default function Home() {
  const [packages, setPackages] = useState([]);
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [searchDest, setSearchDest] = useState('');
  const [parallaxY, setParallaxY] = useState(0);
  const heroRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Check if user has premium access
  const isPremium = user && (user.role === 'premium' || user.role === 'admin');

  // Parallax effect on hero
  useEffect(() => {
    const onScroll = () => {
      if (heroRef.current) {
        const scrolled = window.scrollY;
        setParallaxY(scrolled * 0.35);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    packagesApi.list({ available: true })
      .then((data) => setPackages(data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoadingPkgs(false));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchDest.trim()) {
      navigate(`/packages?search=${encodeURIComponent(searchDest.trim())}`);
    } else {
      navigate('/packages');
    }
  };

  return (
    <div className="home-page">
      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="home-hero" ref={heroRef}>
        {/* Background image with parallax */}
        <div
          className="home-hero__bg"
          style={{ transform: `translateY(${parallaxY}px)` }}
        />
        {/* Gradient overlays */}
        <div className="home-hero__gradient-1" />
        <div className="home-hero__gradient-2" />

        <div className="container home-hero__content">
          {/* Live status badge */}
          <div className="home-hero__badge animate-fade-up">
            <span className="home-hero__badge-dot animate-pulse-dot" />
            <span className="text-label-caps">Handcrafted Tours • Verified Stays</span>
          </div>

          {/* Hero heading */}
          <div className="home-hero__title-row animate-fade-up stagger-1">
            <span className="material-symbols-outlined home-hero__icon">flight_takeoff</span>
            <h1 className="text-display-hero home-hero__title">TravelEase</h1>
          </div>

          <p className="text-label-caps home-hero__sub animate-fade-up stagger-2">
            EXPLORE • DISCOVER • EXPERIENCE
          </p>

          {/* Pill ribbon */}
          <div className="home-hero__ribbon animate-fade-up stagger-2">
            Your Next Adventure Awaits
          </div>

          {/* Search Box */}
          <form className="home-hero__search-box glass-card animate-fade-up stagger-3" onSubmit={handleSearch}>
            <div className="home-hero__search-grid">
              <div className="home-hero__search-field">
                <label htmlFor="hero-dest" className="text-label-caps">
                  <span className="material-symbols-outlined">location_on</span> Destination
                </label>
                <input
                  id="hero-dest"
                  type="text"
                  placeholder="Where to? (e.g. Kerala)"
                  value={searchDest}
                  onChange={(e) => setSearchDest(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="home-hero__search-field">
                <label htmlFor="hero-style" className="text-label-caps">
                  <span className="material-symbols-outlined">category</span> Travel Style
                </label>
                <select id="hero-style" defaultValue="all">
                  <option value="all">All Styles</option>
                  <option>Beach Coastal</option>
                  <option>Hill Stations</option>
                  <option>Heritage & Temples</option>
                  <option>Active Adventure</option>
                  <option>Nature & Wildlife</option>
                  <option>Cruise & Backwaters</option>
                </select>
              </div>

              <div className="home-hero__search-field">
                <label htmlFor="hero-date" className="text-label-caps">
                  <span className="material-symbols-outlined">calendar_month</span> Travel Date
                </label>
                <input id="hero-date" type="date" />
              </div>

              <button type="submit" className="btn btn-primary home-hero__search-btn">
                <span className="material-symbols-outlined">travel_explore</span>
                Search
              </button>
            </div>

            {/* Trending tags */}
            <div className="home-hero__trending">
              <span className="text-label-md" style={{color:'var(--color-on-surface-variant)'}}>Trending:</span>
              {['Kerala','Goa','Kashmir','Rajasthan','Andaman'].map((dest) => (
                <button
                  key={dest}
                  type="button"
                  className="home-hero__tag"
                  onClick={() => navigate(`/packages?destination=${dest}`)}
                >
                  {dest}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* ============================================================
          STATS BAND
          ============================================================ */}
      <section className="home-stats">
        <div className="container home-stats__grid">
          {STATS.map((stat, i) => (
            <div key={stat.label} className={`home-stat-card animate-fade-up stagger-${i + 1}`}>
              <div className="home-stat-card__icon" style={{ background: `${stat.color}18`, color: stat.color }}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
              <div>
                <div className="home-stat-card__value text-headline-lg">{stat.value}</div>
                <div className="home-stat-card__label text-body-sm">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================
          QUICK ACCESS FEATURES
          ============================================================ */}
      <section className="section home-quick-access">
        <div className="container">
          <div className="home-section-header">
            <div>
              <div className="text-label-caps home-section-header__tag">Quick Access</div>
              <h2 className="text-headline-lg">Travel Tools & Services</h2>
            </div>
            <p className="text-body-sm home-section-header__desc">
              Plan routes, discover food spots, track bookings, and manage your business.
            </p>
          </div>

          <div className="home-quick-access__grid">
            {/* Route Planner Card */}
            <Link 
              to={isPremium ? "/route-planner" : "/upgrade"} 
              className={`quick-access-card animate-fade-up stagger-1 ${!isPremium ? 'quick-access-card--locked' : ''}`}
            >
              <div className="quick-access-card__icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <span className="material-symbols-outlined">
                  {isPremium ? 'route' : 'lock'}
                </span>
              </div>
              <div className="quick-access-card__content">
                <h3 className="text-title-lg">Route Planner</h3>
                <p className="text-body-sm">Plan your journey with interactive maps and optimized routes</p>
                {!isPremium && <div className="quick-access-card__badge">Premium</div>}
              </div>
              <span className="material-symbols-outlined quick-access-card__arrow">
                {isPremium ? 'arrow_forward' : 'lock'}
              </span>
            </Link>

            {/* Food Discovery Card */}
            <Link 
              to={isPremium ? "/food-spots" : "/upgrade"} 
              className={`quick-access-card animate-fade-up stagger-2 ${!isPremium ? 'quick-access-card--locked' : ''}`}
            >
              <div className="quick-access-card__icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                <span className="material-symbols-outlined">
                  {isPremium ? 'restaurant' : 'lock'}
                </span>
              </div>
              <div className="quick-access-card__content">
                <h3 className="text-title-lg">Food Discovery</h3>
                <p className="text-body-sm">Explore authentic local cuisine and top-rated restaurants</p>
                {!isPremium && <div className="quick-access-card__badge">Premium</div>}
              </div>
              <span className="material-symbols-outlined quick-access-card__arrow">
                {isPremium ? 'arrow_forward' : 'lock'}
              </span>
            </Link>

            {/* Booking Status Card */}
            <Link to="/booking-status" className="quick-access-card animate-fade-up stagger-3">
              <div className="quick-access-card__icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
              <div className="quick-access-card__content">
                <h3 className="text-title-lg">Booking Status</h3>
                <p className="text-body-sm">Track your reservations and view booking history</p>
              </div>
              <span className="material-symbols-outlined quick-access-card__arrow">arrow_forward</span>
            </Link>

            {/* Merchant Portal Card */}
            <Link to="/merchant" className="quick-access-card animate-fade-up stagger-4">
              <div className="quick-access-card__icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
                <span className="material-symbols-outlined">storefront</span>
              </div>
              <div className="quick-access-card__content">
                <h3 className="text-title-lg">Merchant Portal</h3>
                <p className="text-body-sm">List your restaurant or service for travelers</p>
              </div>
              <span className="material-symbols-outlined quick-access-card__arrow">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          CATEGORY EXPLORER
          ============================================================ */}
      <section className="section home-categories">
        <div className="container">
          <div className="home-section-header">
            <div>
              <div className="text-label-caps home-section-header__tag">Category Explorer</div>
              <h2 className="text-headline-lg">Curated Ways to Travel</h2>
            </div>
            <p className="text-body-sm home-section-header__desc">
              Filter thousands of verified stays, expeditions, and spiritual journeys by travel interest.
            </p>
          </div>

          <div className="home-categories__strip no-scrollbar">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                className={`home-cat-btn animate-fade-up stagger-${Math.min(i + 1, 6)}`}
                onClick={() => navigate(`/explore?category=${encodeURIComponent(cat.label)}`)}
              >
                <div className="home-cat-btn__icon" style={{ background: cat.color }}>
                  <span className="material-symbols-outlined">{cat.icon}</span>
                </div>
                <span className="text-label-md home-cat-btn__label">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURED DESTINATIONS
          ============================================================ */}
      <section className="section home-destinations">
        <div className="container">
          <div className="home-section-header">
            <div>
              <div className="text-label-caps home-section-header__tag">Trending Now</div>
              <h2 className="text-headline-lg">Explore India's Wonders</h2>
            </div>
            <Link to="/explore" className="btn btn-ghost btn-pill">
              View All
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>

          <div className="home-destinations__grid">
            {DESTINATIONS.map((dest, i) => (
              <Link
                key={dest.name}
                to={`/destination/${encodeURIComponent(dest.name)}`}
                className={`dest-card animate-fade-up stagger-${Math.min(i + 1, 6)}`}
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                <img src={dest.img} alt={dest.name} loading="lazy" />
                <div className="dest-card__mask">
                  <span className="dest-card__tag text-label-caps">{dest.tag}</span>
                  <div className="dest-card__name text-headline-sm">{dest.name}</div>
                  <div className="dest-card__cta">
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          AI RECOMMENDATIONS MATCHMAKER
          ============================================================ */}
      <section className="section home-recommendations" style={{ paddingBottom: '0' }}>
        <div className="container">
          <RecommendationEngine />
        </div>
      </section>

      {/* ============================================================
          POPULAR PACKAGES
          ============================================================ */}
      <section className="section home-packages">
        <div className="container">
          <div className="home-section-header">
            <div>
              <div className="text-label-caps home-section-header__tag">Featured Packages</div>
              <h2 className="text-headline-lg">Popular Tour Packages</h2>
            </div>
            <Link to="/packages" className="btn btn-ghost btn-pill">
              All Packages
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>

          {loadingPkgs ? (
            <div className="home-packages__skeleton">
              {[1, 2, 3].map((n) => (
                <div key={n} className="pkg-skeleton">
                  <div className="skeleton" style={{ height: 200 }} />
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="skeleton" style={{ height: 14, width: '40%' }} />
                    <div className="skeleton" style={{ height: 20, width: '80%' }} />
                    <div className="skeleton" style={{ height: 14, width: '60%' }} />
                    <div className="skeleton" style={{ height: 40 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : packages.length > 0 ? (
            <div className="home-packages__grid">
              {packages.map((pkg, i) => (
                <PackageCard key={pkg.package_id} pkg={pkg} delay={i * 80} />
              ))}
            </div>
          ) : (
            <div className="home-packages__empty">
              <span className="material-symbols-outlined">luggage</span>
              <p>Packages will appear once the database is connected.</p>
              <Link to="/packages" className="btn btn-primary">Browse Packages</Link>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
          INTERACTIVE 3D EXPLORER SECTION
          ============================================================ */}
      <section className="section home-explorer">
        <div className="container home-explorer__inner">
          <div className="home-explorer__text">
            <div className="text-label-caps home-section-header__tag">Immersive Experience</div>
            <h2 className="text-headline-lg">Interactive Destination Explorer</h2>
            <p className="text-body-lg home-explorer__desc">
              Drag, zoom, and explore India's most breathtaking destinations in an immersive 
              3D panoramic view. Experience your destination before you book.
            </p>
            <Link to="/explore" className="btn btn-primary btn-lg">
              <span className="material-symbols-outlined">360</span>
              Launch Explorer
            </Link>
          </div>

          <PanoramaExplorer />
        </div>
      </section>

      {/* ============================================================
          BOOKING CTA SECTION
          ============================================================ */}
      <section className="home-cta">
        <div className="home-cta__bg" />
        <div className="container home-cta__content">
          <div className="text-label-caps home-cta__tag">Start Your Journey</div>
          <h2 className="text-headline-lg home-cta__title">Ready for Your Next Adventure?</h2>
          <p className="text-body-lg home-cta__desc">
            Book your dream tour today. Our team confirms within 24 hours.
          </p>
          <div className="home-cta__actions">
            <Link to="/book" className="btn btn-primary btn-lg">
              <span className="material-symbols-outlined">flight_takeoff</span>
              Book a Tour
            </Link>
            <Link to="/booking-status" className="btn btn-ghost btn-lg">
              <span className="material-symbols-outlined">receipt_long</span>
              Check Status
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          CONTACT SECTION
          ============================================================ */}
      <section className="section home-contact">
        <div className="container home-contact__inner">
          <div className="home-contact__card glass-card">
            <div className="home-contact__icon">
              <span className="material-symbols-outlined">support_agent</span>
            </div>
            <h3 className="text-headline-md">Need Help Planning?</h3>
            <p className="text-body-md">
              Our travel experts are available Mon–Sat, 9 AM to 8 PM.
              Call us or chat with our AI assistant.
            </p>
            <div className="home-contact__actions">
              <a href="tel:9000000000" className="btn btn-primary btn-lg btn-pill">
                <span className="material-symbols-outlined">call</span>
                Call 9000000000
              </a>
              <Link to="/contact" className="btn btn-ghost btn-pill">
                Contact Page
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---- Panorama / 3D Explorer sub-component ---- */
function PanoramaExplorer() {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const frameRef = useRef(null);

  const destinations = [
    { name: 'Kerala Backwaters', img: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=700&q=80' },
    { name: 'Rajasthan Dunes',   img: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=700&q=80' },
    { name: 'Kashmir Valley',    img: 'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=700&q=80' },
  ];

  const [activeIdx, setActiveIdx] = useState(0);

  const clampRotation = (r) => Math.max(-50, Math.min(50, r));

  const onPointerDown = (e) => {
    setIsDragging(true);
    setStartX(e.clientX || e.touches?.[0]?.clientX || 0);
    frameRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const x = e.clientX || e.touches?.[0]?.clientX || startX;
    const delta = (x - startX) / 4;
    setRotation((r) => clampRotation(r + delta));
    setStartX(x);
  };

  const onPointerUp = () => setIsDragging(false);

  // Parallax shift based on rotation
  const bgShift = rotation * 0.6;

  return (
    <div className="panorama-frame">
      <div
        ref={frameRef}
        className={`panorama-viewport ${isDragging ? 'panorama-viewport--dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        {/* Panoramic background with parallax */}
        <div
          className="panorama-bg"
          style={{
            backgroundImage: `url('${destinations[activeIdx].img}')`,
            transform: `translateX(${bgShift}px) scale(1.1)`,
          }}
        />
        <div className="panorama-overlay" />

        {/* Center Glass Trigger */}
        <div className="panorama-center">
          <div className="panorama-play-btn">
            <span className="material-symbols-outlined">360</span>
          </div>
          <div className="text-label-caps panorama-label">EXPLORE IN 3D VIEW</div>
        </div>

        {/* Destination name */}
        <div className="panorama-dest-name">
          <span className="material-symbols-outlined">location_on</span>
          {destinations[activeIdx].name}
        </div>
      </div>

      {/* Rotation slider -50 → +50 */}
      <div className="panorama-controls">
        <span className="text-label-caps" style={{ color: 'var(--color-on-surface-variant)' }}>–50</span>
        <div className="panorama-slider-track">
          <div className="panorama-slider-fill"
               style={{ width: `${((rotation + 50) / 100) * 100}%` }} />
          <input
            type="range"
            min={-50}
            max={50}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="panorama-slider"
            aria-label="Panorama rotation"
          />
        </div>
        <span className="text-label-caps" style={{ color: 'var(--color-on-surface-variant)' }}>+50</span>
        <button
          className="btn btn-ghost btn-sm btn-pill"
          onClick={() => setRotation(0)}
          title="Reset"
        >
          <span className="material-symbols-outlined">restart_alt</span>
        </button>
      </div>

      {/* Thumbnail selector */}
      <div className="panorama-thumbs">
        {destinations.map((d, i) => (
          <button
            key={d.name}
            className={`panorama-thumb ${i === activeIdx ? 'panorama-thumb--active' : ''}`}
            onClick={() => { setActiveIdx(i); setRotation(0); }}
            title={d.name}
          >
            <img src={d.img} alt={d.name} />
          </button>
        ))}
      </div>
    </div>
  );
}
