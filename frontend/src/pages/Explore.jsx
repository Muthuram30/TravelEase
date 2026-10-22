import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { destinationsApi } from '../api/api';
import { getDestinationImage } from '../utils/destinationImages';
import DestinationGlobe from '../components/3d/DestinationGlobe';
import './Explore.css';

const TYPES = ['All', 'coastal', 'snow_alpine', 'backwater', 'forest', 'heritage'];

// Local artwork resolver — keyed lookups and themed fallback are shared
// with Home.jsx via utils/destinationImages.js
const DEST_PHOTO_MAP = (dest) => getDestinationImage(
  dest?.name || dest?.title || dest?.state || '',
  dest?.environment_category || dest?.category || dest?.type || ''
);

export default function Explore() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'globe'
  const [destinations, setDestinations] = useState([]);
  const [selectedGlobeDest, setSelectedGlobeDest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    destinationsApi.list()
      .then(setDestinations)
      .catch(err => {
        console.error('Failed to load destinations:', err);
        setError(err.message || 'Failed to load destinations');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (type) => {
    setFilter(type);
  };

  const filtered = filter === 'All' 
    ? destinations 
    : destinations.filter(d => d.environment_category === filter);

  if (loading) {
    return (
      <div className="explore-page">
        <div className="container" style={{padding: '4rem 0', textAlign: 'center'}}>
          <div className="text-body-lg">Loading destinations...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explore-page">
        <div className="container" style={{padding: '4rem 0', textAlign: 'center'}}>
          <div className="text-body-lg" style={{color: 'var(--color-error)'}}>{error}</div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="explore-page">
      {/* Hero */}
      <div className="explore-hero">
        <div className="explore-hero__bg" />
        <div className="explore-hero__overlay" />
        <div className="container explore-hero__content">
          <div className="text-label-caps explore-hero__tag">Explore India</div>
          <h1 className="text-headline-lg">Discover India's Wonders</h1>
          <p className="text-body-lg explore-hero__desc">
            From Himalayan peaks to tropical beaches — India's diversity is unmatched.
          </p>

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1.25rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('grid')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
              Curated Cards View
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'globe' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setViewMode('globe');
                if (destinations.length > 0 && !selectedGlobeDest) {
                  setSelectedGlobeDest(destinations[0]);
                }
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>public</span>
              Interactive 3D Earth
            </button>
          </div>
        </div>
      </div>

      <div className="container explore-main">
        {/* Filter tabs */}
        <div className="explore-filters no-scrollbar">
          {TYPES.map((type) => (
            <button
              key={type}
              className={`explore-filter-btn ${filter === type ? 'explore-filter-btn--active' : ''}`}
              onClick={() => handleFilterChange(type)}
            >
              {type === 'All' ? 'All' : type.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* 3D Globe Mode */}
        {viewMode === 'globe' && (
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <DestinationGlobe
              destinations={filtered}
              onDestinationSelect={(dest) => {
                setSelectedGlobeDest(dest);
              }}
            />

            {/* Floating Selection Drawer */}
            {selectedGlobeDest && (
              <div
                className="glass-card animate-fade-up"
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  left: '24px',
                  maxWidth: '380px',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-outline-variant)',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
                  zIndex: 10
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                  <img
                    src={DEST_PHOTO_MAP(selectedGlobeDest)}
                    alt={selectedGlobeDest.name}
                    style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
                  />
                  <div>
                    <span className="text-label-caps" style={{ color: 'var(--color-primary)' }}>
                      {selectedGlobeDest.region || selectedGlobeDest.state}
                    </span>
                    <h3 className="text-headline-sm" style={{ margin: '2px 0 0' }}>{selectedGlobeDest.name}</h3>
                    <span className="text-body-sm" style={{ opacity: 0.8 }}>
                      {selectedGlobeDest.environment_category?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <p className="text-body-sm" style={{ margin: '8px 0 12px', lineHeight: 1.5 }}>
                  {selectedGlobeDest.highlight_text || selectedGlobeDest.description}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-pill"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => {
                      navigate(`/packages?destination=${encodeURIComponent(selectedGlobeDest.name)}`);
                    }}
                  >
                    View Packages ({selectedGlobeDest.package_count || 0})
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/route-planner?destination=${encodeURIComponent(selectedGlobeDest.name)}`)}
                    title="Plan Route to Destination"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>map</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Destination grid (Grid View) */}
        {viewMode === 'grid' && (
          <div className="explore-grid">
            {filtered.map((dest, i) => (
              <div
                key={dest.destination_id}
                className={`explore-card animate-fade-up stagger-${Math.min(i % 6 + 1, 6)}`}
                style={{ animationDelay: `${(i % 6) * 60}ms`, animationFillMode: 'both' }}
                onClick={() => {
                  navigate(`/packages?destination=${encodeURIComponent(dest.name)}`);
                }}
              >
                <div className="explore-card__img-wrap">
                  <img
                    src={DEST_PHOTO_MAP(dest)}
                    alt={dest.name}
                    loading="lazy"
                  />
                  <div className="explore-card__overlay" />
                  <div className="explore-card__badge">{dest.environment_category || 'Destination'}</div>
                </div>
                <div className="explore-card__body">
                  <div className="explore-card__region text-label-caps">{dest.region}</div>
                  <h2 className="explore-card__name text-headline-sm">{dest.name}</h2>
                  <p className="explore-card__highlight text-body-sm">{dest.highlight_text || dest.description}</p>
                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                    <button className="btn btn-primary btn-pill btn-sm" style={{ flex: 1 }}>
                      View Packages ({dest.package_count || 0})
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/route-planner?destination=${encodeURIComponent(dest.name)}`);
                      }}
                      title="Plan Route"
                    >
                      <span className="material-symbols-outlined">map</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{textAlign: 'center', padding: '4rem 0'}}>
            <p className="text-body-md" style={{color: 'var(--color-on-surface-variant)'}}>
              No destinations found for this filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
