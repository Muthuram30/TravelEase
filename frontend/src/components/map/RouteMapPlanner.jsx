import { useEffect, useRef, useState } from 'react';
import * as maplibregl from '../../utils/maplibreSetup';
import 'maplibre-gl/dist/maplibre-gl.css';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let googleMapsLoader;

function loadGoogleMaps() {
  if (window.google?.maps?.DirectionsService) return Promise.resolve(window.google.maps);
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Google Maps API key is not configured.'));
  if (!googleMapsLoader) {
    googleMapsLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly`;
      script.async = true; script.defer = true;
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error('Google Maps failed to load.'));
      document.head.appendChild(script);
    });
  }
  return googleMapsLoader;
}

/**
 * Route planning map using MapLibre + OpenFreeMap
 * 
 * IMPORTANT PROVIDER BOUNDARIES:
 * - OpenFreeMap: Provides basemap tiles only
 * - Geocoding: Requires separate provider (configured via env)
 * - Routing: Requires separate provider (OSRM/Valhalla/etc)
 * - Turn-by-turn: Not included, needs separate provider
 */
export default function RouteMapPlanner({
  origin = null,
  destination = null,
  waypoints = [],
  transportMode = 'car',
  onLocationSelect,
  style = {}
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [routingError, setRoutingError] = useState(null);

  // Initialize map
  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap vector style
      center: [78.9629, 20.5937], // Center of India
      zoom: 4,
      attributionControl: true
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Add attribution for OpenFreeMap
    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add OpenFreeMap attribution
      const attribution = map.current._controls.find(c => c._container?.classList.contains('maplibregl-ctrl-attrib'));
      if (attribution) {
        const attribInner = attribution._container.querySelector('.maplibregl-ctrl-attrib-inner');
        if (attribInner && !attribInner.textContent.includes('OpenFreeMap')) {
          attribInner.innerHTML += ' | <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>';
        }
      }
    });

    // Click handler for location selection
    map.current.on('click', (e) => {
      if (onLocationSelect) {
        onLocationSelect({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat
        });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add origin marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !origin) return;

    // Remove existing origin marker
    const existingMarker = document.querySelector('.origin-marker');
    if (existingMarker) existingMarker.remove();

    const el = document.createElement('div');
    el.className = 'origin-marker';
    el.style.cssText = `
      width: 30px;
      height: 30px;
      background: #4caf50;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
    `;

    new maplibregl.Marker({ element: el })
      .setLngLat([origin.lng, origin.lat])
      .setPopup(new maplibregl.Popup().setHTML(`<strong>Origin</strong><br/>${origin.name || 'Start point'}`))
      .addTo(map.current);

  }, [origin, mapLoaded]);

  // Add destination marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !destination) return;

    const existingMarker = document.querySelector('.destination-marker');
    if (existingMarker) existingMarker.remove();

    const el = document.createElement('div');
    el.className = 'destination-marker';
    el.style.cssText = `
      width: 30px;
      height: 30px;
      background: #f44336;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
    `;

    new maplibregl.Marker({ element: el })
      .setLngLat([destination.lng, destination.lat])
      .setPopup(new maplibregl.Popup().setHTML(`<strong>Destination</strong><br/>${destination.name || 'End point'}`))
      .addTo(map.current);

    // Fit bounds to show both origin and destination
    if (origin) {
      const bounds = new maplibregl.LngLatBounds()
        .extend([origin.lng, origin.lat])
        .extend([destination.lng, destination.lat]);
      
      map.current.fitBounds(bounds, { padding: 100, duration: 1000 });
    }

  }, [destination, mapLoaded, origin]);

  // Add waypoint markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove old waypoint markers
    document.querySelectorAll('.waypoint-marker').forEach(el => el.remove());

    waypoints.forEach((wp, index) => {
      if (!wp || !wp.lat || !wp.lng) return;

      const el = document.createElement('div');
      el.className = 'waypoint-marker';
      el.style.cssText = `
        width: 26px;
        height: 26px;
        background: #ff9800;
        color: white;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      el.textContent = String(index + 1);

      new maplibregl.Marker({ element: el })
        .setLngLat([wp.lng, wp.lat])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>Stop ${index + 1}</strong><br/>${wp.name || 'Waypoint'}`))
        .addTo(map.current);
    });

  }, [waypoints, mapLoaded]);

  // Calculate and display route
  useEffect(() => {
    if (!map.current || !mapLoaded || !origin || !destination) return;

    // Remove existing route layer
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    const calculateRoute = async () => {
      try {
        setRoutingError(null);

        // Fit bounds for origin, waypoints, destination
        const bounds = new maplibregl.LngLatBounds()
          .extend([origin.lng, origin.lat])
          .extend([destination.lng, destination.lat]);
        waypoints.forEach(wp => {
          if (wp?.lat && wp?.lng) bounds.extend([wp.lng, wp.lat]);
        });
        map.current.fitBounds(bounds, { padding: 80, duration: 800 });

        if (transportMode === 'airplane') {
          // Great circle route coordinates (origin -> waypoints -> destination)
          const coords = [
            [origin.lng, origin.lat],
            ...waypoints.filter(w => w?.lat && w?.lng).map(w => [w.lng, w.lat]),
            [destination.lng, destination.lat]
          ];

          const line = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords
            }
          };

          map.current.addSource('route', {
            type: 'geojson',
            data: line
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#0288d1',
              'line-width': 3,
              'line-dasharray': [2, 2]
            }
          });

          // Calculate great circle distance across points
          let totalDist = 0;
          for (let i = 0; i < coords.length - 1; i++) {
            totalDist += calculateGreatCircleDistance(
              { lat: coords[i][1], lng: coords[i][0] },
              { lat: coords[i+1][1], lng: coords[i+1][0] }
            );
          }
          const flightHours = (totalDist / 650) + 0.5; // ~650km/h cruise + climb/descent
          setRouteData({
            distance: `${totalDist.toFixed(0)} km`,
            duration: `~${flightHours.toFixed(1)} hrs aerial flight`,
            type: 'airplane',
            note: 'Great circle direct corridor (indicative flight route)'
          });

        } else {
          // Google Directions API calculates the road route; MapLibre only renders it.
          const maps = await loadGoogleMaps();
          const service = new maps.DirectionsService();
          const result = await new Promise((resolve, reject) => {
            service.route({
              origin: { lat: origin.lat, lng: origin.lng },
              destination: { lat: destination.lat, lng: destination.lng },
              waypoints: waypoints.filter(w => w?.lat && w?.lng).map(w => ({ location: { lat: w.lat, lng: w.lng }, stopover: true })),
              travelMode: maps.TravelMode.DRIVING,
              unitSystem: maps.UnitSystem.METRIC,
            }, (response, status) => status === 'OK' ? resolve(response) : reject(new Error(`Google Directions: ${status}`)));
          });
          const route = result.routes[0];
          const coordinates = route.overview_path.map(point => [point.lng(), point.lat()]);

          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates }
            }
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': transportMode === 'luxury_car' ? '#d97706' : '#2e7d32',
              'line-width': transportMode === 'luxury_car' ? 5 : 4
            }
          });

          const totalMeters = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
          const totalSeconds = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
          const totalKm = (totalMeters / 1000).toFixed(1);
          const totalMins = Math.round(totalSeconds / 60);
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          const durationStr = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;

          setRouteData({
            distance: `${totalKm} km`,
            duration: durationStr,
            type: transportMode,
            note: transportMode === 'luxury_car'
              ? 'Luxury air-conditioned SUV / Sedan with certified chauffeur'
              : 'Calculated with Google Directions'
          });
        }

      } catch (error) {
        console.error('Routing error:', error);
        setRoutingError(error.message || 'Google route calculation unavailable. Using direct line.');
        
        // Fallback: show straight line
        const line = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [origin.lng, origin.lat],
              [destination.lng, destination.lat]
            ]
          }
        };

        if (!map.current.getSource('route')) {
          map.current.addSource('route', {
            type: 'geojson',
            data: line
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#9e9e9e',
              'line-width': 2,
              'line-dasharray': [4, 4]
            }
          });
        }
      }
    };

    calculateRoute();

  }, [origin, destination, transportMode, mapLoaded]);

  // Calculate great circle distance (haversine formula)
  const calculateGreatCircleDistance = (point1, point2) => {
    const R = 6371; // Earth radius in km
    const dLat = toRad(point2.lat - point1.lat);
    const dLon = toRad(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees) => degrees * (Math.PI / 180);

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', ...style }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Route Info Panel */}
      {routeData && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          maxWidth: '300px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Route Summary</h3>
          <div style={{ marginBottom: '8px' }}>
            <strong>Distance:</strong> {routeData.distance}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Duration:</strong> {routeData.duration}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Mode:</strong> {routeData.type === 'airplane' ? '✈️ Airplane' : routeData.type === 'luxury_car' ? '🚗 Luxury Car' : '🚗 Car'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>
            {routeData.note}
          </div>
        </div>
      )}

      {/* Routing Error */}
      {routingError && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ff9800',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          ⚠️ {routingError}
        </div>
      )}

      {/* Map Controls Help */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        Click map to set location
      </div>
    </div>
  );
}
