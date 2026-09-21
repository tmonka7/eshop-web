import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard';
import { Rating, SkeletonGrid } from '../components/ui';
import {
  Truck, Headset, Shield, Refresh, Zap, Tag, CreditCard, ChevronRight, ChevronLeft, Grid,
} from '../components/Icons';
import { compactNumber, currency, discountPercent, imageUrl } from '../utils/format';
import { useI18n } from '../i18n';

/** The three promises stacked beside the hero. */
const HERO_PROMISES = [
  { icon: <Truck size={20} />, titleKey: 'home.features.shippingTitle', textKey: 'home.features.shippingText' },
  { icon: <Refresh size={20} />, titleKey: 'home.features.returnsTitle', textKey: 'home.features.returnsText' },
  { icon: <Headset size={20} />, titleKey: 'home.features.supportTitle', textKey: 'home.features.supportText' },
  { icon: <Shield size={20} />, titleKey: 'home.features.paymentTitle', textKey: 'home.features.paymentText' },
];

/** The reassurance strip under the deals band. */
const TRUST = [
  { icon: <CreditCard size={18} />, titleKey: 'home.features.paymentTitle', textKey: 'home.features.paymentText' },
  { icon: <Refresh size={18} />, titleKey: 'home.features.returnsTitle', textKey: 'home.features.returnsText' },
  { icon: <Truck size={18} />, titleKey: 'home.features.deliveryTitle', textKey: 'home.features.deliveryText' },
  { icon: <Shield size={18} />, titleKey: 'home.features.qualityTitle', textKey: 'home.features.qualityText' },
];

