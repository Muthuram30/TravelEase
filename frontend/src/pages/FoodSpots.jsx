import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import * as maplibregl from '../utils/maplibreSetup';
import 'maplibre-gl/dist/maplibre-gl.css';
import { foodApi, setCsrfToken } from '../api/api';
import { INTEREST_IMAGES } from '../utils/destinationImages';
import './FoodSpots.css';

const CUISINES = ['All', 'Kerala Coastal', 'Malabar Traditional', 'Goan Seafood', 'Rajasthani Thali', 'Himachali Cuisine', 'Mughlai & Heritage'];
const CITIES = ['All', 'Munnar', 'Alappuzha', 'Kochi', 'Panaji', 'Manali', 'Jaisalmer', 'Delhi'];

export default function FoodSpots() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Determine active tab from URL path
  const determineMerchantPath = () => {
    const path = location.pathname;
    if (path.startsWith('/merchant/login')) return 'login';
    if (path.startsWith('/merchant/register')) return 'register';
    if (path.startsWith('/merchant/dashboard') || path.startsWith('/merchant')) return 'dashboard';
    if (path.startsWith('/food/') && routeId) return 'detail';
    return 'explore';
  };

  const [activeTab, setActiveTab] = useState(determineMerchantPath()); // 'explore' | 'detail' | 'login' | 'register' | 'dashboard'
  const [exploreView, setExploreView] = useState('grid'); // 'grid' | 'map'
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [activeModalLoc, setActiveModalLoc] = useState(null);

  // Detail view state
  const [detailLocation, setDetailLocation] = useState(null);

  // Merchant Portal State
  const [merchantAuthTab, setMerchantAuthTab] = useState('login'); // 'login' | 'register'
  const [merchantUser, setMerchantUser] = useState(null);
  const [merchantData, setMerchantData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Login Form State
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loggingIn, setLoggingIn] = useState(false);

  // Merchant Application Form State
  const [merchantForm, setMerchantForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    city: 'Kochi',
    cuisine_type: 'Kerala Coastal',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Update active tab when URL changes
  useEffect(() => {
    const newTab = determineMerchantPath();
    setActiveTab(newTab);
    
    // Load detail if viewing specific food spot
    if (newTab === 'detail' && routeId) {
      loadDetailLocation(routeId);
    }
  }, [location.pathname, routeId]);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({
    item_name: '',
    description: '',
    price: '',
    category: 'main_course',
    is_vegetarian: true
  });
  const [menuSubmitting, setMenuSubmitting] = useState(false);
  const [portalMessage, setPortalMessage] = useState('');

  // Map container reference
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  // Sync tab with URL / route (/merchant, /food, ?tab=merchant)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'merchant' || location.pathname.startsWith('/merchant')) {
      setActiveTab('merchant');
      if (location.pathname === '/merchant/register') {
        setMerchantAuthTab('register');
      } else if (location.pathname === '/merchant/login') {
        setMerchantAuthTab('login');
      }
    } else if (tabParam === 'explore' || location.pathname.startsWith('/food')) {
      setActiveTab('explore');
    }
  }, [location.pathname, searchParams]);

  // Deep link to a specific food spot modal (?spot=:id or /food/:id or /food-spots/:id)
  useEffect(() => {
    const spotId = routeId || searchParams.get('spot');
    if (spotId && locations.length > 0) {
      const found = locations.find((l) => String(l.location_id) === String(spotId));
      if (found) {
        setActiveModalLoc(found);
      } else {
        foodApi.getLocation(spotId)
          .then((data) => setActiveModalLoc(data))
          .catch(() => {});
      }
    }
  }, [routeId, searchParams, locations]);

  const handleCloseModal = () => {
    setActiveModalLoc(null);
    if (routeId) {
      navigate('/food-spots', { replace: true });
    } else if (searchParams.has('spot')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('spot');
      setSearchParams(nextParams, { replace: true });
    }
  };

  // Check merchant session on mount
  useEffect(() => {
    foodApi.merchantMe()
      .then((data) => {
        // Refresh CSRF token from the merchant session check
        if (data?.merchant?.csrf_token || data?.csrf_token) {
          setCsrfToken(data.merchant?.csrf_token || data.csrf_token);
        }
        setMerchantUser(data);
        loadMerchantPortal();
      })
      .catch(() => setMerchantUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const loadMerchantPortal = () => {
    foodApi.getMerchantPortalData()
      .then(setMerchantData)
      .catch(() => {});
  };

  // Fetch approved food spots
  useEffect(() => {
    setLoading(true);
    const params = {};
    if (selectedCity !== 'All') params.city = selectedCity;
    if (selectedCuisine !== 'All') params.cuisine = selectedCuisine;

    foodApi.listLocations(params)
      .then((data) => {
        setLocations(Array.isArray(data) ? data : (data.locations || []));
      })
      .catch(() => {
        setLocations([]);
      })
      .finally(() => setLoading(false));
  }, [selectedCity, selectedCuisine]);

  // Render MapLibre for Food Spots in Map View
  useEffect(() => {
    if (activeTab !== 'explore' || exploreView !== 'map' || !mapContainer.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [78.9629, 20.5937],
      zoom: 4.5,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Add markers
      const validLocs = locations.filter(l => l.latitude && l.longitude);
      if (validLocs.length > 0) {
        const bounds = new maplibregl.LngLatBounds();

        validLocs.forEach((loc) => {
          const lat = parseFloat(loc.latitude);
          const lng = parseFloat(loc.longitude);
          bounds.extend([lng, lat]);

          const el = document.createElement('div');
          el.className = 'food-map-pin';
          el.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; color: white;">restaurant</span>';
          el.style.cssText = `
            width: 32px;
            height: 32px;
            background: #d97706;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            cursor: pointer;
          `;

          el.addEventListener('click', () => {
            setActiveModalLoc(loc);
          });

          new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(`
                <div style="font-family: sans-serif; padding: 4px;">
                  <strong style="font-size: 14px;">${loc.venue_name}</strong>
                  <div style="font-size: 11px; color: #666; margin: 2px 0;">${loc.cuisine_type} • ${loc.city}</div>
                  <div style="font-size: 11px; color: #2e7d32;">Verified Partner</div>
                </div>
              `)
            )
            .addTo(map);
        });

        map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeTab, exploreView, locations]);

  // Merchant Login
  const handleMerchantLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setAuthError('');
    try {
      const res = await foodApi.merchantLogin(loginForm.email, loginForm.password);
      setMerchantUser(res.merchant);
      loadMerchantPortal();
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Merchant Logout
  const handleMerchantLogout = async () => {
    await foodApi.merchantLogout().catch(() => {});
    setMerchantUser(null);
    setMerchantData(null);
  };

  // Merchant Registration
  const handleMerchantSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      await foodApi.submitMerchantApplication(merchantForm);
      setSubmitSuccess(true);
      setMerchantForm({
        business_name: '',
        owner_name: '',
        email: '',
        phone: '',
        password: '',
        city: 'Kochi',
        cuisine_type: 'Kerala Coastal',
        description: ''
      });
    } catch (err) {
      setSubmitError(err.message || 'Application submission failed. Please check inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Menu Item
  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!merchantData?.locations?.[0]?.location_id) return;
    setMenuSubmitting(true);
    try {
      await foodApi.addMenuItem({
        location_id: merchantData.locations[0].location_id,
        item_name: menuForm.item_name,
        description: menuForm.description,
        price: parseFloat(menuForm.price),
        category: menuForm.category,
        is_vegetarian: menuForm.is_vegetarian
      });
      setShowAddMenuModal(false);
      setMenuForm({ item_name: '', description: '', price: '', category: 'main_course', is_vegetarian: true });
      loadMerchantPortal();
      setPortalMessage('Menu item added successfully!');
      setTimeout(() => setPortalMessage(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to add menu item');
    } finally {
      setMenuSubmitting(false);
    }
  };

  // Delete Menu Item
  const handleDeleteMenuItem = async (id) => {
    if (!confirm('Are you sure you want to remove this menu item?')) return;
    try {
      await foodApi.deleteMenuItem(id);
      loadMerchantPortal();
      setPortalMessage('Menu item deleted.');
      setTimeout(() => setPortalMessage(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to delete menu item');
    }
  };

  return (
    <div className="foodspots-page">
      {/* Header Banner */}
      <section className="foodspots-hero">
        <div className="container foodspots-hero__content">
          <span className="text-label-caps foodspots-hero__badge">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restaurant</span>
            TravelEase Culinary Network
          </span>
          <h1 className="text-headline-lg">Contracted Regional Food Spots</h1>
          <p className="text-body-lg" style={{ maxWidth: '640px', margin: '0 auto' }}>
            Handpicked, certified dining partners serving authentic regional cuisines across India. Every venue is legally contracted and hygiene-inspected.
          </p>

          <div className="foodspots-nav-tabs">
            <button
              type="button"
              className={`foodspots-nav-tab ${activeTab === 'explore' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('explore');
                const next = new URLSearchParams(searchParams);
                next.set('tab', 'explore');
                setSearchParams(next, { replace: true });
              }}
            >
              <span className="material-symbols-outlined">storefront</span>
              Explore Approved Spots
            </button>
            <button
              type="button"
              className={`foodspots-nav-tab ${activeTab === 'merchant' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('merchant');
                const next = new URLSearchParams(searchParams);
                next.set('tab', 'merchant');
                setSearchParams(next, { replace: true });
              }}
            >
              <span className="material-symbols-outlined">handshake</span>
              {merchantUser ? `Merchant Portal (${merchantUser.business_name})` : 'Merchant Portal & Enrollment'}
            </button>
          </div>
        </div>
      </section>

      {/* Tab 1: Food Discovery */}
      {activeTab === 'explore' && (
        <section className="container foodspots-container">
          {/* Filters Bar & View Switcher */}
          <div className="foodspots-filters glass-card">
            <div className="foodspots-filter-group">
              <label htmlFor="city-select" className="text-label-caps">Destination City</label>
              <select
                id="city-select"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="foodspots-select"
              >
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="foodspots-filter-group">
              <label htmlFor="cuisine-select" className="text-label-caps">Regional Cuisine</label>
              <select
                id="cuisine-select"
                value={selectedCuisine}
                onChange={(e) => setSelectedCuisine(e.target.value)}
                className="foodspots-select"
              >
                {CUISINES.map((cu) => <option key={cu} value={cu}>{cu}</option>)}
              </select>
            </div>

            {/* View Switcher */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', marginLeft: 'auto' }}>
              <button
                type="button"
                className={`btn btn-sm ${exploreView === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExploreView('grid')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
                List
              </button>
              <button
                type="button"
                className={`btn btn-sm ${exploreView === 'map' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExploreView('map')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>map</span>
                Map View
              </button>
            </div>
          </div>

          {/* Map View */}
          {exploreView === 'map' && (
            <div style={{ height: '540px', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '2rem', border: '1px solid var(--color-outline-variant)' }}>
              <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
            </div>
          )}

          {/* Listings Grid */}
          {exploreView === 'grid' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div className="text-body-lg">Loading verified culinary partners...</div>
              </div>
            ) : locations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <p className="text-body-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
                  No contracted food spots found matching this filter.
                </p>
              </div>
            ) : (
              <div className="foodspots-grid">
                {locations.map((loc) => {
                  const cover = loc.images?.[0]?.image_url || INTEREST_IMAGES.food;
                  return (
                    <div
                      key={loc.location_id}
                      className="foodspot-card glass-card"
                      onClick={() => {
                        setActiveModalLoc(loc);
                        const next = new URLSearchParams(searchParams);
                        next.set('spot', loc.location_id);
                        setSearchParams(next, { replace: true });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ height: '180px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative', marginBottom: '12px' }}>
                        <img src={cover} alt={loc.venue_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        <span className="foodspot-card__cuisine-badge text-label-caps">{loc.cuisine_type}</span>
                        <span className="foodspot-card__price-badge">{loc.price_range || '$$'}</span>
                      </div>

                      <div className="foodspot-card__header">
                        <div>
                          <h3 className="foodspot-card__title text-headline-sm">{loc.venue_name}</h3>
                          <div className="foodspot-card__loc text-body-sm">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>location_on</span>
                            {loc.city}, {loc.state}
                          </div>
                        </div>
                      </div>

                      <p className="foodspot-card__desc text-body-sm">{loc.description}</p>

                      {/* Menu preview pills */}
                      {loc.menu_items && loc.menu_items.length > 0 && (
                        <div style={{ margin: '8px 0', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {loc.menu_items.slice(0, 3).map((item, idx) => (
                            <span key={idx} className="text-label-sm" style={{ background: 'var(--color-surface-container)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', opacity: 0.85 }}>
                              {item.is_vegetarian ? '🟢' : '🔴'} {item.item_name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="foodspot-card__amenities">
                        {loc.is_vegetarian_only && (
                          <span className="foodspot-tag veg">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>eco</span> Pure Veg
                          </span>
                        )}
                        {loc.has_parking && (
                          <span className="foodspot-tag">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>local_parking</span> Parking
                          </span>
                        )}
                        {loc.has_wifi && (
                          <span className="foodspot-tag">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>wifi</span> Wi-Fi
                          </span>
                        )}
                      </div>

                      <div className="foodspot-card__footer" style={{ marginTop: 'auto', paddingTop: '10px' }}>
                        <button type="button" className="btn btn-primary btn-sm btn-pill" style={{ width: '100%', justifyContent: 'center' }}>
                          View Menu & Location
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </section>
      )}

      {/* Tab 2: Merchant Enrollment & Portal */}
      {activeTab === 'merchant' && (
        <section className="container foodspots-container" style={{ maxWidth: '900px' }}>
          {portalMessage && (
            <div className="foodspots-alert success" style={{ marginBottom: '1.5rem' }}>
              <span className="material-symbols-outlined">check_circle</span>
              <span>{portalMessage}</span>
            </div>
          )}

          {/* Case 1: Merchant Logged In */}
          {merchantUser ? (
            <div className="merchant-dashboard glass-card" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <span className="text-label-caps" style={{ color: 'var(--color-primary)' }}>Merchant Partner Dashboard</span>
                  <h2 className="text-headline-md" style={{ margin: '4px 0' }}>{merchantUser.business_name}</h2>
                  <div className="text-body-sm" style={{ opacity: 0.8 }}>
                    Proprietor: {merchantUser.owner_name} • {merchantUser.email}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`badge badge-${merchantUser.status === 'approved' ? 'confirmed' : merchantUser.status === 'pending' ? 'pending' : 'rejected'}`}>
                    Status: {merchantUser.status?.toUpperCase()}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleMerchantLogout}>
                    <span className="material-symbols-outlined">logout</span>
                    Logout
                  </button>
                </div>
              </div>

              {merchantUser.status === 'pending' && (
                <div className="foodspots-alert" style={{ background: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308', marginBottom: '1.5rem' }}>
                  <span className="material-symbols-outlined" style={{ color: '#ca8a04' }}>hourglass_top</span>
                  <div>
                    <strong>Verification Pending</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
                      Your partnership application is currently being verified by TravelEase quality & hygiene inspectors. Once approved, your venue and menu will automatically be visible to travelers.
                    </p>
                  </div>
                </div>
              )}

              {/* Venue & Menu Items Manager */}
              {merchantData?.locations?.[0] ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <h3 className="text-title-md">{merchantData.locations[0].venue_name}</h3>
                      <div className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        📍 {merchantData.locations[0].address}, {merchantData.locations[0].city}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAddMenuModal(true)}
                    >
                      <span className="material-symbols-outlined">add</span>
                      Add Menu Item
                    </button>
                  </div>

                  {/* Menu Table */}
                  <div style={{ overflowX: 'auto', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Dish Name</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th>Description</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(merchantData.locations[0].menu_items || []).map((item) => (
                          <tr key={item.menu_item_id}>
                            <td>{item.is_vegetarian ? '🟢 Veg' : '🔴 Non-Veg'}</td>
                            <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                            <td><span className="badge">{item.category}</span></td>
                            <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>₹{item.price}</td>
                            <td style={{ fontSize: '12px', maxWidth: '240px' }}>{item.description || '—'}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteMenuItem(item.menu_item_id)}
                                title="Remove item"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p className="text-body-md">No venue profile registered yet.</p>
                </div>
              )}
            </div>
          ) : (
            /* Case 2: Not Logged In -> Login vs Register */
            <div className="glass-card" style={{ padding: 'var(--space-xl)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '2rem' }}>
                <button
                  type="button"
                  className={`btn ${merchantAuthTab === 'login' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMerchantAuthTab('login')}
                >
                  <span className="material-symbols-outlined">login</span>
                  Merchant Login
                </button>
                <button
                  type="button"
                  className={`btn ${merchantAuthTab === 'register' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMerchantAuthTab('register')}
                >
                  <span className="material-symbols-outlined">how_to_reg</span>
                  Enroll Restaurant
                </button>
              </div>

              {/* Sub-tab: Login */}
              {merchantAuthTab === 'login' && (
                <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h2 className="text-headline-md">Partner Merchant Login</h2>
                    <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Access your restaurant dashboard, update menus, and view live bookings.
                    </p>
                  </div>

                  {authError && (
                    <div className="foodspots-alert error" style={{ marginBottom: '1rem' }}>
                      <span className="material-symbols-outlined">error</span>
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleMerchantLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="merchant-field">
                      <label className="text-label-sm">Merchant Email</label>
                      <input
                        type="email"
                        required
                        placeholder="contact@restaurant.com"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div className="merchant-field">
                      <label className="text-label-sm">Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loggingIn} style={{ width: '100%', justifyContent: 'center' }}>
                      {loggingIn ? 'Authenticating...' : 'Sign In to Portal'}
                    </button>
                  </form>
                </div>
              )}

              {/* Sub-tab: Registration */}
              {merchantAuthTab === 'register' && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h2 className="text-headline-md">Enroll Your Restaurant or Food Experience</h2>
                    <p className="text-body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Join India's curated tourism dining network. Applications are reviewed within 48 hours.
                    </p>
                  </div>

                  {submitSuccess && (
                    <div className="foodspots-alert success" style={{ marginBottom: '1.5rem' }}>
                      <span className="material-symbols-outlined">check_circle</span>
                      <div>
                        <strong>Application Submitted Successfully!</strong>
                        <p style={{ margin: '4px 0 0' }}>Our compliance team will review your business credentials.</p>
                      </div>
                    </div>
                  )}

                  {submitError && (
                    <div className="foodspots-alert error" style={{ marginBottom: '1.5rem' }}>
                      <span className="material-symbols-outlined">error</span>
                      <span>{submitError}</span>
                    </div>
                  )}

                  <form onSubmit={handleMerchantSubmit} className="merchant-form">
                    <div className="merchant-form-row">
                      <div className="merchant-field">
                        <label className="text-label-sm">Business / Restaurant Legal Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Fort Kochi Coastal Kitchen"
                          value={merchantForm.business_name}
                          onChange={(e) => setMerchantForm({ ...merchantForm, business_name: e.target.value })}
                        />
                      </div>
                      <div className="merchant-field">
                        <label className="text-label-sm">Primary Proprietor / Manager Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={merchantForm.owner_name}
                          onChange={(e) => setMerchantForm({ ...merchantForm, owner_name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="merchant-form-row">
                      <div className="merchant-field">
                        <label className="text-label-sm">Official Contact Email *</label>
                        <input
                          type="email"
                          required
                          placeholder="contact@business.com"
                          value={merchantForm.email}
                          onChange={(e) => setMerchantForm({ ...merchantForm, email: e.target.value })}
                        />
                      </div>
                      <div className="merchant-field">
                        <label className="text-label-sm">Contact Phone / Mobile *</label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9876543210"
                          value={merchantForm.phone}
                          onChange={(e) => setMerchantForm({ ...merchantForm, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="merchant-form-row">
                      <div className="merchant-field">
                        <label className="text-label-sm">City / Destination</label>
                        <select
                          value={merchantForm.city}
                          onChange={(e) => setMerchantForm({ ...merchantForm, city: e.target.value })}
                        >
                          {CITIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="merchant-field">
                        <label className="text-label-sm">Primary Regional Cuisine</label>
                        <select
                          value={merchantForm.cuisine_type}
                          onChange={(e) => setMerchantForm({ ...merchantForm, cuisine_type: e.target.value })}
                        >
                          {CUISINES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="merchant-field">
                      <label className="text-label-sm">Account Password (min 8 chars) *</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Create secure portal password"
                        value={merchantForm.password}
                        onChange={(e) => setMerchantForm({ ...merchantForm, password: e.target.value })}
                      />
                    </div>

                    <div className="merchant-field">
                      <label className="text-label-sm">Cuisine & Heritage Description</label>
                      <textarea
                        rows={3}
                        placeholder="Specialties, traditional cooking methods, and history..."
                        value={merchantForm.description}
                        onChange={(e) => setMerchantForm({ ...merchantForm, description: e.target.value })}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting Application...' : 'Submit Merchant Application'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Modal 1: Public Food Spot Detail Modal */}
      {activeModalLoc && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <span className="text-label-caps" style={{ color: 'var(--color-primary)' }}>{activeModalLoc.cuisine_type}</span>
                <h2 className="text-headline-sm" style={{ margin: '2px 0 0' }}>{activeModalLoc.venue_name}</h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCloseModal}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-body-sm" style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{activeModalLoc.description}</p>
            <div className="text-body-sm" style={{ marginBottom: '1.25rem', opacity: 0.85 }}>
              📍 <strong>Address:</strong> {activeModalLoc.address}, {activeModalLoc.city}, {activeModalLoc.state}
            </div>

            {/* Menu Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 className="text-title-md" style={{ marginBottom: '0.75rem' }}>Signature Menu</h3>
              {activeModalLoc.menu_items && activeModalLoc.menu_items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeModalLoc.menu_items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--color-surface-container)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px' }}>{item.is_vegetarian ? '🟢' : '🔴'}</span>
                          <strong style={{ fontSize: '14px' }}>{item.item_name}</strong>
                          <span className="badge" style={{ fontSize: '10px' }}>{item.category}</span>
                        </div>
                        {item.description && (
                          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '15px' }}>
                        ₹{item.price}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm" style={{ opacity: 0.7 }}>Seasonal menu available on site.</p>
              )}
            </div>

            {/* Operating Hours */}
            {activeModalLoc.hours && activeModalLoc.hours.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 className="text-title-md" style={{ marginBottom: '0.5rem' }}>Operating Hours</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', fontSize: '12px' }}>
                  {activeModalLoc.hours.slice(0, 7).map((h, i) => (
                    <div key={i} style={{ padding: '6px 8px', background: 'var(--color-surface-container)', borderRadius: 'var(--radius-sm)' }}>
                      <strong style={{ textTransform: 'capitalize' }}>{h.day_of_week.slice(0, 3)}:</strong>{' '}
                      {h.is_closed ? 'Closed' : `${h.open_time.slice(0, 5)} - ${h.close_time.slice(0, 5)}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigate(`/route-planner?destination=${encodeURIComponent(activeModalLoc.city)}`);
                }}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined">directions</span>
                Get Directions
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  navigate(`/packages?destination=${encodeURIComponent(activeModalLoc.city)}`);
                }}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined">luggage</span>
                Explore City Packages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add Menu Item Modal (Merchant) */}
      {showAddMenuModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddMenuModal(false)}>
          <div className="modal-box" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 className="text-headline-sm">Add New Menu Item</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddMenuModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMenuItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="merchant-field">
                <label className="text-label-sm">Dish / Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Claypot Fish Curry"
                  value={menuForm.item_name}
                  onChange={(e) => setMenuForm({ ...menuForm, item_name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="merchant-field">
                <label className="text-label-sm">Price (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="e.g. 350"
                  value={menuForm.price}
                  onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="merchant-field">
                <label className="text-label-sm">Course Category</label>
                <select
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  className="foodspots-select"
                >
                  <option value="appetizer">Appetizer</option>
                  <option value="main_course">Main Course</option>
                  <option value="special">Chef Special</option>
                  <option value="dessert">Dessert</option>
                  <option value="beverage">Beverage</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="is-veg-check"
                  checked={menuForm.is_vegetarian}
                  onChange={(e) => setMenuForm({ ...menuForm, is_vegetarian: e.target.checked })}
                />
                <label htmlFor="is-veg-check" className="text-body-sm">Pure Vegetarian Dish</label>
              </div>

              <div className="merchant-field">
                <label className="text-label-sm">Description & Ingredients</label>
                <textarea
                  rows={2}
                  placeholder="Key spices, heritage background..."
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddMenuModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={menuSubmitting}>
                  {menuSubmitting ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
