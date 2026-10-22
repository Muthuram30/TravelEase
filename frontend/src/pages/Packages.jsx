import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { packagesApi } from '../api/api';
import PackageCard from '../components/PackageCard';
import RecommendationEngine from '../components/recommendations/RecommendationEngine';
import './Packages.css';

export default function Packages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [packages, setPackages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState(searchParams.get('search') || '');
  const [destination, setDestination] = useState(searchParams.get('destination') || '');
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    const q    = searchParams.get('search')      || '';
    const dest = searchParams.get('destination') || '';
    setSearch(q);
    setDestination(dest);

    setLoading(true);
    const params = {};
    if (q)    params.search      = q;
    if (dest) params.destination = dest;

    packagesApi.list(params)
      .then(setPackages)
      .catch(() => setError('Failed to load packages. Please try again.'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    const p = {};
    if (search.trim())      p.search      = search.trim();
    if (destination.trim()) p.destination = destination.trim();
    setSearchParams(p);
  };

  const clearFilters = () => {
    setSearch('');
    setDestination('');
    setSearchParams({});
  };

  const hasFilters = search || destination;

  return (
    <div className="packages-page page-enter page-enter-active">
      {/* ---- Page Header ---- */}
      <div className="packages-hero">
        <div className="packages-hero__bg" />
        <div className="packages-hero__overlay" />
        <div className="container packages-hero__content">
          <div className="text-label-caps packages-hero__tag">Tour Packages</div>
          <h1 className="text-headline-lg packages-hero__title">Discover Your Perfect Journey</h1>
          <p className="text-body-lg packages-hero__desc">
            Handcrafted tour packages across India's most breathtaking destinations.
          </p>
        </div>
      </div>

      <div className="container packages-main">
        {/* ---- Search & Filter ---- */}
        <div className="packages-filters glass-card">
          <form className="packages-filters__form" onSubmit={handleSearch}>
            <div className="input-group">
              <label htmlFor="pkg-search">
                <span className="material-symbols-outlined">search</span>
                Search
              </label>
              <input
                id="pkg-search"
                type="text"
                className="input-field"
                placeholder="Package name, destination..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="pkg-dest">
                <span className="material-symbols-outlined">location_on</span>
                Destination
              </label>
              <input
                id="pkg-dest"
                type="text"
                className="input-field"
                placeholder="e.g. Kerala, Goa..."
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div className="packages-filters__actions">
              <button type="submit" className="btn btn-primary">
                <span className="material-symbols-outlined">travel_explore</span>
                Search
              </button>
              <button
                type="button"
                className={`btn ${showRecommendations ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowRecommendations(!showRecommendations)}
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                {showRecommendations ? 'Hide Match' : 'AI Match'}
              </button>
              {hasFilters && (
                <button type="button" className="btn btn-ghost" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* AI Matchmaker Drawer */}
        {showRecommendations && (
          <div className="animate-fade-up" style={{ marginBottom: '2rem' }}>
            <RecommendationEngine />
          </div>
        )}

        {/* ---- Results Count ---- */}
        {!loading && (
          <div className="packages-results-info text-body-sm">
            {hasFilters ? (
              <span>
                Showing <strong>{packages.length}</strong> result{packages.length !== 1 ? 's' : ''} 
                {search ? ` for "${search}"` : ''}{destination ? ` in ${destination}` : ''}
              </span>
            ) : (
              <span><strong>{packages.length}</strong> tour packages available</span>
            )}
          </div>
        )}

        {/* ---- Package Grid ---- */}
        {loading ? (
          <div className="packages-grid">
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} className="pkg-skeleton" style={{borderRadius:'var(--radius-xl)',overflow:'hidden',background:'var(--color-surface-container-lowest)'}}>
                <div className="skeleton" style={{height:200}} />
                <div style={{padding:'1rem',display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                  <div className="skeleton" style={{height:14,width:'40%'}} />
                  <div className="skeleton" style={{height:20,width:'80%'}} />
                  <div className="skeleton" style={{height:40}} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="packages-empty">
            <span className="material-symbols-outlined">error</span>
            <p>{error}</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="packages-empty">
            <span className="material-symbols-outlined">luggage</span>
            <p>No packages found{hasFilters ? ' matching your search' : ''}.</p>
            {hasFilters && (
              <button className="btn btn-primary" onClick={clearFilters}>View All Packages</button>
            )}
          </div>
        ) : (
          <div className="packages-grid">
            {packages.map((pkg, i) => (
              <PackageCard key={pkg.package_id} pkg={pkg} delay={i * 60} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
