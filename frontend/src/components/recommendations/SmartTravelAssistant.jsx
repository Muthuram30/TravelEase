import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { recommendationsApi } from '../../api/api';
import { formatPrice } from '../PackageCard';
import './SmartTravelAssistant.css';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const GROUP_TYPES = [
  { value: 'solo', label: 'Solo Traveler', icon: '👤' },
  { value: 'couple', label: 'Couple', icon: '💑' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'friends', label: 'Friends', icon: '👥' },
  { value: 'senior', label: 'Senior Group', icon: '👴' },
];

const DESTINATIONS = [
  'Kerala', 'Goa', 'Rajasthan', 'Himachal Pradesh', 'Kashmir', 
  'Tamil Nadu', 'Karnataka', 'Uttarakhand', 'Andaman', 'Sikkim'
];

export default function SmartTravelAssistant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTheme } = useTheme();

  // Form state
  const [budget, setBudget] = useState(50000);
  const [duration, setDuration] = useState(5);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [groupType, setGroupType] = useState('couple');
  const [interests, setInterests] = useState([]);
  const [destination, setDestination] = useState('');
  const [accessibility, setAccessibility] = useState([]);
  
  // Categories from API
  const [categories, setCategories] = useState([]);
  
  // Results state
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await recommendationsApi.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
      // Use fallback categories
      setCategories([
        { category_slug: 'nature', category_name: 'Nature & Wildlife', icon: '🌿' },
        { category_slug: 'beach', category_name: 'Beach & Coastal', icon: '🏖️' },
        { category_slug: 'heritage', category_name: 'Heritage & Culture', icon: '🏛️' },
        { category_slug: 'adventure', category_name: 'Adventure & Sports', icon: '⛰️' },
        { category_slug: 'food', category_name: 'Food & Culinary', icon: '🍛' },
        { category_slug: 'wellness', category_name: 'Wellness & Spa', icon: '🧘' },
        { category_slug: 'photography', category_name: 'Photography', icon: '📸' },
        { category_slug: 'hill-station', category_name: 'Hill Station', icon: '🏔️' },
      ]);
    }
  };

  const toggleInterest = (slug) => {
    setInterests(prev =>
      prev.includes(slug) ? prev.filter(i => i !== slug) : [...prev, slug]
    );
  };

  const toggleAccessibility = (feature) => {
    setAccessibility(prev =>
      prev.includes(feature) ? prev.filter(a => a !== feature) : [...prev, feature]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const preferences = {
        budget,
        duration,
        month,
        group_type: groupType,
        interests,
        destination,
        accessibility,
        limit: 6,
        user_theme: currentTheme
      };

      const result = await recommendationsApi.getSmartRecommendations(preferences);
      setRecommendations(result);
      setShowForm(false);
    } catch (err) {
      // Check if error is premium-related
      const errorMsg = err.message || 'Failed to get recommendations';
      setError(errorMsg);
      
      // If premium feature error, scroll to top to show message
      if (errorMsg.toLowerCase().includes('premium') || errorMsg.toLowerCase().includes('upgrade')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(true);
    setRecommendations(null);
    setError('');
  };

  return (
    <div className="smart-assistant">
      {showForm ? (
        <form className="assistant-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <h2>🎯 Smart Travel Match</h2>
            <p>Answer a few questions to get personalized recommendations with transparent scoring</p>
            
            {/* Role-based info banner */}
            {user && (
              <div className={`role-info-banner role-info-banner--${user.role}`}>
                <div className="role-info-banner__content">
                  <span className="material-symbols-outlined">
                    {user.role === 'admin' ? 'shield' : user.role === 'premium' ? 'workspace_premium' : 'person'}
                  </span>
                  <div>
                    <strong>{user.role === 'admin' ? 'Admin' : user.role === 'premium' ? 'Premium Member' : 'Free Member'}</strong>
                    <span className="role-info-banner__limit">
                      {user.role === 'admin' 
                        ? 'Unlimited results • All features'
                        : user.role === 'premium' 
                        ? 'Up to 12 results • Advanced filters enabled'
                        : 'Up to 6 results • Upgrade for advanced filters'}
                    </span>
                  </div>
                </div>
                {user.role === 'user' && (
                  <a href="/upgrade" className="role-info-banner__upgrade">
                    Upgrade
                  </a>
                )}
              </div>
            )}
            
            {!user && (
              <div className="role-info-banner role-info-banner--guest">
                <div className="role-info-banner__content">
                  <span className="material-symbols-outlined">info</span>
                  <div>
                    <strong>Guest Mode</strong>
                    <span className="role-info-banner__limit">
                      Up to 3 results • Log in for more features
                    </span>
                  </div>
                </div>
                <a href="/login" className="role-info-banner__upgrade">
                  Log in
                </a>
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error">
              <span className="material-symbols-outlined">error</span>
              <div>
                <strong>Error</strong>
                <p>{error}</p>
                {(error.toLowerCase().includes('premium') || error.toLowerCase().includes('upgrade')) && (
                  <a href="/upgrade" className="alert-link">Upgrade to Premium →</a>
                )}
              </div>
            </div>
          )}

          {/* Budget */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">💰</span>
              <span>Budget per person</span>
              <strong className="label-value">₹{budget.toLocaleString()}</strong>
            </label>
            <input
              type="range"
              min="5000"
              max="200000"
              step="5000"
              value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value))}
              className="range-slider"
            />
            <div className="range-labels">
              <span>₹5k</span>
              <span>₹50k</span>
              <span>₹1L</span>
              <span>₹2L</span>
            </div>
          </div>

          {/* Duration */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">📅</span>
              <span>Trip duration</span>
              <strong className="label-value">{duration} days</strong>
            </label>
            <input
              type="range"
              min="2"
              max="15"
              step="1"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="range-slider"
            />
            <div className="range-labels">
              <span>Weekend</span>
              <span>Week</span>
              <span>Extended</span>
            </div>
          </div>

          {/* Travel Month */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">🗓️</span>
              <span>Travel month</span>
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="form-select"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Group Type */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">👥</span>
              <span>Traveling with</span>
            </label>
            <div className="button-grid">
              {GROUP_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  className={`chip-button ${groupType === type.value ? 'active' : ''}`}
                  onClick={() => setGroupType(type.value)}
                >
                  <span className="chip-icon">{type.icon}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">❤️</span>
              <span>Your interests</span>
              <span className="label-hint">(Select 1-4)</span>
            </label>
            <div className="interest-grid">
              {categories.map(cat => (
                <button
                  key={cat.category_slug}
                  type="button"
                  className={`interest-chip ${interests.includes(cat.category_slug) ? 'active' : ''}`}
                  onClick={() => toggleInterest(cat.category_slug)}
                  disabled={!interests.includes(cat.category_slug) && interests.length >= 4}
                >
                  <span className="chip-emoji">{cat.icon}</span>
                  <span>{cat.category_name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Destination Preference */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">📍</span>
              <span>Preferred destination (optional)</span>
            </label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="form-select"
            >
              <option value="">Any destination</option>
              {DESTINATIONS.map(dest => (
                <option key={dest} value={dest}>{dest}</option>
              ))}
            </select>
          </div>

          {/* Accessibility */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">♿</span>
              <span>Accessibility needs (optional)</span>
            </label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={accessibility.includes('wheelchair')}
                  onChange={() => toggleAccessibility('wheelchair')}
                />
                <span>Wheelchair accessible</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={accessibility.includes('senior')}
                  onChange={() => toggleAccessibility('senior')}
                />
                <span>Senior-friendly</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={accessibility.includes('child')}
                  onChange={() => toggleAccessibility('child')}
                />
                <span>Child-friendly</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || interests.length === 0}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Analyzing matches...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">auto_awesome</span>
                  <span>Find My Perfect Trip</span>
                </>
              )}
            </button>
            {interests.length === 0 && (
              <p className="form-hint-error">Please select at least one interest</p>
            )}
          </div>

          {error && (
            <div className="error-message">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}
        </form>
      ) : (
        <RecommendationResults
          recommendations={recommendations}
          onReset={resetForm}
          onSelectPackage={(pkgId) => navigate(`/packages/${pkgId}`)}
        />
      )}
    </div>
  );
}

function RecommendationResults({ recommendations, onReset, onSelectPackage }) {
  const { packages, suggestions, total_candidates, scoring_weights } = recommendations;

  if (!packages || packages.length === 0) {
    return (
      <div className="no-results">
        <span className="material-symbols-outlined" style={{ fontSize: '64px' }}>search_off</span>
        <h3>No matches found</h3>
        <p>{recommendations.message || 'Try adjusting your preferences'}</p>
        {recommendations.suggestions && (
          <ul className="suggestions-list">
            {recommendations.suggestions.map((sug, idx) => (
              <li key={idx}>{sug}</li>
            ))}
          </ul>
        )}
        <button onClick={onReset} className="btn btn-primary">
          <span className="material-symbols-outlined">restart_alt</span>
          <span>Try Different Preferences</span>
        </button>
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="results-header">
        <div>
          <h2>🎯 Your Personalized Matches</h2>
          <p>Found <strong>{packages.length}</strong> packages from {total_candidates} candidates</p>
        </div>
        <button onClick={onReset} className="btn btn-secondary">
          <span className="material-symbols-outlined">tune</span>
          <span>Adjust Preferences</span>
        </button>
      </div>

      {/* Scoring Explanation */}
      <div className="scoring-info">
        <h4>📊 How We Score</h4>
        <div className="weight-chips">
          <span className="weight-chip">Interest Match: {scoring_weights.interest}%</span>
          <span className="weight-chip">Budget Fit: {scoring_weights.budget}%</span>
          <span className="weight-chip">Duration: {scoring_weights.duration}%</span>
          <span className="weight-chip">Season: {scoring_weights.season}%</span>
          <span className="weight-chip">Group Fit: {scoring_weights.group}%</span>
          <span className="weight-chip">Destination: {scoring_weights.destination}%</span>
          <span className="weight-chip">History: {scoring_weights.history}%</span>
        </div>
      </div>

      {/* Assistive Suggestions */}
      {suggestions && (
        <div className="suggestions-panel">
          <h4>💡 Travel Tips</h4>
          <div className="tips-grid">
            {suggestions.best_months && <p><strong>Season:</strong> {suggestions.best_months}</p>}
            {suggestions.recommended_duration && <p><strong>Duration:</strong> {suggestions.recommended_duration}</p>}
            {suggestions.budget_guidance && <p><strong>Budget:</strong> {suggestions.budget_guidance}</p>}
            {suggestions.nearby_attractions && <p><strong>Don't miss:</strong> {suggestions.nearby_attractions}</p>}
          </div>
        </div>
      )}

      {/* Package Results */}
      <div className="results-grid">
        {packages.map((pkg) => (
          <PackageResult
            key={pkg.package_id}
            package={pkg}
            onSelect={onSelectPackage}
          />
        ))}
      </div>
    </div>
  );
}

function PackageResult({ package: pkg, onSelect }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="package-result-card">
      {/* Match Badge */}
      <div className="match-badge">
        <div className="match-percentage">{pkg.match_percentage}%</div>
        <div className="match-label">Match</div>
      </div>

      {/* Badges */}
      {pkg.badges && pkg.badges.length > 0 && (
        <div className="result-badges">
          {pkg.badges.map((badge, idx) => (
            <span key={idx} className="badge">{badge}</span>
          ))}
        </div>
      )}

      {/* Package Info */}
      <h3 className="result-title">{pkg.package_name}</h3>
      <p className="result-destination">
        <span className="material-symbols-outlined">location_on</span>
        {pkg.destination_name || pkg.destination}
      </p>

      <div className="result-details">
        <span className="detail-item">
          <span className="material-symbols-outlined">schedule</span>
          {pkg.duration_days}D/{pkg.duration_nights}N
        </span>
        <span className="detail-item price">
          <span className="material-symbols-outlined">currency_rupee</span>
          {formatPrice(pkg.price)}
        </span>
      </div>

      {/* Why This Matches */}
      <div className="reasons-section">
        <h4>✨ Why this matches you:</h4>
        <ul className="reasons-list">
          {pkg.reasons.map((reason, idx) => (
            <li key={idx}>{reason}</li>
          ))}
        </ul>
      </div>

      {/* Warnings */}
      {pkg.warnings && pkg.warnings.length > 0 && (
        <div className="warnings-section">
          <h4>⚠️ Things to note:</h4>
          <ul className="warnings-list">
            {pkg.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Score Breakdown Toggle */}
      <button
        className="breakdown-toggle"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        <span className="material-symbols-outlined">
          {showBreakdown ? 'expand_less' : 'expand_more'}
        </span>
        <span>{showBreakdown ? 'Hide' : 'Show'} Score Breakdown</span>
      </button>

      {showBreakdown && (
        <div className="score-breakdown">
          <h5>Score Details:</h5>
          <div className="breakdown-grid">
            {Object.entries(pkg.score_breakdown).map(([key, value]) => (
              <div key={key} className="breakdown-item">
                <span className="breakdown-label">{key.replace(/_/g, ' ')}:</span>
                <span className="breakdown-value">{value.toFixed(1)}</span>
              </div>
            ))}
            <div className="breakdown-item total">
              <span className="breakdown-label">Total:</span>
              <span className="breakdown-value">{pkg.total_score.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        className="btn btn-primary btn-block"
        onClick={() => onSelect(pkg.package_id)}
      >
        <span className="material-symbols-outlined">visibility</span>
        <span>View Full Details</span>
      </button>
    </div>
  );
}
