// ============================================================
// TravelEase API Service Layer
// All API calls go through this file — one source of truth.
// React never calls MySQL directly.
// 
// Security features:
// - Automatic CSRF token handling for mutations
// - Credentials: include for session cookies
// 
// API URL Resolution Priority:
// 1. VITE_API_URL from .env (explicit)
// 2. Vite proxy via relative /api (dev server)
// 3. PHP built-in server on port 8000 (common dev setup)
// 4. Apache/XAMPP with /travelease/backend/api (production-like)
// ============================================================

let BASE_URL = '';

// Check if running in Vite dev server with proxy (relative /api)
const isViteDev = import.meta.env.DEV && typeof window !== 'undefined';

// Use VITE_API_URL if explicitly set
if (import.meta.env.VITE_API_URL) {
  BASE_URL = import.meta.env.VITE_API_URL;
} else if (isViteDev) {
  // In Vite dev, use relative /api which goes through vite proxy to localhost:8000
  BASE_URL = '/api';
} else {
  // Production fallback - try common setups
  BASE_URL = 'http://localhost/travelease/backend/api';
}

// Allow runtime override via window config
if (typeof window !== 'undefined' && window.__TRAVELEASE_API_BASE__) {
  BASE_URL = window.__TRAVELEASE_API_BASE__;
}

// In-memory CSRF token storage (set by auth responses)
let csrfToken = '';

/**
 * Set the CSRF token for subsequent mutation requests.
 */
export function setCsrfToken(token) {
  csrfToken = token;
}

/**
 * Get the current CSRF token.
 */
export function getCsrfToken() {
  return csrfToken;
}

/**
 * Error thrown by every failed API call. `kind` lets the UI tell the
 * failure families apart without parsing messages:
 *   network    — the request never reached the server (backend down)
 *   non_json   — server responded, but the body was not JSON (HTML error page, empty body, wrong URL)
 *   not_found  — HTTP 404 on a non-JSON body → the endpoint file/URL does not exist
 *   auth       — HTTP 401 → not logged in or session expired
 *   forbidden  — HTTP 403 → logged in, but not permitted (includes CSRF failures)
 *   server     — HTTP 5xx → PHP/database failure
 *   api        — the application itself returned a JSON error envelope
 * A 404 whose body IS a valid JSON envelope (e.g. "Booking not found.") is
 * reported as kind `api` — that is a real result, not a routing failure.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, endpoint = '', kind = 'api', detail = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.kind = kind;
    this.detail = detail; // short, safe context — never raw server internals
  }
}

/**
 * Safely extract a JSON body from a fetch Response.
 * Returns null when the body is not valid JSON (HTML error page, empty body…)
 * instead of crashing on `res.json()`.
 */
async function safeJson(res) {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Build a well-classified Error for non-JSON responses.
 * The optional body snippet is sanitized (markup stripped, truncated) so no
 * raw PHP/HTML internals or sensitive details are exposed.
 */
async function nonJsonError(res, path) {
  const status = res.status;
  const kind = status === 404 ? 'not_found' : status >= 500 ? 'server' : 'non_json';
  let snippet = '';
  try {
    snippet = (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  } catch {
    snippet = '';
  }
  const msg = status === 404
    ? `API endpoint not found (HTTP 404): ${path}`
    : `Server returned a non-JSON response (HTTP ${status}) for ${path}`;
  return new ApiError(msg, {
    status,
    endpoint: path,
    kind,
    detail: snippet ? `Response started with: "${snippet}"` : 'Empty response body',
  });
}

/**
 * Generic fetch wrapper with JSON handling and CSRF token injection.
 */
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  
  // Don't set Content-Type for FormData (browser sets it with boundary)
  const isFormData = options.body instanceof FormData;
  
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  // Add CSRF token for mutation operations (POST, PUT, DELETE)
  const method = options.method || 'GET';
  if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase()) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  let res;
  try {
    res = await fetch(url, {
      credentials: 'include', // Send session cookies for admin auth
      headers,
      ...options,
    });
  } catch (networkErr) {
    throw new ApiError(
      'Cannot reach the server. Please check your connection and that the backend is running.',
      { endpoint: path, kind: 'network', detail: String(networkErr?.message || networkErr) }
    );
  }

  const json = await safeJson(res);
  if (json === null || typeof json !== 'object') {
    // Non-JSON body: HTML Apache 404/error page, PHP fatal-error page, empty body…
    // never crash on JSON.parse, never convert into a false success.
    throw await nonJsonError(res, path);
  }

  if (json.success === false || !res.ok) {
    let kind = 'api';
    if (res.status === 401) kind = 'auth';
    else if (res.status === 403) kind = 'forbidden';
    else if (res.status >= 500) kind = 'server';
    const err = new ApiError(json.message || `Request failed (HTTP ${res.status})`, {
      status: res.status,
      endpoint: path,
      kind,
    });
    throw err;
  }

  return json.data;
}

