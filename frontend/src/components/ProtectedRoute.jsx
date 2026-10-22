import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontSize: '1.2rem',
        color: 'var(--text-secondary)'
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem'
      }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--error-color)' }}>Access Denied</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          You need admin privileges to access this page.
        </p>
        <a href="/" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>
          Return to Home
        </a>
      </div>
    );
  }

  return children;
}
