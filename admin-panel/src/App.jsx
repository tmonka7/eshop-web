import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import Layout from './components/Layout';
import { Spinner, Empty } from './components/ui';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import InventoryPage from './pages/InventoryPage';
import OrdersPage from './pages/OrdersPage';
import CustomersPage from './pages/CustomersPage';
import PromotionsPage from './pages/PromotionsPage';
import ReviewsPage from './pages/ReviewsPage';
import ContentPage from './pages/ContentPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

import { useAuthStore, useToastStore } from './store';

function RequireStaff({ children }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status !== 'ready') return <Spinner label="Checking your session..." />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    function onSignedOut() {
      useAuthStore.setState({ user: null });
      useToastStore.getState().info('Your session expired. Please sign in again.');
    }
    window.addEventListener('auramart:admin-signed-out', onSignedOut);
    return () => window.removeEventListener('auramart:admin-signed-out', onSignedOut);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireStaff>
            <Layout />
          </RequireStaff>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Empty title="404 — Page not found" message="That admin page does not exist." />} />
      </Route>
    </Routes>
  );
}
