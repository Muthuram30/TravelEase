import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminLogin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, user, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in as admin
  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/dashboard');
    } else if (user && !isAdmin) {
      setError('Access denied. Admin privileges required.');
    }
  }, [user, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      return setError('Email and password are required.');
    }
    setLoading(true);
    try {
      const userData = await login(email, password);
      if (userData.role !== 'admin') {
        setError('This account does not have administrator access.');
        setLoading(false);
        return;
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adminlogin-page">
      {/* Background */}
      <div className="adminlogin-bg" />
      <div className="adminlogin-bg-overlay" />

      <div className="adminlogin-card glass-card">
        {/* Brand */}
        <div className="adminlogin-brand">
          <div className="adminlogin-brand__logo">
            <span className="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <div>
            <div className="adminlogin-brand__name text-headline-sm">TravelEase</div>
            <div className="adminlogin-brand__sub text-label-caps">Operations Portal</div>
          </div>
        </div>

        <h1 className="adminlogin-title text-headline-md">Admin Sign In</h1>
        <p className="adminlogin-desc text-body-sm">
          Authorized personnel only. Access is logged.
        </p>

        <form className="adminlogin-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="adminlogin-error">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          <div className="input-group">
            <label htmlFor="admin-user">
              <span className="material-symbols-outlined">email</span>
              Admin Email
            </label>
            <input
              id="admin-user"
              type="email"
              className="input-field"
              placeholder="admin@travelease.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="admin-pwd">
              <span className="material-symbols-outlined">lock</span>
              Password
            </label>
            <div className="adminlogin-pwd-wrap">
              <input
                id="admin-pwd"
                type={showPwd ? 'text' : 'password'}
                className="input-field adminlogin-pwd-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="adminlogin-pwd-toggle"
                onClick={() => setShowPwd(!showPwd)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined">
                  {showPwd ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg adminlogin-submit" disabled={loading}>
            {loading ? (
              <><span className="book-spinner" /> Signing in...</>
            ) : (
              <><span className="material-symbols-outlined">login</span> Sign In</>
            )}
          </button>
        </form>

        <div className="adminlogin-footer text-label-caps">
          <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Demo: admin@travelease.com / admin123
          </p>
          <a href="/" className="adminlogin-back">
            <span className="material-symbols-outlined">arrow_back</span>
            Back to TravelEase
          </a>
        </div>
      </div>
    </div>
  );
}
