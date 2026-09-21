import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi } from '../api';
import ProductCard from '../components/ProductCard';
import { Breadcrumb, EmptyState, Spinner } from '../components/ui';
import { Heart } from '../components/Icons';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';

export default function Wishlist() {
  const { t, locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const wishlist = user?.wishlist;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    userApi
      .wishlist()
      .then((res) => alive && setProducts(res.data))
      .catch(() => alive && setProducts([]))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
    // Refetch when the user toggles a heart elsewhere in the app, and when the
    // language changes so product names come back translated.
  }, [wishlist, locale]);

  return (
    <div className="container">
      <Breadcrumb items={[{ label: t('common.home'), to: '/' }, { label: t('wishlist.breadcrumb') }]} />
      <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>{t('wishlist.title')}</h1>

      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Heart size={30} />}
          title={t('wishlist.emptyTitle')}
          message={t('wishlist.emptyMessage')}
          action={<Link to="/products" className="btn btn-primary">{t('common.browseProducts')}</Link>}
        />
      ) : (
        <div className="product-grid">
          {products.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}
