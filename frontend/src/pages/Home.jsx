import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard';
import { SkeletonGrid } from '../components/ui';
import { Truck, Headset, Shield, Refresh, Zap, Tag } from '../components/Icons';
import { imageUrl } from '../utils/format';

const features = [
  { icon: <Truck size={18} />, title: 'Free Shipping', text: 'For orders over $50' },
  { icon: <Headset size={18} />, title: '24/7 Support', text: 'We are here to help' },
  { icon: <Shield size={18} />, title: 'Secure Payment', text: '100% protected' },
  { icon: <Refresh size={18} />, title: 'Easy Returns', text: 'Within 30 days' },
];

export default function Home() {
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
  }, []);

  const hero = state.banners[0];

  return (
    <div className="container">
      <section className="hero">
        <div>
          <span className="badge badge-danger mb-16">New season</span>
          <h1>{hero?.title || 'Discover Premium Products'}</h1>
          <p>{hero?.subtitle || 'Top brands. Better prices. Faster delivery.'}</p>
          <div className="row gap-12 mt-24">
            <Link to={hero?.ctaLink || '/products'} className="btn btn-primary btn-lg">
              {hero?.ctaText || 'Shop Now'}
            </Link>
            <Link to="/products?sort=newest" className="btn btn-outline btn-lg">
              New Arrivals
            </Link>
          </div>
        </div>
        <div className="hero-art">
          {hero?.image ? <img src={imageUrl(hero.image)} alt="" /> : null}
        </div>
      </section>

      <div className="feature-strip">
        {features.map((f) => (
          <div key={f.title} className="feature-item">
            <span className="feature-icon">{f.icon}</span>
            <div>
              <h4>{f.title}</h4>
              <p>{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Shop by Category</h2>
            <p className="muted small">Browse our most popular departments</p>
          </div>
          <Link to="/products" className="link">See All</Link>
        </div>

        <div className="category-rail">
          {state.categories.map((c) => (
            <Link key={c._id} to={`/products?category=${c.slug}`} className="category-chip">
              <img className="avatar" src={imageUrl(c.image)} alt="" loading="lazy" />
              <span>{c.name}</span>
              {c.productCount !== undefined ? (
                <span className="tiny muted">{c.productCount} items</span>
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
                  <h3 style={{ fontSize: '1rem' }}>Active promo codes</h3>
                  <p className="small muted" style={{ margin: 0 }}>Apply one at checkout</p>
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
            <h2>Featured Products</h2>
            <p className="muted small">Hand-picked by our team</p>
          </div>
          <Link to="/products?featured=true" className="link">See All</Link>
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
            <h2>Best Sellers</h2>
            <p className="muted small">What everyone is buying right now</p>
          </div>
          <Link to="/products?sort=best_selling" className="link">See All</Link>
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