/**
 * Shared handler for raw fetch() calls in this file (endpoints that use the
 * standard { success, data } envelope but bypass apiFetch). Never crashes on
 * non-JSON bodies; classifies 401/403/5xx like apiFetch does.
 */
async function handleEnvelope(res, fallbackMsg, path = '') {
  const json = await safeJson(res);
  if (json === null || typeof json !== 'object') {
    throw await nonJsonError(res, path || res.url);
  }
  if (!res.ok || json.success === false) {
    let kind = 'api';
    if (res.status === 401) kind = 'auth';
    else if (res.status === 403) kind = 'forbidden';
    else if (res.status >= 500) kind = 'server';
    const serverMsg = json.message || (typeof json.error === 'string' ? json.error : '');
    throw new ApiError(serverMsg || fallbackMsg || `Request failed (HTTP ${res.status})`, {
      status: res.status,
      kind,
      endpoint: path,
    });
  }
  return json;
}

// ============================================================
// PACKAGES
// ============================================================
export const packagesApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/packages/index.php${qs ? '?' + qs : ''}`);
  },
  get: (id) => apiFetch(`/packages/index.php?id=${id}`),
  search: (q) => apiFetch(`/packages/index.php?search=${encodeURIComponent(q)}`),

  // Admin CRUD
  create: (data) =>
    apiFetch('/packages/manage.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    apiFetch(`/packages/manage.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) =>
    apiFetch(`/packages/manage.php?id=${id}`, { method: 'DELETE' }),
  // Archive / restore (packages with booking history cannot be hard-deleted)
  activate: (id) =>
    apiFetch(`/packages/manage.php?id=${id}&action=activate`, { method: 'PUT' }),
  deactivate: (id) =>
    apiFetch(`/packages/manage.php?id=${id}&action=deactivate`, { method: 'PUT' }),

  // Image management
  images: {
    list: (packageId) => apiFetch(`/packages/images.php?package_id=${packageId}`),
    upload: (formData) =>
      apiFetch('/packages/images.php', { method: 'POST', body: formData }),
    delete: (imageId) =>
      apiFetch('/packages/images.php', { method: 'DELETE', body: JSON.stringify({ image_id: imageId }) }),
  },
};

// ============================================================
// BOOKINGS (Public)
// ============================================================
export const bookingsApi = {
  create: (data) =>
    apiFetch('/bookings/index.php', { method: 'POST', body: JSON.stringify(data) }),

  checkStatus: (bookingId, email) =>
    apiFetch(`/bookings/index.php?booking_id=${bookingId}&email=${encodeURIComponent(email)}`),

  // Get confirmation by token (preferred) or legacy booking_id
  getConfirmation: (tokenOrId) => {
    // Tokens are 128-char hex strings; IDs are numeric
    const isToken = tokenOrId && tokenOrId.length > 10 && isNaN(Number(tokenOrId));
    if (isToken) {
      return apiFetch(`/bookings/index.php?confirm_token=${encodeURIComponent(tokenOrId)}`);
    }
    return apiFetch(`/bookings/index.php?confirm_id=${tokenOrId}`);
  },
};

// ============================================================
// ADMIN BOOKINGS
// ============================================================
export const adminBookingsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/bookings/admin.php${qs ? '?' + qs : ''}`);
  },
  get: (id) => apiFetch(`/bookings/admin.php?id=${id}`),

  confirm: (id) =>
    apiFetch(`/bookings/admin.php?action=confirm&id=${id}`, { method: 'POST' }),
  cancel: (id) =>
    apiFetch(`/bookings/admin.php?action=cancel&id=${id}`, { method: 'POST' }),
  reject: (id, reason = '') =>
    apiFetch(`/bookings/admin.php?action=reject&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  delete: (id) =>
    apiFetch(`/bookings/admin.php?id=${id}`, { method: 'DELETE' }),
};

// ============================================================
// TOURISTS (Admin)
// ============================================================
export const touristsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/tourists/index.php${qs ? '?' + qs : ''}`);
  },
  get: (id) => apiFetch(`/tourists/index.php?id=${id}`),
  create: (data) =>
    apiFetch('/tourists/index.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    apiFetch(`/tourists/index.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) =>
    apiFetch(`/tourists/index.php?id=${id}`, { method: 'DELETE' }),
};

