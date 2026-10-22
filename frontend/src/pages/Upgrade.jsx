import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Upgrade.css';

export default function Upgrade() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    alert('Premium upgrade coming soon! Contact us at 9000000000 for early access.');
  };

  return (
    <div className="upgrade-page">
      <div className="container upgrade-container">
        {/* Header */}
        <div className="upgrade-header">
          <div className="upgrade-header__icon">
            <span className="material-symbols-outlined">workspace_premium</span>
          </div>
          <h1 className="text-display-md">Upgrade to Premium</h1>
          <p className="text-body-lg">
            Unlock unlimited bookings, advanced tools, and priority support
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="upgrade-plans">
          {/* Free Plan */}
          <div className="plan-card plan-card--current">
            <div className="plan-card__header">
              <h3 className="plan-card__name">Free</h3>
              <div className="plan-card__price">
                <span className="plan-card__amount">₹0</span>
                <span className="plan-card__period">/month</span>
              </div>
            </div>
            
            <ul className="plan-card__features">
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>3 bookings per month</span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Basic package search</span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Smart recommendations (6 results)</span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Email support</span>
              </li>
            </ul>

            {(!user || user.role === 'user') && (
              <div className="plan-card__badge">Current Plan</div>
            )}
          </div>

          {/* Premium Plan */}
          <div className="plan-card plan-card--premium">
            <div className="plan-card__popular">
              <span className="material-symbols-outlined">star</span>
              Most Popular
            </div>
            
            <div className="plan-card__header">
              <h3 className="plan-card__name">Premium</h3>
              <div className="plan-card__price">
                <span className="plan-card__amount">₹999</span>
                <span className="plan-card__period">/month</span>
              </div>
            </div>
            
            <ul className="plan-card__features">
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span><strong>Unlimited bookings</strong></span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>All Free features</span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span><strong>Interactive route planner</strong></span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span><strong>Food discovery platform</strong></span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Smart recommendations (12 results)</span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Advanced search filters</span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span><strong>24/7 priority support</strong></span>
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Early access to new features</span>
              </li>
            </ul>

            {user && user.role === 'premium' ? (
              <div className="plan-card__badge">Current Plan</div>
            ) : (
              <button onClick={handleUpgrade} className="btn btn-primary btn-lg btn-block">
                <span className="material-symbols-outlined">upgrade</span>
                Upgrade Now
              </button>
            )}
          </div>
        </div>

        {/* Features Comparison */}
        <div className="upgrade-comparison">
          <h2 className="text-headline-lg">What You Get with Premium</h2>
          
          <div className="comparison-grid">
            <div className="comparison-feature">
              <div className="comparison-feature__icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <span className="material-symbols-outlined">route</span>
              </div>
              <h3>Route Planner</h3>
              <p>Plan multi-stop journeys with interactive maps, estimated travel times, and optimal routes.</p>
            </div>

            <div className="comparison-feature">
              <div className="comparison-feature__icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                <span className="material-symbols-outlined">restaurant</span>
              </div>
              <h3>Food Discovery</h3>
              <p>Discover authentic local restaurants, read reviews, and book tables at top-rated eateries.</p>
            </div>

            <div className="comparison-feature">
              <div className="comparison-feature__icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                <span className="material-symbols-outlined">all_inclusive</span>
              </div>
              <h3>Unlimited Bookings</h3>
              <p>Book as many tours as you want each month without any restrictions or limits.</p>
            </div>

            <div className="comparison-feature">
              <div className="comparison-feature__icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
                <span className="material-symbols-outlined">support_agent</span>
              </div>
              <h3>Priority Support</h3>
              <p>Get help anytime with 24/7 priority customer support via phone, email, and chat.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="upgrade-cta">
          <h2 className="text-headline-md">Ready to unlock premium features?</h2>
          <p className="text-body-lg">Join thousands of travelers enjoying unlimited access</p>
          <button onClick={handleUpgrade} className="btn btn-primary btn-lg">
            <span className="material-symbols-outlined">workspace_premium</span>
            Upgrade to Premium
          </button>
          <p className="upgrade-cta__note">
            <span className="material-symbols-outlined">call</span>
            Questions? Call us at <a href="tel:9000000000">9000000000</a>
          </p>
        </div>
      </div>
    </div>
  );
}
