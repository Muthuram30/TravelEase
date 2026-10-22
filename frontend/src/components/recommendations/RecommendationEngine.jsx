import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendationsApi } from '../../api/api';
import { formatPrice } from '../PackageCard';
import './RecommendationEngine.css';

const ENVIRONMENTS = [
  { id: 'tea_hills', label: 'Tea Hills', icon: 'landscape' },
  { id: 'backwater', label: 'Backwaters', icon: 'water' },
  { id: 'coastal', label: 'Beach Coastal', icon: 'beach_access' },
  { id: 'snow_alpine', label: 'Himalayan Snow', icon: 'ac_unit' },
  { id: 'desert', label: 'Desert Dunes', icon: 'wb_sunny' },
  { id: 'forest', label: 'Rainforest', icon: 'forest' },
  { id: 'heritage', label: 'Historic Ruins', icon: 'temple_hindu' },
];

const STYLES = [
  { id: 'relaxation', label: 'Relaxation' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'cultural', label: 'Cultural Heritage' },
  { id: 'honeymoon', label: 'Honeymoon' },
  { id: 'family', label: 'Family Friendly' },
];

export default function RecommendationEngine({ compact = false }) {
  const navigate = useNavigate();

  // Load saved preferences or defaults
  const [budgetMax, setBudgetMax] = useState(() => {
    const saved = localStorage.getItem('travelease_pref_budget');
    return saved ? parseInt(saved, 10) : 35000;
  });

  const [selectedEnvs, setSelectedEnvs] = useState(() => {
    const saved = localStorage.getItem('travelease_pref_envs');
    return saved ? JSON.parse(saved) : ['backwater', 'coastal'];
  });

  const [selectedStyles, setSelectedStyles] = useState(() => {
    const saved = localStorage.getItem('travelease_pref_styles');
    return saved ? JSON.parse(saved) : ['relaxation'];
  });

  const [duration, setDuration] = useState(() => {
    const saved = localStorage.getItem('travelease_pref_duration');
    return saved ? parseInt(saved, 10) : 5;
  });

  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [expanded, setExpanded] = useState(!compact);

  // Toggle environment
  const toggleEnv = (envId) => {
    setSelectedEnvs((prev) =>
      prev.includes(envId) ? prev.filter((e) => e !== envId) : [...prev, envId]
    );
  };

  // Toggle style
  const toggleStyle = (styleId) => {
    setSelectedStyles((prev) =>
      prev.includes(styleId) ? prev.filter((s) => s !== styleId) : [...prev, styleId]
    );
  };

  // Detect location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { timeout: 8000 }
    );
  };

  // Fetch recommendations
  const fetchRecommendations = () => {
    setLoading(true);

    // Save preferences
    localStorage.setItem('travelease_pref_budget', budgetMax.toString());
    localStorage.setItem('travelease_pref_envs', JSON.stringify(selectedEnvs));
    localStorage.setItem('travelease_pref_styles', JSON.stringify(selectedStyles));
    localStorage.setItem('travelease_pref_duration', duration.toString());

    const payload = {
      budget_min: 0,
      budget_max: budgetMax,
      duration_days: duration,
      environment: selectedEnvs,
      package_type: selectedStyles,
      origin_lat: userLocation?.lat || null,
      origin_lng: userLocation?.lng || null,
    };

    recommendationsApi.getPackages(payload)
      .then((data) => {
        setRecommendations(data.recommendations || []);
      })
      .catch((err) => {
        console.warn('Recommendation API fallback:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecommendations();
  }, [budgetMax, selectedEnvs, selectedStyles, duration, userLocation]);

  return (
    <div className={`recom-engine glass-card ${compact ? 'recom-engine--compact' : ''}`}>
      {/* Header */}
      <div className="recom-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="recom-badge-icon">
            <span className="material-symbols-outlined">auto_awesome</span>
          </div>
          <div>
            <div className="text-label-caps" style={{ color: 'var(--color-primary)' }}>AI Travel Matchmaker</div>
            <h2 className="text-headline-sm" style={{ margin: 0 }}>Personalized For You</h2>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="material-symbols-outlined">
            {expanded ? 'expand_less' : 'tune'}
          </span>
          {expanded ? 'Hide Preferences' : 'Adjust Preferences'}
        </button>
      </div>

      {/* Preferences Form Drawer */}
      {expanded && (
        <div className="recom-prefs animate-fade-up">
          {/* Budget Slider */}
          <div className="recom-pref-group">
            <div className="recom-pref-label">
              <span>Maximum Budget / Person:</span>
              <strong style={{ color: 'var(--color-primary)', fontSize: '15px' }}>{formatPrice(budgetMax)}</strong>
            </div>
            <input
              type="range"
              min={10000}
              max={60000}
              step={2000}
              value={budgetMax}
              onChange={(e) => setBudgetMax(parseInt(e.target.value, 10))}
              className="recom-slider"
            />
          </div>

          {/* Duration Slider */}
          <div className="recom-pref-group">
            <div className="recom-pref-label">
              <span>Ideal Duration:</span>
              <strong style={{ color: 'var(--color-primary)', fontSize: '15px' }}>{duration} Days</strong>
            </div>
            <input
              type="range"
              min={3}
              max={10}
              step={1}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="recom-slider"
            />
          </div>

          {/* Environment Chips */}
          <div className="recom-pref-group">
            <div className="text-label-caps" style={{ marginBottom: '6px' }}>Preferred Terrains:</div>
            <div className="recom-chips">
              {ENVIRONMENTS.map((env) => {
                const active = selectedEnvs.includes(env.id);
                return (
                  <button
                    key={env.id}
                    type="button"
                    className={`recom-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleEnv(env.id)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{env.icon}</span>
                    {env.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Travel Style Chips */}
          <div className="recom-pref-group">
            <div className="text-label-caps" style={{ marginBottom: '6px' }}>Travel Vibe:</div>
            <div className="recom-chips">
              {STYLES.map((st) => {
                const active = selectedStyles.includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    className={`recom-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleStyle(st.id)}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleDetectLocation}
            >
              <span className="material-symbols-outlined">near_me</span>
              {userLocation ? 'GPS Proximity Active' : 'Enable Proximity Distance Boost'}
            </button>

            <span className="text-label-caps" style={{ fontSize: '11px', opacity: 0.7 }}>
              Auto-persisted to your device
            </span>
          </div>
        </div>
      )}

      {/* Recommendation Results List */}
      <div className="recom-results">
        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <span className="text-body-md" style={{ color: 'var(--color-on-surface-variant)' }}>
              Calculating personalized destination matches...
            </span>
          </div>
        ) : recommendations.length === 0 ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <p className="text-body-md" style={{ color: 'var(--color-on-surface-variant)' }}>
              No tour packages matched these strict filters. Try increasing budget or selecting more terrains!
            </p>
          </div>
        ) : (
          <div className="recom-cards-grid">
            {recommendations.slice(0, 3).map((pkg, idx) => {
              const coverImg = pkg.images?.[0]?.image_url || 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80';
              const matchScore = Math.min(99, Math.max(78, Math.round(pkg.recommendation_score ? 70 + pkg.recommendation_score : 85 + (3 - idx) * 4)));

              return (
                <div key={pkg.package_id} className="recom-card glass-card animate-fade-up">
                  <div className="recom-card__media">
                    <img src={coverImg} alt={pkg.package_name} loading="lazy" />
                    <div className="recom-card__match-pill">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bolt</span>
                      {matchScore}% Match
                    </div>
                  </div>

                  <div className="recom-card__body">
                    <div className="text-label-caps" style={{ color: 'var(--color-primary)', fontSize: '11px' }}>
                      {pkg.destination_name || pkg.destination} • {pkg.duration}
                    </div>
                    <h3 className="recom-card__title text-title-md">{pkg.package_name}</h3>

                    {/* Reasons list */}
                    {pkg.recommendation_reasons && pkg.recommendation_reasons.length > 0 && (
                      <div className="recom-card__reasons">
                        {pkg.recommendation_reasons.slice(0, 2).map((reason, i) => (
                          <div key={i} className="recom-card__reason text-body-sm">
                            <span className="material-symbols-outlined">check</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="recom-card__footer">
                      <div>
                        <span className="text-label-caps" style={{ opacity: 0.7, fontSize: '10px' }}>From</span>
                        <div className="text-headline-sm" style={{ color: 'var(--color-primary)', lineHeight: 1 }}>
                          {formatPrice(pkg.price)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/packages/${pkg.package_id}`)}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm btn-pill"
                          onClick={() => navigate(`/book/${pkg.package_id}`)}
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
