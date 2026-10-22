import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css';

const NAV_LINKS = [
  { path: '/',              label: 'Home' },
  { path: '/explore',       label: 'Explore' },
  { path: '/packages',      label: 'Packages' },
  { path: '/recommendations', label: 'Smart Match' },
  { path: '/contact',       label: 'Contact' },
];

export default function Header() {
  const location  = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout: authLogout, isAdmin } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await authLogout();
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className={`te-header ${scrolled ? 'te-header--scrolled' : ''}`}>
      <div className="te-header__inner container">
        {/* Brand Logo */}
        <Link to="/" className="te-header__brand">
          <div className="te-header__logo-icon">
            <span className="material-symbols-outlined">flight_takeoff</span>
          </div>
          <div>
            <div className="te-header__brand-name">TravelEase</div>
            <div className="te-header__brand-tagline text-label-caps">
              Explore • Discover • Experience
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="te-header__nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`te-header__nav-link ${isActive(link.path) ? 'te-header__nav-link--active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="te-header__actions">

          {/* User Menu */}
          {user ? (
            <div className="te-header__user-menu">
              <button type="button" className="te-header__user-btn" title={`${user.full_name} (${user.role})`}>
                <span className="material-symbols-outlined">account_circle</span>
                <span className="user-name">{user.full_name?.split(' ')[0]}</span>
                {user.role === 'premium' && <span className="premium-badge">PRO</span>}
                {user.role === 'admin' && <span className="admin-badge">ADMIN</span>}
              </button>
              <div className="user-dropdown">
                <Link to="/account" className="dropdown-item">
                  <span className="material-symbols-outlined">person</span>
                  <span>My Profile</span>
                </Link>
                <Link to="/booking-status" className="dropdown-item">
                  <span className="material-symbols-outlined">confirmation_number</span>
                  <span>My Bookings</span>
                </Link>
                {isAdmin && (
                  <Link to="/admin/dashboard" className="dropdown-item">
                    <span className="material-symbols-outlined">admin_panel_settings</span>
                    <span>Admin Dashboard</span>
                  </Link>
                )}
                <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
                <button onClick={handleLogout} className="dropdown-item">
                  <span className="material-symbols-outlined">logout</span>
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link to="/login" className="te-header__btn te-header__btn--secondary">
                Log In
              </Link>
              <Link to="/signup" className="te-header__btn te-header__btn--primary">
                Sign Up
              </Link>
            </>
          )}

          {/* Mobile Hamburger */}
          <button
            className={`te-header__burger ${menuOpen ? 'te-header__burger--open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`te-header__mobile-menu ${menuOpen ? 'te-header__mobile-menu--open' : ''}`}>
        <nav>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`te-header__mobile-link ${isActive(link.path) ? 'te-header__mobile-link--active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link to="/account" className="te-header__mobile-link">
                <span className="material-symbols-outlined">person</span>
                My Profile {user.role === 'premium' && '⭐'}
              </Link>
              <Link to="/booking-status" className="te-header__mobile-link">
                <span className="material-symbols-outlined">confirmation_number</span>
                My Bookings
              </Link>
              {isAdmin && (
                <Link to="/admin/dashboard" className="te-header__mobile-link te-header__mobile-link--admin">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                  Admin Dashboard
                </Link>
              )}
              <button type="button" onClick={handleLogout} className="te-header__mobile-link te-header__mobile-link--admin">
                <span className="material-symbols-outlined">logout</span>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="te-header__mobile-link te-header__mobile-link--admin">
                <span className="material-symbols-outlined">login</span>
                Log In
              </Link>
              <Link to="/signup" className="te-header__mobile-link te-header__mobile-link--admin">
                <span className="material-symbols-outlined">person_add</span>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