/**
 * The discounted items out of everything already on the page, deepest cut
 * first. Derived rather than fetched: the featured and best-seller lists are
 * in hand, so the deals rail costs no extra request.
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

export default function Home() {
  const { t, locale } = useI18n();
  const [slide, setSlide] = useState(0);
  const [state, setState] = useState({
    banners: [],
    categories: [],
    featured: [],
    bestSellers: [],
    newest: [],
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
      catalogApi.products({ sort: 'newest', limit: 6 }).catch(() => ({ data: [] })),
      catalogApi.promotions().catch(() => ({ data: [] })),
    ]).then(([banners, categories, featured, bestSellers, newest, promotions]) => {
      if (!alive) return;
      setState({
        banners: banners.data,
        categories: categories.data,
        featured: featured.data,
        bestSellers: bestSellers.data,
        newest: newest.data,
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

  // Clamped rather than indexed directly: the banner list is refetched on a
  // language change and can come back shorter than the current slide.
  const hero = state.banners[Math.min(slide, Math.max(state.banners.length - 1, 0))];
  const deals = pickDeals(state.featured, state.bestSellers);
  // Both headline claims are read off the catalogue, so a tile can never
  // advertise a discount the data does not actually have.
  const topDeal = deals.length ? discountPercent(deals[0].price, deals[0].comparePrice) : 0;
  const promoPick = deals.length > 4 ? deals[4] : deals[0];
  const promoDeal = promoPick ? discountPercent(promoPick.price, promoPick.comparePrice) : 0;
  const promoLabel = promoPick?.category?.name || t('home.hotDeals');

  return (
    <div className="container">
      {/* Department rail, hero, promises - the three columns of the design.
          The rail duplicates the nav bar's departments, so it is dropped
          below 1100px rather than stacked. */}
      <div className="home-top">
        <aside className="dept-rail" aria-label={t('home.allCategories')}>
          <ul>
            {state.categories.slice(0, 9).map((c) => (
              <li key={c._id}>
                <Link to={`/products?category=${c.slug}`}>
                  <img src={imageUrl(c.image)} alt="" loading="lazy" />
                  <span className="truncate">{c.name}</span>
                  <ChevronRight size={14} />
                </Link>
              </li>
            ))}
            <li>
              <Link to="/products">
                <span className="dept-more"><Grid size={14} /></span>
                <span className="truncate">{t('common.seeAll')}</span>
                <ChevronRight size={14} />
              </Link>
            </li>
          </ul>
        </aside>

        <section className="hero">
          <div>
            <span className="hero-eyebrow">{t('home.newArrivals')}</span>
            <h1>{hero?.title || t('home.heroTitle')}</h1>
            <p>{hero?.subtitle || t('home.heroSubtitle')}</p>
            <div className="row gap-12 mt-24">
              <Link to={hero?.ctaLink || '/products'} className="btn btn-primary btn-lg btn-pill">
                {hero?.ctaText || t('home.shopNow')} <ChevronRight size={16} />
              </Link>
            </div>
          </div>
          {/* Carousel controls, only once there is more than one banner to
              move between. The dots are buttons, not decoration, so the
              slide is reachable without dragging. */}
          {state.banners.length > 1 ? (
            <div className="hero-nav">
              <button
                type="button"
                className="hero-arrow"
                onClick={() => setSlide((s) => (s - 1 + state.banners.length) % state.banners.length)}
                aria-label={t('common.prev')}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="hero-dots">
                {state.banners.map((b, i) => (
                  <button
                    key={b._id || i}
                    type="button"
                    className={i === slide ? 'on' : ''}
                    onClick={() => setSlide(i)}
                    aria-label={`${i + 1}`}
                    aria-current={i === slide}
                  />
                ))}
              </span>
              <button
                type="button"
                className="hero-arrow"
                onClick={() => setSlide((s) => (s + 1) % state.banners.length)}
                aria-label={t('common.next')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}

          <div className="hero-art">
            {hero?.image ? <img src={imageUrl(hero.image)} alt="" /> : null}
          </div>
        </section>

        <aside className="hero-aside">
          {HERO_PROMISES.map((p) => (
            <Link key={p.titleKey} to="/products" className="promise-card">
              <span className="promise-icon">{p.icon}</span>
              <span className="grow">
                <strong>{t(p.titleKey)}</strong>
                <span className="tiny muted">{t(p.textKey, { amount: currency(50) })}</span>
              </span>
              <ChevronRight size={15} />
            </Link>
          ))}
        </aside>
      </div>

      {/* Department rail. The tile is a ring around each category's own
          image - the design uses per-department glyphs, which the catalogue
          does not carry. */}
      <nav className="category-rail" aria-label={t('home.shopByCategory')}>
        {state.categories.slice(0, 12).map((c) => (
          <Link key={c._id} to={`/products?category=${c.slug}`} className="category-chip">
            <span className="chip-ring">
              <img className="avatar" src={imageUrl(c.image)} alt="" loading="lazy" />
            </span>
            <span>{c.name}</span>
          </Link>
        ))}
        <Link to="/products" className="category-chip">
          <span className="chip-ring chip-ring-more"><Grid size={20} /></span>
          <span>{t('common.seeAll')}</span>
        </Link>
      </nav>

      {/* Deals band: hot deals, the best-seller ranking and one promo card. */}
      <section className="deal-band">
        <div className="card deal-main">
          <div className="card-header">
            <div className="row gap-8 wrap">
              <h2 className="card-title band-title"><Zap size={17} /> {t('home.hotDeals')}</h2>
              {topDeal > 0 ? (
                <span className="badge badge-danger">{t('home.upToPercentOff', { percent: topDeal })}</span>
              ) : null}
            </div>
            <Link to="/products?onSale=true" className="link small">
              {t('common.seeAll')} <ChevronRight size={13} />
            </Link>
          </div>

          <div className="card-pad">
            {state.loading ? <SkeletonGrid count={4} /> : (
              <div className="product-grid deal-grid">
                {deals.slice(0, 4).map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
            )}
          </div>
        </div>

        <div className="card rank-card">
          <div className="card-header">
            <h2 className="card-title">{t('home.bestSellers')}</h2>
            <Link to="/products?sort=best_selling" className="link small">
              {t('common.seeAll')} <ChevronRight size={13} />
            </Link>
          </div>

          <ol className="rank-list">
            {state.bestSellers.slice(0, 5).map((p, i) => (
              <li key={p._id}>
                <Link to={`/product/${p.slug}`}>
                  {/* The ordinal repeats what the ordered list already conveys,
                      so it is hidden rather than read out twice. */}
                  <span className="rank-num" aria-hidden="true">{i + 1}</span>
                  <img src={imageUrl(p.images?.[0])} alt="" loading="lazy" />
                  <span className="grow">
                    <span className="rank-name clamp-2">{p.name}</span>
                    <span className="row gap-8 wrap">
                      <span className="price small">{currency(p.price)}</span>
                      <Rating value={p.rating} count={compactNumber(p.reviewCount)} size={11} showValue />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <Link to="/products?onSale=true" className="promo-tile promo-tile-lg">
          {promoDeal > 0 ? (
            <span className="promo-eyebrow">{t('home.upToPercentOff', { percent: promoDeal })}</span>
          ) : null}
          <strong>{promoLabel}</strong>
          <span className="promo-sub">{t('home.promoSub')}</span>
          <span className="promo-cta">{t('home.shopNow')} <ChevronRight size={14} /></span>
        </Link>
      </section>

      <div className="trust-strip">
        {TRUST.map((f) => (
          <div key={f.titleKey} className="trust-cell">
            <span className="promise-icon">{f.icon}</span>
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
            <h2 className="head-accent">{t('home.newArrivals')}</h2>
            <p className="muted small">{t('home.shopByCategorySub')}</p>
          </div>
          <Link to="/products?sort=newest" className="link">
            {t('common.seeAll')} <ChevronRight size={13} />
          </Link>
        </div>

        {state.loading ? <SkeletonGrid count={6} /> : (
          <div className="product-grid">
            {state.newest.map((p) => <ProductCard key={p._id} product={p} isNew />)}
          </div>
        )}
      </section>

      {state.promotions.length > 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="card card-pad">
            <div className="row between wrap gap-16">
              <div className="row gap-12">
                <span className="promise-icon"><Tag size={18} /></span>
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

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2 className="head-accent">{t('home.featuredProducts')}</h2>
            <p className="muted small">{t('home.featuredProductsSub')}</p>
          </div>
          <Link to="/products?featured=true" className="link">
            {t('common.seeAll')} <ChevronRight size={13} />
          </Link>
        </div>

        {state.loading ? <SkeletonGrid count={5} /> : (
          <div className="product-grid">
            {state.featured.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
