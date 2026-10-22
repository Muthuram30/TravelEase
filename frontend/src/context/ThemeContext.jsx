import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { THEMES, THEME_LABELS, resolveDestinationTheme, applyTheme } from '../utils/theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Default to 'default' theme (Ocean Blue) - only change on confirmed booking
    return localStorage.getItem('travelease_theme') || THEMES.DEFAULT;
  });
  const [isAuto, setIsAuto] = useState(() => {
    // Auto mode ON by default - theme follows destination only after booking
    return localStorage.getItem('travelease_theme_auto') !== 'false';
  });
  const [activeMood, setActiveMood] = useState(null);
  const [userThemePreference, setUserThemePreference] = useState(null);

  // Apply theme to DOM
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Booking is the only event allowed to change a user's visual theme.
  const setUserPreference = useCallback((preference) => {
    setUserThemePreference(preference);
  }, []);

  // Called internally after a confirmed booking; not exposed in the interface.
  const applyBookingTheme = useCallback((themeName) => {
    setIsAuto(false);
    setCurrentTheme(themeName);
    localStorage.setItem('travelease_theme', themeName);
    localStorage.setItem('travelease_theme_auto', 'false');
  }, []);

  // Only booking flows call this; browsing must not alter the site's default theme.
  const applyBookingDestination = useCallback((destOrPkg) => {
    const resolved = resolveDestinationTheme(destOrPkg, activeMood);
    setCurrentTheme(resolved);
    localStorage.setItem('travelease_theme', resolved);
  }, [activeMood]);

  // Reset to auto mode
  const setAutoMode = useCallback(() => {
    setIsAuto(true);
    localStorage.setItem('travelease_theme_auto', 'true');
  }, []);

  // Set mood (e.g. 'sunset' or null)
  const setMood = useCallback((mood) => {
    setActiveMood(mood);
  }, []);

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      themeLabel: THEME_LABELS[currentTheme] || 'Default',
      isAuto,
      activeMood,
      userThemePreference,
      applyBookingTheme,
      applyBookingDestination,
      setAutoMode,
      setMood,
      setUserPreference,
      availableThemes: THEMES
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      currentTheme: THEMES.DEFAULT,
      themeLabel: 'Ocean Blue',
      isAuto: true,
      activeMood: null,
      userThemePreference: null,
      applyBookingTheme: () => {},
      applyBookingDestination: () => {},
      setAutoMode: () => {},
      setMood: () => {},
      setUserPreference: () => {},
      availableThemes: THEMES
    };
  }
  return context;
}
