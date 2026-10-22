import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="te-footer">
      <div className="te-footer__top container">
        {/* Brand Column */}
        <div className="te-footer__col te-footer__col--brand">
          <Link to="/" className="te-footer__brand">
            <div className="te-footer__logo">
              <span className="material-symbols-outlined">flight_takeoff</span>
            </div>
            <div>
              <div className="te-footer__brand-name">TravelEase</div>
              <div className="text-label-caps te-footer__brand-tagline">
                Explore • Discover • Experience
              </div>
            </div>
          </Link>
          <p className="te-footer__desc">
            India's premier tourism management platform. Curated destinations, verified packages, 
            and seamless booking — all in one place.
          </p>
          <a href="tel:9000000000" className="te-footer__phone-cta">
            <span className="material-symbols-outlined">call</span>
            <div>
              <div className="text-label-caps">Call Us Anytime</div>
              <div className="te-footer__phone-number">9000000000</div>
            </div>
          </a>
        </div>

        {/* Explore Column */}
        <div className="te-footer__col">
          <h3 className="te-footer__col-title">Explore</h3>
          <nav className="te-footer__links">
            <Link to="/explore">Destinations</Link>
            <Link to="/packages">Tour Packages</Link>
            <Link to="/packages?destination=Kerala">Kerala</Link>
            <Link to="/packages?destination=Goa">Goa</Link>
            <Link to="/packages?destination=Rajasthan">Rajasthan</Link>
            <Link to="/packages?destination=Kashmir">Kashmir</Link>
          </nav>
        </div>

        {/* Services Column */}
        <div className="te-footer__col">
          <h3 className="te-footer__col-title">Services</h3>
          <nav className="te-footer__links">
            <Link to="/book">Book a Tour</Link>
            <Link to="/booking-status">Check Booking Status</Link>
            <Link to="/contact">Contact Support</Link>
            <Link to="/admin/login">Admin Portal</Link>
          </nav>
        </div>

        {/* Support Column */}
        <div className="te-footer__col">
          <h3 className="te-footer__col-title">Support</h3>
          <div className="te-footer__support-items">
            <div className="te-footer__support-item">
              <span className="material-symbols-outlined">support_agent</span>
              <div>
                <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>Customer Support</div>
                <div style={{color:'var(--color-on-surface)', fontWeight:600}}>9000000000</div>
              </div>
            </div>
            <div className="te-footer__support-item">
              <span className="material-symbols-outlined">schedule</span>
              <div>
                <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>Hours</div>
                <div style={{color:'var(--color-on-surface)', fontWeight:600}}>9 AM – 8 PM, Mon–Sat</div>
              </div>
            </div>
            <div className="te-footer__support-item">
              <span className="material-symbols-outlined">psychology</span>
              <div>
                <div className="text-label-caps" style={{color:'var(--color-on-surface-variant)'}}>AI Assistant</div>
                <div style={{color:'var(--color-on-surface)', fontWeight:600}}>24/7 Available</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="te-footer__bottom">
        <div className="container te-footer__bottom-inner">
          <p>© 2026 TravelEase. DBMS Laboratory Project.</p>
          <p className="te-footer__stack">React + PHP + MySQL</p>
        </div>
      </div>
    </footer>
  );
}
