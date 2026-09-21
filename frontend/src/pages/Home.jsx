import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard';
import { SkeletonGrid } from '../components/ui';
import { Truck, Headset, Shield, Refresh, Zap, Tag, Grid, ChevronRight } from '../components/Icons';
import { currency, discountPercent, imageUrl } from '../utils/format';
import { useI18n } from '../i18n';

/**
 * The discounted items out of everything already on the page, deepest cut
 * first. Derived rather than fetched: the featured and best-seller lists are
 * in hand, so a "Hot Deals" rail costs no extra request.
 */
function pickDeals(...lists) {
  const seen = new Set();
  return lists
    .flat()
    .filter((p) => {
      if (!p || seen.has(p._id)) return false;
      seen.add(p._id);
      return discountPercent(p.price, p.comparePrice) > 0;
    })
    .sort((a, b) => discountPercent(b.price, b.comparePrice) - discountPercent(a.price, a.comparePrice));
}

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
  const deals = pickDeals(state.featured, state.bestSellers);
  // The headline claim is read off the actual data, so the tile can never
  // advertise a discount the catalogue does not have.
  const topDeal = deals.length ? discountPercent(deals[0].price, deals[0].comparePrice) : 0;

  return (
    <div className="container">
      {/* Department rail beside the hero, as in the design. It is a shortcut,
          not the only route to a category - the nav bar and the Shop by
          Category grid below both cover the same ground, so hiding it on
          narrow screens costs nothing. */}
      <div className="home-top">
        <aside className="dept-rail" aria-label={t('home.allCategories')}>
          <div className="dept-rail-head">
            <Grid size={16} />
            {t('home.allCategories')}
          </div>
          <ul>
            {state.categories.slice(0, 9).map((c) => (
              <li key={c._id}>
                <Link to={`/products?category=${c.slug}`}>
                  <span className="truncate">{c.name}</span>
                  <ChevronRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </aside>

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
      </div>

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
            <h2 className="head-accent">{t('home.shopByCategory')}</h2>
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

      {/* Hot deals: four discounted items beside two promo tiles, as in the
          design. The whole block is skipped when nothing is on offer rather
          than rendered empty. */}
      {deals.length >= 2 ? (
        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="head-accent">{t('home.hotDeals')}</h2>
              <p className="muted small">{t('home.hotDealsSub')}</p>
            </div>
            <Link to="/products?onSale=true" className="link">{t('common.seeAll')}</Link>
          </div>

          <div className="deal-layout">
            <div className="product-grid deal-grid">
              {deals.slice(0, 4).map((p) => <ProductCard key={p._id} product={p} />)}
            </div>

            <div className="promo-stack">
              <Link to="/products?onSale=true" className="promo-tile promo-tile-sale">
                <span className="promo-eyebrow"><Zap size={14} /> {t('home.hotDeals')}</span>
                <strong>{t('home.upToPercentOff', { percent: topDeal })}</strong>
                <span className="promo-sub">{t('home.dealTileSub')}</span>
                <span className="promo-cta">{t('home.shopNow')} <ChevronRight size={14} /></span>
              </Link>

              <Link to="/products" className="promo-tile promo-tile-ship">
                <span className="promo-eyebrow"><Truck size={14} /> {t('home.features.shippingTitle')}</span>
                <strong>{t('home.features.shippingText', { amount: currency(50) })}</strong>
                <span className="promo-cta">{t('common.seeAll')} <ChevronRight size={14} /></span>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="head-accent">{t('home.featuredProducts')}</h2>
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
            <h2 className="head-accent">{t('home.bestSellers')}</h2>
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
