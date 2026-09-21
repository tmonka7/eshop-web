import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Spinner } from './ui';
import { useI18n } from '../i18n';

/** Sends unauthenticated visitors to /login and remembers where they came from. */
export default function ProtectedRoute({ children }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status !== 'ready') return <Spinner label={t('auth.checkingSession')} />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return children;
}
