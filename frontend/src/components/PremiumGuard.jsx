import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './PremiumGuard.css';

/**
 * PremiumGuard - Wraps premium content and shows upgrade prompt for non-premium users
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to show for premium users
 * @param {string} props.featureName - Name of the premium feature
 * @param {string} props.fallbackMessage - Custom message for non-premium users
 * @param {boolean} props.showPreview - If true, shows blurred preview instead of hiding content
 */
export default function PremiumGuard({ 
  children, 
  featureName = 'this feature', 
  fallbackMessage,
  showPreview = false 
}) {
  const { user } = useAuth();
  
  // Check if user has premium access
  const isPremium = user && (user.role === 'premium' || user.role === 'admin');
  
  // Premium users see content directly
  if (isPremium) {
    return <>{children}</>;
  }
  
  // Non-premium users see upgrade prompt
  return (
    <div className="premium-guard">
      {showPreview && (
        <div className="premium-guard__preview">
          {children}
        </div>
      )}
      
      <div className="premium-guard__overlay">
        <div className="premium-guard__card">
          <div className="premium-guard__icon">
            <span className="material-symbols-outlined">workspace_premium</span>
          </div>
          
          <h3 className="premium-guard__title">Premium Feature</h3>
          
          <p className="premium-guard__message">
            {fallbackMessage || `Unlock ${featureName} with TravelEase Premium`}
          </p>
          
          <div className="premium-guard__benefits">
            <div className="premium-guard__benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Unlimited bookings</span>
            </div>
            <div className="premium-guard__benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Route planner & maps</span>
            </div>
            <div className="premium-guard__benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Food discovery platform</span>
            </div>
            <div className="premium-guard__benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Priority support 24/7</span>
            </div>
          </div>
          
          <div className="premium-guard__actions">
            <Link to="/upgrade" className="btn btn-primary btn-lg">
              <span className="material-symbols-outlined">upgrade</span>
              Upgrade to Premium
            </Link>
            {!user && (
              <Link to="/login" className="btn btn-ghost">
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
