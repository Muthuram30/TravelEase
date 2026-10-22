import { Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import Home from './pages/Home';
import Packages from './pages/Packages';
import PackageDetails from './pages/PackageDetails';
import Book from './pages/Book';
import Checkout from './pages/Checkout';
import BookingConfirmation from './pages/BookingConfirmation';
import BookingStatus from './pages/BookingStatus';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Explore from './pages/Explore';
import FoodSpots from './pages/FoodSpots';
import Contact from './pages/Contact';
import RoutePlanner from './pages/RoutePlanner';
import Recommendations from './pages/Recommendations';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Upgrade from './pages/Upgrade';
import './styles/design-system.css';
import './App.css';

// Pages that don't use the public Header/Footer/Chatbot layout
const ADMIN_PATHS = ['/admin'];
const AUTH_PATHS = ['/login', '/signup'];

function Layout({ children }) {
  const location = useLocation();
  const isAdmin  = ADMIN_PATHS.some((p) => location.pathname.startsWith(p));
  const isAuth = AUTH_PATHS.some((p) => location.pathname.startsWith(p));

  if (isAdmin || isAuth) return <>{children}</>;

  return (
    <>
      <Header />
      <main style={{ minHeight: '100vh', paddingTop: 'var(--nav-height)' }}>
        {children}
      </main>
      <Footer />
      <Chatbot />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Layout>
        <Routes>
          {/* Auth routes */}
          <Route path="/login"                     element={<Login />} />
          <Route path="/signup"                    element={<Signup />} />
          <Route path="/upgrade"                   element={<Upgrade />} />

          {/* Public routes */}
          <Route path="/"                         element={<Home />} />
          <Route path="/explore"                   element={<Explore />} />
          <Route path="/packages"                  element={<Packages />} />
          <Route path="/packages/:id"              element={<PackageDetails />} />
          <Route path="/route-planner"             element={<RoutePlanner />} />
          <Route path="/food-spots"                element={<FoodSpots />} />
          <Route path="/food-spots/:id"            element={<FoodSpots />} />
          <Route path="/food"                      element={<FoodSpots />} />
          <Route path="/food/:id"                  element={<FoodSpots />} />
          <Route path="/merchant"                  element={<FoodSpots />} />
          <Route path="/merchant/login"            element={<FoodSpots />} />
          <Route path="/merchant/register"         element={<FoodSpots />} />
          <Route path="/merchant/dashboard"        element={<FoodSpots />} />
          <Route path="/recommendations"           element={<Recommendations />} />
          <Route path="/book"                      element={<ProtectedRoute><Book /></ProtectedRoute>} />
          <Route path="/book/:packageId"           element={<ProtectedRoute><Book /></ProtectedRoute>} />
          <Route path="/checkout/:id"              element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/booking-confirmation/:id"  element={<BookingConfirmation />} />
          <Route path="/booking-status"            element={<BookingStatus />} />
          <Route path="/contact"                   element={<Contact />} />

          {/* Admin routes (no public header) - Protected */}
          <Route path="/admin/login"               element={<AdminLogin />} />
          <Route path="/admin/dashboard"           element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin"                     element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </Layout>
    </AuthProvider>
  </ThemeProvider>
  );
}
