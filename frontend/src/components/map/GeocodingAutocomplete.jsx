import { useState, useEffect, useRef } from 'react';
import { geocodeSearchDebounced, reverseGeocode } from '../../utils/geocoding';
import './GeocodingAutocomplete.css';

/**
 * Modern Geocoding Search Autocomplete Component
 * Supports debounced Nominatim OSM lookup, dropdown selection,
 * and single-click browser GPS Geolocation.
 */
export default function GeocodingAutocomplete({
  id = 'geocoding-input',
  label = 'Search Location',
  placeholder = 'Enter city, landmark, or address...',
  value = null,
  onSelect,
  required = false
}) {
  const [query, setQuery] = useState(value?.name || value?.displayName || '');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const wrapperRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    if (value) {
      setQuery(value.name || value.displayName || '');
    }
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setGeoError('');

    if (text.trim().length >= 3) {
      setIsSearching(true);
      setIsOpen(true);
      geocodeSearchDebounced(text.trim(), 400)
        .then((items) => {
          setResults(items || []);
        })
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    } else {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
    }
  };

  const handleSelectResult = (item) => {
    setQuery(item.name || item.displayName.split(',')[0]);
    setIsOpen(false);
    if (onSelect) {
      onSelect(item);
    }
  };

  // Browser Geolocation
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const rev = await reverseGeocode(lat, lng);
          const name = rev?.address?.city || rev?.address?.town || rev?.address?.village || 'My Current Location';
          const locationObj = {
            name,
            lat,
            lng,
            displayName: rev?.displayName || `${name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          };
          setQuery(name);
          if (onSelect) onSelect(locationObj);
        } catch {
          const fallbackObj = {
            name: 'Current Location',
            lat,
            lng,
            displayName: `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          };
          setQuery('Current Location');
          if (onSelect) onSelect(fallbackObj);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setGeoError(err.message || 'Unable to retrieve location.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="geo-auto" ref={wrapperRef}>
      {label && (
        <label htmlFor={id} className="text-label-caps geo-auto__label">
          {label} {required && <span style={{ color: 'var(--color-primary)' }}>*</span>}
        </label>
      )}

      <div className="geo-auto__input-wrap">
        <span className="material-symbols-outlined geo-auto__icon">location_on</span>
        <input
          id={id}
          type="text"
          className="geo-auto__input input-field"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          autoComplete="off"
        />

        {isSearching && (
          <div className="geo-auto__spinner" title="Searching places..." />
        )}

        <button
          type="button"
          className="geo-auto__gps-btn"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          title="Detect my current location"
          aria-label="Use my current GPS location"
        >
          {isLocating ? (
            <div className="geo-auto__gps-spinner" />
          ) : (
            <span className="material-symbols-outlined">my_location</span>
          )}
        </button>
      </div>

      {geoError && (
        <div className="geo-auto__error text-body-sm">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
          {geoError}
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <ul className="geo-auto__dropdown glass-card">
          {results.length > 0 ? (
            results.map((item, index) => (
              <li
                key={`${item.lat}-${item.lng}-${index}`}
                className="geo-auto__option"
                onClick={() => handleSelectResult(item)}
              >
                <span className="material-symbols-outlined geo-auto__opt-icon">pin_drop</span>
                <div className="geo-auto__opt-text">
                  <div className="geo-auto__opt-title text-title-sm">{item.name}</div>
                  <div className="geo-auto__opt-sub text-body-sm">{item.displayName}</div>
                </div>
              </li>
            ))
          ) : (
            !isSearching && query.length >= 3 && (
              <li className="geo-auto__no-results text-body-sm">
                No matching locations found for "{query}".
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