// ============================================================
// ADMIN AUTH (Old system - kept for backward compatibility)
// ============================================================
export const authApi = {
  login: async (identity, password) => {
    const data = await apiFetch('/auth/login.php', { 
      method: 'POST', 
      body: JSON.stringify({ identity, password }) 
    });
    // Store CSRF token from login response
    if (data.csrf_token) {
      setCsrfToken(data.csrf_token);
    }
    return data;
  },

  register: async (account) => {
    const data = await apiFetch('/auth/register.php', { method: 'POST', body: JSON.stringify(account) });
    if (data.csrf_token) setCsrfToken(data.csrf_token);
    return data;
  },

  logout: async () => {
    const data = await apiFetch('/auth/logout.php', { method: 'POST' });
    // Clear CSRF token on logout
    setCsrfToken('');
    return data;
  },

  me: async () => {
    const data = await apiFetch('/auth/me.php');
    // Store CSRF token from session check response
    if (data.csrf_token) {
      setCsrfToken(data.csrf_token);
    }
    return data;
  },
};

// ============================================================
// USER AUTHENTICATION (New unified system with themes)
// Responses use the standard envelope: { success, data }
// ============================================================
export const userAuthApi = {
  login: async (email, password) => {
    const res = await fetch(`${BASE_URL}/auth/user-login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const json = await handleEnvelope(res, 'Login failed', '/auth/user-login.php');
    // Store CSRF token so all subsequent mutations are protected
    if (json.data?.csrf_token) {
      setCsrfToken(json.data.csrf_token);
    }
    return json.data.user;
  },

  register: async (email, password, full_name, phone, theme_preference = 'default') => {
    const res = await fetch(`${BASE_URL}/auth/register.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, full_name, phone, theme_preference }),
    });
    const json = await handleEnvelope(res, 'Registration failed', '/auth/register.php');
    if (json.data?.csrf_token) {
      setCsrfToken(json.data.csrf_token);
    }
    return json.data.user;
  },

  logout: async () => {
    const res = await fetch(`${BASE_URL}/auth/user-logout.php`, {
      method: 'POST',
      credentials: 'include',
    });
    const json = await handleEnvelope(res, 'Logout failed', '/auth/user-logout.php');
    setCsrfToken(''); // session gone — token is dead
    return json;
  },

  me: async () => {
    const res = await fetch(`${BASE_URL}/auth/user-me.php`, {
      method: 'GET',
      credentials: 'include',
    });
    const json = await handleEnvelope(res, 'Not authenticated', '/auth/user-me.php');
    const data = json.data || {};
    // Refresh the in-memory CSRF token on every session check
    if (data.csrf_token) {
      setCsrfToken(data.csrf_token);
    }
    return data;
  },

  updateTheme: async (theme_preference) => {
    const res = await fetch(`${BASE_URL}/auth/update-theme.php`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ theme_preference }),
    });
    const json = await handleEnvelope(res, 'Failed to update theme', '/auth/update-theme.php');
    return json.theme_preference ?? theme_preference;
  },
};

// ============================================================
// DESTINATIONS
// ============================================================
export const destinationsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/destinations/index.php${qs ? '?' + qs : ''}`);
  },
  
  get: (id) => apiFetch(`/destinations/index.php?id=${id}`),
  
  getBySlug: (slug) => apiFetch(`/destinations/index.php?slug=${encodeURIComponent(slug)}`),
};

// ============================================================
// ADMIN USERS & PREMIUM MANAGEMENT
// ============================================================
export const adminUsersApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/users.php${qs ? '?' + qs : ''}`);
  },
  get: (id) => apiFetch(`/admin/users.php?id=${id}`),
  setActive: (id, isActive) =>
    apiFetch(`/admin/users.php?action=set_active&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ is_active: !!isActive }),
    }),
  grantPremium: (id, months = 12) =>
    apiFetch(`/admin/users.php?action=set_premium&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ months }),
    }),
  revokePremium: (id) =>
    apiFetch(`/admin/users.php?action=revoke_premium&id=${id}`, {
      method: 'POST',
    }),
};

// ============================================================
// ADMIN DASHBOARD
// ============================================================
export const dashboardApi = {
  getStats: () => apiFetch('/admin/dashboard.php'),
};

