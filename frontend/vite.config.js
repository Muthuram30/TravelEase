import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ============================================================
// Vite Configuration — TravelEase
// ============================================================
//
// API Proxy: All /api/* requests are proxied to the PHP backend.
//
// SETUP OPTIONS:
// 1. XAMPP/Apache: backend at C:/xampp/htdocs/travelease/backend/ → http://localhost/travelease/backend/
// 2. PHP Built-in Server: cd backend && php -S localhost:8000 -t api → http://localhost:8000
// 3. Other: Update target below
//
// ============================================================

// Detect PHP backend target - can be overridden via env
// NOTE: for /api the target includes /api; for /storage we must proxy to the
// backend ROOT (files live in backend/storage/uploads), so keep both defined.
const BACKEND_ROOT   = process.env.VITE_PHP_BACKEND || 'http://localhost/travelease/backend';
const BACKEND_API    = `${BACKEND_ROOT}/api`;

export default defineConfig({
  plugins: [react()],
  base: '/',
  root: process.cwd(),
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    // Always use exactly this port: if it is taken (e.g. a stray dev server),
    // fail loudly instead of silently drifting to 5174 and breaking the
    // backend allow-listed CORS origin + /api proxy assumptions.
    strictPort: true,
    fs: {
      strict: false,
    },
    proxy: {
      '/api': {
        target: BACKEND_API,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[Vite Proxy] Error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Vite Proxy] Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Vite Proxy] Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/storage': {
        target: BACKEND_ROOT,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
