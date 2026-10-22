import { createContext, useContext, useState, useEffect } from 'react';
import { userAuthApi } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await userAuthApi.me();
      setUser(userData);
      setError(null);
    } catch (err) {
      setUser(null);
      // Don't set error for "not authenticated" case
      if (err.message !== 'Not authenticated') {
        console.error('Auth check failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const userData = await userAuthApi.login(email, password);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (email, password, full_name, phone, theme_preference) => {
    try {
      setError(null);
      const userData = await userAuthApi.register(email, password, full_name, phone, theme_preference);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await userAuthApi.logout();
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
      // Force logout anyway
      setUser(null);
    }
  };

  const updateTheme = async (theme_preference) => {
    try {
      await userAuthApi.updateTheme(theme_preference);
      setUser(prev => ({ ...prev, theme_preference }));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        updateTheme,
        isAdmin,
        isAuthenticated,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
