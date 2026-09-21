import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { Search } from '../components/Icons';
import { useI18n } from '../i18n';

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="container">
      <EmptyState
        icon={<Search size={30} />}
        title={t('notFound.title')}
        message={t('notFound.message')}
        action={<Link to="/" className="btn btn-primary btn-lg">{t('notFound.backHome')}</Link>}
      />
    </div>
  );
}
