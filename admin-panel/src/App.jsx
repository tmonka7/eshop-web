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
import AdministratorsPage from './pages/AdministratorsPage';

import { useAuthStore, useToastStore } from './store';
import { useI18n } from './i18n';

function RequireStaff({ children }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status !== 'ready') return <Spinner label={t('toast.checkingSession')} />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const { t } = useI18n();
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
        <Route path="administrators" element={<AdministratorsPage />} />
        <Route
          path="*"
          element={<Empty title={t('toast.notFoundTitle')} message={t('toast.notFoundMessage')} />}
        />
      </Route>
    </Routes>
  );
}