// ============================================================
// ADMIN ACTIVITY AUDIT LOG
// ============================================================
export const adminAuditApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/audit.php${qs ? '?' + qs : ''}`);
  },
};

// ============================================================
// CHATBOT — Ollama / travelease-ai via PHP proxy
// ============================================================
// The PHP endpoint returns: { "success": true, "response": "..." }
// This is NOT the same shape as the rest of the API ({success, data}),
// so we use a dedicated fetch instead of the generic apiFetch wrapper.
// The browser NEVER talks to Ollama directly (http://127.0.0.1:11434).
// ============================================================
const CHATBOT_URL =
  `${BASE_URL}/chatbot/index.php`;

export const chatbotApi = {
  /**
   * Send a user message to the PHP → Ollama proxy.
   * Returns the assistant text string on success.
   * Throws a user-friendly Error on any failure.
   *
   * @param {string} message  The user's message
   * @returns {Promise<string>} The AI response text
   */
  send: async (message) => {
    let res;
    try {
      res = await fetch(CHATBOT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message }),
        // No credentials: include — chatbot has no session auth
      });
    } catch {
      // Network failure / Apache down
      throw new Error(
        "Sorry, I'm temporarily unavailable. Please try again or contact TravelEase at 9000000000."
      );
    }

    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error(
        "Sorry, I received an unexpected response. Please try again or call 9000000000."
      );
    }

    if (!json.success) {
      // PHP returned success:false (Ollama down, model error, etc.)
      throw new Error(
        "Sorry, I'm temporarily unavailable. Please try again or contact TravelEase at 9000000000."
      );
    }

    const text = (json.data?.response ?? json.response ?? '').trim();
    if (!text) {
      throw new Error(
        "Sorry, I didn't get a response. Please try again or call 9000000000."
      );
    }

    return text;
  },
};

// ============================================================
// FOOD PLATFORM & MERCHANT (Phase 7)
// ============================================================
export const foodApi = {
  listLocations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/food/locations.php${qs ? '?' + qs : ''}`);
  },
  getLocation: (id) => apiFetch(`/food/locations.php?id=${id}`),
  submitMerchantApplication: (data) =>
    apiFetch('/food/merchant_application.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  checkApplicationStatus: (email) =>
    apiFetch(`/food/merchant_application.php?email=${encodeURIComponent(email)}`),
  merchantLogin: (email, password) =>
    apiFetch('/food/merchant_auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((data) => {
      // Store the CSRF token issued for the merchant session
      if (data?.merchant?.csrf_token || data?.csrf_token) {
        setCsrfToken(data.merchant?.csrf_token || data.csrf_token);
      }
      return data;
    }),
  merchantLogout: () =>
    apiFetch('/food/merchant_auth.php?action=logout', {
      method: 'POST',
    }).then((data) => {
      setCsrfToken('');
      return data;
    }),
  merchantMe: () => apiFetch('/food/merchant_auth.php'),
  getMerchantPortalData: () => apiFetch('/food/merchant_manage.php'),
  saveMerchantLocation: (data) =>
    apiFetch('/food/merchant_manage.php?action=save_location', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  addMenuItem: (data) =>
    apiFetch('/food/merchant_manage.php?action=add_menu_item', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteMenuItem: (menu_item_id) =>
    apiFetch('/food/merchant_manage.php?action=delete_menu_item', {
      method: 'POST',
      body: JSON.stringify({ menu_item_id }),
    }),
};

// ============================================================
// ADMIN FOOD MERCHANTS (Phase 7)
// ============================================================
export const adminFoodApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/food_merchants.php${qs ? '?' + qs : ''}`);
  },
  approve: (id, notes = '') =>
    apiFetch(`/admin/food_merchants.php?action=approve&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  reject: (id, reason = '') =>
    apiFetch(`/admin/food_merchants.php?action=reject&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  suspend: (id, notes = '') =>
    apiFetch(`/admin/food_merchants.php?action=suspend&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
};

// ============================================================
// RECOMMENDATIONS (Phase 8) - Smart Travel Assistant
// ============================================================
export const recommendationsApi = {
  getPackages: (preferences) =>
    apiFetch('/recommendations/packages.php', {
      method: 'POST',
      body: JSON.stringify(preferences),
    }),
  
  // Smart Travel Assistant with explainable scoring
  getSmartRecommendations: async (preferences) => {
    const res = await fetch(`${BASE_URL}/recommendations/smart-assistant.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(preferences),
    });
    const json = await handleEnvelope(res, 'Failed to get recommendations', '/recommendations/smart-assistant.php');
    return json.data;
  },

  // Get available interest categories
  getCategories: async () => {
    const res = await fetch(`${BASE_URL}/recommendations/categories.php`, {
      method: 'GET',
      credentials: 'include',
    });
    const json = await safeJson(res);
    if (json === null || typeof json !== 'object' || !res.ok || !json.success) {
      // Return default categories if API fails
      return [
        { category_slug: 'nature', category_name: 'Nature & Wildlife', icon: '🌿' },
        { category_slug: 'beach', category_name: 'Beach & Coastal', icon: '🏖️' },
        { category_slug: 'heritage', category_name: 'Heritage & Culture', icon: '🏛️' },
        { category_slug: 'adventure', category_name: 'Adventure & Sports', icon: '⛰️' },
        { category_slug: 'food', category_name: 'Food & Culinary', icon: '🍛' },
        { category_slug: 'wellness', category_name: 'Wellness & Spa', icon: '🧘' },
        { category_slug: 'photography', category_name: 'Photography', icon: '📸' },
        { category_slug: 'hill-station', category_name: 'Hill Station', icon: '🏔️' },
      ];
    }
    return json.data;
  },
};



// ============================================================
// PREMIUM FEATURES & ROLES
// ============================================================
export const premiumApi = {
  // Check user's premium features and role
  checkFeatures: async () => {
    const res = await fetch(`${BASE_URL}/auth/check-premium.php`, {
      method: 'GET',
      credentials: 'include',
    });
    const json = await handleEnvelope(res, 'Failed to check premium features', '/auth/check-premium.php');
    return json.data;
  },

  // Verify access to a specific feature (mutation — CSRF-protected)
  verifyFeature: async (featureName) => {
    const res = await fetch(`${BASE_URL}/auth/verify-feature.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ feature: featureName }),
    });
    const json = await handleEnvelope(res, `Access denied to feature: ${featureName}`, '/auth/verify-feature.php');
    return json.data;
  },
};

