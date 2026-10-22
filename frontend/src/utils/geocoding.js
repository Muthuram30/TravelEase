/**
 * Geocoding adapter
 * 
 * IMPORTANT: OpenFreeMap does NOT provide geocoding.
 * This adapter allows swapping geocoding providers.
 * 
 * Current: Nominatim (OSM) - free but rate limited
 * Alternatives: Mapbox, Google Maps, LocationIQ, etc.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Geocode a search query to coordinates
 * 
 * @param {string} query - Address or place name
 * @returns {Promise<Array>} - Array of results with {name, lat, lng, displayName}
 */
export async function geocodeSearch(query) {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    const response = await fetch(
      `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      {
        headers: {
          'User-Agent': 'TravelEase/1.0' // Required by Nominatim
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }

    const data = await response.json();
    
    return data.map(result => ({
      name: result.name || result.display_name.split(',')[0],
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
      type: result.type,
      importance: result.importance
    }));

  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to address
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object|null>} - Address details or null
 */
export async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'User-Agent': 'TravelEase/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    
    return {
      displayName: data.display_name,
      address: data.address,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon)
    };

  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Debounced geocoding for autocomplete
 * 
 * @param {string} query - Search query
 * @param {number} delay - Debounce delay in ms
 * @returns {Promise<Array>} - Geocoding results
 */
let geocodeTimeout;
export function geocodeSearchDebounced(query, delay = 500) {
  return new Promise((resolve) => {
    clearTimeout(geocodeTimeout);
    geocodeTimeout = setTimeout(async () => {
      const results = await geocodeSearch(query);
      resolve(results);
    }, delay);
  });
}
