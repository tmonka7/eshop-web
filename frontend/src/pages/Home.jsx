import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard';
import { SkeletonGrid } from '../components/ui';
import { Truck, Headset, Shield, Refresh, Zap, Tag } from '../components/Icons';
import { currency, imageUrl } from '../utils/format';
import { useI18n } from '../i18n';

const features = [
  { icon: <Truck size={18} />, titleKey: 'home.features.shippingTitle', textKey: 'home.features.shippingText' },
  { icon: <Headset size={18} />, titleKey: 'home.features.supportTitle', textKey: 'home.features.supportText' },
  { icon: <Shield size={18} />, titleKey: 'home.features.paymentTitle', textKey: 'home.features.paymentText' },
  { icon: <Refresh size={18} />, titleKey: 'home.features.returnsTitle', textKey: 'home.features.returnsText' },
];

export default function Home() {
  const { t, locale } = useI18n();
  const [state, setState] = useState({
    banners: [],
    categories: [],
    featured: [],
    bestSellers: [],
    promotions: [],
    loading: true,
  });

  useEffect(() => {
    let alive = true;

    Promise.all([
      catalogApi.banners('hero').catch(() => ({ data: [] })),
      catalogApi.categories({ parent: 'root', withCounts: true }).catch(() => ({ data: [] })),
      catalogApi.featured(10).catch(() => ({ data: [] })),
      catalogApi.bestSellers(10).catch(() => ({ data: [] })),
      catalogApi.promotions().catch(() => ({ data: [] })),
    ]).then(([banners, categories, featured, bestSellers, promotions]) => {
      if (!alive) return;
      setState({
        banners: banners.data,
        categories: categories.data,
        featured: featured.data,
        bestSellers: bestSellers.data,
        promotions: promotions.data,
        loading: false,
      });
    });

    return () => {
      alive = false;
    };
    // Refetch on a language change so banners and category names come back
    // translated by the API.
  }, [locale]);

  const hero = state.banners[0];

  return (
    <div className="container">
      <section className="hero">
        <div>
          <span className="badge badge-danger mb-16">{t('home.newSeason')}</span>
          <h1>{hero?.title || t('home.heroTitle')}</h1>
          <p>{hero?.subtitle || t('home.heroSubtitle')}</p>
          <div className="row gap-12 mt-24">
            <Link to={hero?.ctaLink || '/products'} className="btn btn-primary btn-lg">
              {hero?.ctaText || t('home.shopNow')}
            </Link>
            <Link to="/products?sort=newest" className="btn btn-outline btn-lg">
              {t('home.newArrivals')}
            </Link>
          </div>
        </div>
        <div className="hero-art">
          {hero?.image ? <img src={imageUrl(hero.image)} alt="" /> : null}
        </div>
      </section>

      <div className="feature-strip">
        {features.map((f) => (
          <div key={f.titleKey} className="feature-item">
            <span className="feature-icon">{f.icon}</span>
            <div>
              <h4>{t(f.titleKey)}</h4>
              <p>{t(f.textKey, { amount: currency(50) })}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>{t('home.shopByCategory')}</h2>
            <p className="muted small">{t('home.shopByCategorySub')}</p>
          </div>
          <Link to="/products" className="link">{t('common.seeAll')}</Link>
        </div>

        <div className="category-rail">
          {state.categories.map((c) => (
            <Link key={c._id} to={`/products?category=${c.slug}`} className="category-chip">
              <img className="avatar" src={imageUrl(c.image)} alt="" loading="lazy" />
              <span>{c.name}</span>
              {c.productCount !== undefined ? (
                <span className="tiny muted">{t('common.itemsCount', { count: c.productCount })}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      {state.promotions.length > 0 ? (
        <section>
          <div className="card card-pad" style={{ background: 'var(--red-50)', borderColor: 'var(--red-100)' }}>
            <div className="row between wrap gap-16">
              <div className="row gap-12">
                <span className="feature-icon"><Tag size={18} /></span>
                <div>
                  <h3 style={{ fontSize: '1rem' }}>{t('home.activePromos')}</h3>
                  <p className="small muted" style={{ margin: 0 }}>{t('home.activePromosSub')}</p>
                </div>
              </div>
              <div className="chips">
                {state.promotions.map((p) => (
                  <span key={p.code} className="chip" title={p.description}>
                    <Zap size={12} /> {p.code}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <div>
            <h2>{t('home.featuredProducts')}</h2>
            <p className="muted small">{t('home.featuredProductsSub')}</p>
          </div>
          <Link to="/products?featured=true" className="link">{t('common.seeAll')}</Link>
        </div>

        {state.loading ? <SkeletonGrid count={5} /> : (
          <div className="product-grid">
            {state.featured.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>{t('home.bestSellers')}</h2>
            <p className="muted small">{t('home.bestSellersSub')}</p>
          </div>
          <Link to="/products?sort=best_selling" className="link">{t('common.seeAll')}</Link>
        </div>

        {state.loading ? <SkeletonGrid count={5} /> : (
          <div className="product-grid">
            {state.bestSellers.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
