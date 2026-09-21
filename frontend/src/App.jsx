import { useEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import Header from './components/Header';
import Footer from './components/Footer';
import MobileNav from './components/MobileNav';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import { Toasts } from './components/ui';

import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Account from './pages/Account';
import Wishlist from './pages/Wishlist';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { useToastStore } from './store/toastStore';
import { useI18n } from './i18n';
import { replayPageEnter, startMotion } from './utils/motion';

const AUTH_ROUTES = ['/login', '/register'];

export default function App() {
  const location = useLocation();
  const mainRef = useRef(null);
  const { t, locale } = useI18n();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const loadCart = useCartStore((s) => s.load);
  const resetCart = useCartStore((s) => s.reset);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Scroll-reveal and the header's scrolled state. Started once for the whole
  // app; it watches for nodes added by later navigations itself.
  useEffect(() => startMotion(), []);

  // Every navigation replays the page-level entrance.
  useEffect(() => {
    replayPageEnter(mainRef.current);
  }, [location.pathname]);

  // Load the right cart once we know whether anyone is signed in. Re-runs on a
  // language change so cart lines carry the newly translated product names.
  useEffect(() => {
    if (status === 'ready') loadCart(Boolean(user));
  }, [status, user, loadCart, locale]);

  // The API client fires this when a refresh token is rejected.
  useEffect(() => {
    function onSignedOut() {
      useAuthStore.setState({ user: null });
      resetCart();
      useToastStore.getState().info(t('auth.sessionExpired'));
    }
    window.addEventListener('auramart:signed-out', onSignedOut);
    return () => window.removeEventListener('auramart:signed-out', onSignedOut);
  }, [resetCart, t]);

  const isAuthPage = AUTH_ROUTES.includes(location.pathname);

  return (
    <div className="app-shell">
      <ScrollToTop />
      {!isAuthPage ? <Header /> : null}

      <main className="app-main" ref={mainRef}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/checkout"
            element={<ProtectedRoute><Checkout /></ProtectedRoute>}
          />
          <Route
            path="/order-success/:orderNumber"
            element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>}
          />
          <Route
            path="/orders"
            element={<ProtectedRoute><Orders /></ProtectedRoute>}
          />
          <Route
            path="/orders/:id"
            element={<ProtectedRoute><OrderDetail /></ProtectedRoute>}
          />
          <Route
            path="/account/*"
            element={<ProtectedRoute><Account /></ProtectedRoute>}
          />
          <Route
            path="/wishlist"
            element={<ProtectedRoute><Wishlist /></ProtectedRoute>}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!isAuthPage ? <Footer /> : null}
      {!isAuthPage ? <MobileNav /> : null}
      <Toasts />
    </div>
  );
}