// ============================================================
// UPI QR PAYMENTS
// ============================================================
export const paymentsApi = {
  // Create UPI QR for a booking
  createQr: (bookingId) =>
    apiFetch('/payments/upi.php?action=create_qr', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId }),
    }),

  // Get payment details with QR
  getPayment: (paymentId) =>
    apiFetch(`/payments/upi.php?payment_id=${paymentId}`),

  // Submit UTR after payment
  submitUtr: (paymentId, utr) =>
    apiFetch('/payments/upi.php?action=submit_utr', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId, utr }),
    }),

  // Upload payment receipt
  uploadReceipt: (paymentId, file) => {
    const formData = new FormData();
    formData.append('payment_id', paymentId);
    formData.append('receipt', file);
    return apiFetch('/payments/upi.php?action=upload_receipt', {
      method: 'POST',
      body: formData,
    });
  },

  // Cancel payment attempt
  cancel: (paymentId) =>
    apiFetch('/payments/upi.php?action=cancel', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId }),
    }),
};

// ============================================================
// ADMIN PAYMENTS
// ============================================================
export const adminPaymentsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/payments.php${qs ? '?' + qs : ''}`);
  },

  get: (id) => apiFetch(`/admin/payments.php?id=${id}`),

  verify: (id, notes = '') =>
    apiFetch(`/admin/payments.php?action=verify&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  reject: (id, reason) =>
    apiFetch(`/admin/payments.php?action=reject&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  expire: (id) =>
    apiFetch(`/admin/payments.php?action=expire&id=${id}`, {
      method: 'POST',
    }),

  getAuditLog: (paymentId) =>
    apiFetch(`/admin/payments.php?audit=1&payment_id=${paymentId}`),
};

// ============================================================
// ADMIN UPI CONFIG
// ============================================================
export const adminUpiConfigApi = {
  get: () => apiFetch('/admin/upi_config.php'),

  update: (config) =>
    apiFetch('/admin/upi_config.php', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
};

// ============================================================
// DEMO PAYMENTS (No real gateway — for UI demonstration only)
// ============================================================
export const demoPaymentsApi = {
  /**
   * Fetch booking details for the demo checkout page.
   * Works with both confirmation_token (128-char hex) and booking_id (numeric).
   */
  getCheckout: (bookingRef) =>
    apiFetch(`/payments/demo.php?booking_ref=${encodeURIComponent(bookingRef)}`),

  /**
   * Simulate a demo payment — no real money, no UPI PIN, no gateway.
   * Marks the booking with demo_completed status (never treated as real payment).
   */
  simulate: (bookingId) =>
    apiFetch('/payments/demo.php?action=simulate', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId }),
    }),
};

