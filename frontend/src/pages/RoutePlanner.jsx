import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import RouteMapPlanner from '../components/map/RouteMapPlanner';
import GeocodingAutocomplete from '../components/map/GeocodingAutocomplete';
import { destinationsApi } from '../api/api';
import './RoutePlanner.css';

const PRESET_DESTINATIONS = [
  { name: 'Munnar', lat: 10.0889, lng: 77.0595, state: 'Kerala' },
  { name: 'Alappuzha', lat: 9.4981, lng: 76.3388, state: 'Kerala' },
  { name: 'Goa', lat: 15.2993, lng: 74.1240, state: 'Goa' },
  { name: 'Manali', lat: 32.2432, lng: 77.1892, state: 'Himachal Pradesh' },
  { name: 'Jaisalmer', lat: 26.9157, lng: 70.9083, state: 'Rajasthan' },
  { name: 'Delhi', lat: 28.7041, lng: 77.1025, state: 'Delhi' },
  { name: 'Hampi', lat: 15.3350, lng: 76.4600, state: 'Karnataka' },
  { name: 'Wayanad', lat: 11.6054, lng: 76.0830, state: 'Kerala' },
  { name: 'Kovalam', lat: 8.4004, lng: 76.9790, state: 'Kerala' },
];

export default function RoutePlanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [origin, setOrigin] = useState({
    name: 'New Delhi',
    lat: 28.6139,
    lng: 77.2090,
  });

  const [destination, setDestination] = useState({
    name: 'Munnar',
    lat: 10.0889,
    lng: 77.0595,
  });

  const [waypoints, setWaypoints] = useState([]);
  const [transportMode, setTransportMode] = useState('car'); // 'car' | 'luxury_car' | 'airplane'
  const [copiedLink, setCopiedLink] = useState(false);
  const [destList, setDestList] = useState(PRESET_DESTINATIONS);

  // Initialize from URL search params if present
  useEffect(() => {
    const origParam = searchParams.get('origin');
    const destParam = searchParams.get('destination');
    const modeParam = searchParams.get('mode');

    if (destParam) {
      const match = PRESET_DESTINATIONS.find(
        (d) => d.name.toLowerCase() === destParam.toLowerCase()
      );
      if (match) {
        setDestination(match);
      }
    }

    if (modeParam && ['car', 'luxury_car', 'airplane'].includes(modeParam)) {
      setTransportMode(modeParam);
    }

    // Load actual destinations from API if possible
    destinationsApi.list()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d) => ({
            name: d.name,
            lat: parseFloat(d.latitude || 20.5937),
            lng: parseFloat(d.longitude || 78.9629),
            state: d.state,
          }));
          setDestList(mapped);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  // Add waypoint stop
  const handleAddWaypoint = () => {
    if (waypoints.length >= 3) return;
    setWaypoints([...waypoints, { name: '', lat: null, lng: null }]);
  };

  const handleUpdateWaypoint = (index, loc) => {
    const updated = [...waypoints];
    updated[index] = loc;
    setWaypoints(updated);
  };

  const handleRemoveWaypoint = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  // Swap origin and destination
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Copy shareable route link
  const handleShareRoute = () => {
    const params = new URLSearchParams();
    if (origin?.name) params.set('origin', origin.name);
    if (destination?.name) params.set('destination', destination.name);
    params.set('mode', transportMode);

    const fullUrl = `${window.location.origin}/route-planner?${params.toString()}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  return (
    <div className="route-planner-page">
      {/* Hero header */}
      <section className="route-hero">
        <div className="container route-hero__inner">
          <div className="route-hero__badge text-label-caps">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>explore</span>
            OpenFreeMap & Multimodal Cartography
          </div>
          <h1 className="text-headline-lg">Intelligent Route Planner</h1>
          <p className="text-body-lg route-hero__desc">
            Plan your cross-India journeys with road networks, luxury chauffeur routing, and flight corridors.
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="container route-planner-container">
        <div className="route-planner-layout">
          {/* Controls Panel */}
          <div className="route-controls glass-card">
            <div className="route-controls__header">
              <div className="text-title-md">Configure Your Route</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleSwap}
                title="Swap origin and destination"
              >
                <span className="material-symbols-outlined">swap_vert</span>
                Swap
              </button>
            </div>

            {/* Origin */}
            <div className="route-field">
              <GeocodingAutocomplete
                id="route-origin"
                label="Starting Point (Origin)"
                placeholder="City or location in India..."
                value={origin}
                onSelect={(loc) => setOrigin(loc)}
                required
              />
            </div>

            {/* Waypoints */}
            {waypoints.map((wp, i) => (
              <div key={i} className="route-waypoint-row">
                <div style={{ flex: 1 }}>
                  <GeocodingAutocomplete
                    id={`waypoint-${i}`}
                    label={`Intermediate Stop ${i + 1}`}
                    placeholder="Add a stop (e.g. Jaipur, Agra)..."
                    value={wp}
                    onSelect={(loc) => handleUpdateWaypoint(i, loc)}
                  />
                </div>
                <button
                  type="button"
                  className="route-waypoint-remove"
                  onClick={() => handleRemoveWaypoint(i)}
                  title="Remove this stop"
                  aria-label="Remove stop"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}

            {waypoints.length < 3 && (
              <button
                type="button"
                className="route-add-waypoint-btn text-label-caps"
                onClick={handleAddWaypoint}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_circle</span>
                Add Intermediate Stop (Waypoint)
              </button>
            )}

            {/* Destination */}
            <div className="route-field" style={{ marginTop: '0.75rem' }}>
              <GeocodingAutocomplete
                id="route-dest"
                label="Travel Destination"
                placeholder="Where are you traveling to?"
                value={destination}
                onSelect={(loc) => setDestination(loc)}
                required
              />
            </div>

            {/* Preset destinations chips */}
            <div className="route-presets">
              <span className="text-label-caps" style={{ fontSize: '11px', opacity: 0.8 }}>Popular Destinations:</span>
              <div className="route-preset-chips">
                {destList.slice(0, 6).map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    className={`route-preset-chip ${destination?.name === d.name ? 'active' : ''}`}
                    onClick={() => setDestination(d)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Transport Mode */}
            <div className="route-mode-section">
              <div className="text-label-caps" style={{ marginBottom: '8px' }}>Transport Mode</div>
              <div className="route-mode-grid">
                <button
                  type="button"
                  className={`route-mode-btn ${transportMode === 'car' ? 'active' : ''}`}
                  onClick={() => setTransportMode('car')}
                >
                  <span className="material-symbols-outlined">directions_car</span>
                  <div>
                    <div className="route-mode-btn__title text-title-sm">Road Network</div>
                    <div className="route-mode-btn__sub text-body-sm">Self / Rental Car</div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`route-mode-btn ${transportMode === 'luxury_car' ? 'active' : ''}`}
                  onClick={() => setTransportMode('luxury_car')}
                >
                  <span className="material-symbols-outlined">airport_shuttle</span>
                  <div>
                    <div className="route-mode-btn__title text-title-sm">Chauffeur Luxury</div>
                    <div className="route-mode-btn__sub text-body-sm">Premium Sedan / SUV</div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`route-mode-btn ${transportMode === 'airplane' ? 'active' : ''}`}
                  onClick={() => setTransportMode('airplane')}
                >
                  <span className="material-symbols-outlined">flight</span>
                  <div>
                    <div className="route-mode-btn__title text-title-sm">Air Corridor</div>
                    <div className="route-mode-btn__sub text-body-sm">Great Circle Flight</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="route-actions-row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleShareRoute}
                style={{ flex: 1 }}
              >
                <span className="material-symbols-outlined">share</span>
                {copiedLink ? 'Link Copied!' : 'Share Route'}
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (destination?.name) {
                    navigate(`/packages?destination=${encodeURIComponent(destination.name)}`);
                  } else {
                    navigate('/packages');
                  }
                }}
                style={{ flex: 1.4 }}
              >
                <span className="material-symbols-outlined">luggage</span>
                Explore Packages
              </button>
            </div>
          </div>

          {/* Interactive Map Area */}
          <div className="route-map-wrapper glass-card">
            <RouteMapPlanner
              origin={origin}
              destination={destination}
              waypoints={waypoints}
              transportMode={transportMode}
              style={{ height: '100%', minHeight: '560px', borderRadius: 'var(--radius-xl)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
