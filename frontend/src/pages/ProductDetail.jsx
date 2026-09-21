import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, reviewApi, userApi } from '../api';
import ProductCard from '../components/ProductCard';
import { Breadcrumb, Rating, Spinner, EmptyState, Badge } from '../components/ui';
import {
  Cart, Heart, HeartFilled, Truck, Shield, Refresh, Minus, Plus, Check, Star, StarFilled,
  Search,
} from '../components/Icons';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { currency, discountPercent, imageUrl, relativeDate } from '../utils/format';
import { COLOR_SWATCHES } from '../utils/constants';
import { useI18n } from '../i18n';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const user = useAuthStore((s) => s.user);
  const toggleLocal = useAuthStore((s) => s.toggleWishlistLocal);
  const addToCart = useCartStore((s) => s.add);
  const toast = useToastStore();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ average: 0, total: 0, buckets: {} });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [imageIndex, setImageIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  // Percentages, so they can be handed straight to transform-origin.
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [variant, setVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('description');
  const [busy, setBusy] = useState(false);

  /**
   * Tracks the cursor inside the frame as a percentage of its box, which is
   * what transform-origin expects. Clamped so a fast pointer leaving the edge
   * cannot push the origin outside the image.
   */
  function onZoomMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100));
    setZoomOrigin({ x, y });
  }

  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setImageIndex(0);
    setQuantity(1);
    setVariant(null);
    setTab('description');

    catalogApi
      .product(slug)
      .then((res) => {
        if (!alive) return;
        setProduct(res.data);
        const first = res.data.variants?.[0];
        if (first) setVariant(first);
      })
      .catch(() => {
        if (alive) setNotFound(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    catalogApi.related(slug).then((res) => alive && setRelated(res.data)).catch(() => {});
    catalogApi.reviews(slug, { limit: 10 }).then((res) => alive && setReviews(res.data)).catch(() => {});
    catalogApi.reviewSummary(slug).then((res) => alive && setSummary(res.data)).catch(() => {});

    return () => {
      alive = false;
    };
    // Product copy is localised server-side, so refetch when the language flips.
  }, [slug, locale]);

  if (loading) return <Spinner label={t('product.loading')} />;

  if (notFound || !product) {
    return (
      <div className="container">
        <EmptyState
          title={t('product.notFoundTitle')}
          message={t('product.notFoundMessage')}
          action={<Link to="/products" className="btn btn-primary">{t('common.browseProducts')}</Link>}
        />
      </div>
    );
  }

  const off = discountPercent(product.price, product.comparePrice);
  const outOfStock = product.stock <= 0;
  const wishIds = (user?.wishlist || []).map((w) => (typeof w === 'string' ? w : w._id));
  const wished = wishIds.includes(product._id);
  const colorVariants = product.variants?.filter((v) => v.name === 'Color') || [];
  const sizeVariants = product.variants?.filter((v) => v.name === 'Size') || [];
  const effectivePrice = product.price + (variant?.priceDelta || 0);

  async function handleAdd(buyNow = false) {
    if (outOfStock) return;
    setBusy(true);
    try {
      const payload = variant
        ? { name: variant.name, value: variant.value, hex: variant.hex || '' }
        : null;
      await addToCart(product, quantity, payload, Boolean(user));
      toast.success(t('toast.addedToCartNamed', { name: product.name }));
      if (buyNow) navigate('/cart');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleWishlist() {
    if (!user) {
      toast.info(t('toast.signInForWishlist'));
      return;
    }
    try {
      const res = await userApi.toggleWishlist(product._id);
      toggleLocal(product._id, res.data.inWishlist);
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!user) {
      toast.info(t('toast.signInForReview'));
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await reviewApi.create({ productId: product._id, ...reviewForm });
      setReviews((prev) => [res.data, ...prev]);
      setReviewForm({ rating: 5, title: '', comment: '' });
      toast.success(t('toast.thanksForReview'));
      const fresh = await catalogApi.reviewSummary(slug);
      setSummary(fresh.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="container">
      <Breadcrumb
        items={[
          { label: t('common.home'), to: '/' },
          { label: product.category?.name || t('common.products'), to: `/products?category=${product.category?.slug || ''}` },
          { label: product.name },
        ]}
      />

      <div className="product-detail">
        <div className="gallery">
          <div className="gallery-thumbs">
            {(product.images || []).map((src, i) => (
              <button
                key={src}
                type="button"
                className={`gallery-thumb ${i === imageIndex ? 'active' : ''}`}
                onClick={() => setImageIndex(i)}
                aria-label={t('product.viewImage', { index: i + 1 })}
              >
                <img src={imageUrl(src)} alt="" />
              </button>
            ))}
          </div>
          {/* Zoom. The pointer position drives transform-origin, so the point
              under the cursor is the point that magnifies. Kept as a hover
              affordance with a click fallback for touch, where there is no
              hover to track. */}
          <div
            className={`gallery-main zoomable ${zoomed ? 'zoomed' : ''}`}
            onMouseMove={onZoomMove}
            onMouseEnter={() => setZoomed(true)}
            onMouseLeave={() => setZoomed(false)}
            onClick={() => setZoomed((z) => !z)}
            role="button"
            tabIndex={0}
            aria-label={t(zoomed ? 'product.zoomOut' : 'product.zoomIn')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setZoomed((z) => !z);
              }
            }}
          >
            <img
              src={imageUrl(product.images?.[imageIndex])}
              alt={product.name}
              style={{ transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}
            />
            <span className="zoom-hint" aria-hidden="true">
              <Search size={14} /> {t('product.zoomHint')}
            </span>
          </div>
        </div>

        <div>
          <div className="row gap-8 mb-16 wrap">
            <span className="small muted">{product.brand}</span>
            <span className="muted">·</span>
            <span className="small muted">{t('product.sku', { sku: product.sku })}</span>
            {product.isFeatured ? <Badge tone="danger">{t('product.featured')}</Badge> : null}
          </div>

          <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>{product.name}</h1>

          <div className="row gap-12 mb-16 wrap">
            <Rating value={summary.average || product.rating} showValue />
            <span className="small muted">
              {t('product.reviewsParen', { count: summary.total || product.reviewCount })}
            </span>
            <span className="muted">·</span>
            <span className="small muted">{t('product.soldCount', { count: product.soldCount })}</span>
          </div>

          <div className="row gap-12 wrap mb-16">
            <span className="price" style={{ fontSize: '2rem' }}>{currency(effectivePrice, product.currency)}</span>
            {product.comparePrice > product.price ? (
              <>
                <span className="price-old" style={{ fontSize: '1.1rem' }}>{currency(product.comparePrice, product.currency)}</span>
                <Badge tone="danger">{t('common.percentOff', { percent: off })}</Badge>
              </>
            ) : null}
          </div>

          <p className="muted">{product.shortDescription || product.description?.slice(0, 180)}</p>

          {colorVariants.length > 0 ? (
            <div className="field mt-24">
              <span className="field-label">
                {t('product.colorLabel')} <strong>{variant?.name === 'Color' ? variant.value : colorVariants[0].value}</strong>
              </span>
              <div className="swatches">
                {colorVariants.map((v) => (
                  <button
                    key={v._id || v.value}
                    type="button"
                    className={`swatch ${variant?.value === v.value ? 'active' : ''}`}
                    style={{ background: v.hex || COLOR_SWATCHES[v.value] || 'var(--ink-200)' }}
                    onClick={() => setVariant(v)}
                    title={v.value}
                    aria-label={v.value}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {sizeVariants.length > 0 ? (
            <div className="field">
              <span className="field-label">{t('product.size')}</span>
              <div className="row gap-8 wrap">
                {sizeVariants.map((v) => (
                  <button
                    key={v._id || v.value}
                    type="button"
                    className={`size-chip ${variant?.value === v.value ? 'active' : ''}`}
                    onClick={() => setVariant(v)}
                    disabled={v.stock <= 0}
                  >
                    {v.value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="field">
            <span className="field-label">{t('product.quantity')}</span>
            <div className="row gap-12 wrap">
              <div className="qty">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label={t('product.decreaseQty')}
                >
                  <Minus size={14} />
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  disabled={quantity >= product.stock}
                  aria-label={t('product.increaseQty')}
                >
                  <Plus size={14} />
                </button>
              </div>
              {outOfStock ? (
                <Badge tone="danger">{t('common.outOfStock')}</Badge>
              ) : product.stock <= 10 ? (
                <Badge tone="warn">{t('product.onlyNLeft', { count: product.stock })}</Badge>
              ) : (
                <Badge tone="ok"><Check size={12} /> {t('common.inStock')}</Badge>
              )}
            </div>
          </div>

          <div className="row gap-12 wrap mt-24">
            <button
              type="button"
              className="btn btn-primary btn-lg grow"
              onClick={() => handleAdd(false)}
              disabled={outOfStock || busy}
            >
              <Cart size={17} /> {t('product.addToCart')}
            </button>
            <button
              type="button"
              className="btn btn-success btn-lg grow"
              onClick={() => handleAdd(true)}
              disabled={outOfStock || busy}
            >
              {t('product.buyNow')}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-lg"
              onClick={handleWishlist}
              aria-label={t('product.toggleWishlist')}
            >
              {wished ? <HeartFilled size={17} style={{ color: 'var(--primary)' }} /> : <Heart size={17} />}
            </button>
          </div>

          <div className="trust-row">
            <div className="trust-item">
              <span className="ico"><Truck size={17} /></span>
              <div>
                <strong>{product.freeShipping ? t('product.freeShipping') : t('product.fastShipping')}</strong>
                <span>
                  {product.freeShipping
                    ? t('product.onThisItem')
                    : t('product.freeOver', { amount: currency(50) })}
                </span>
              </div>
            </div>
            <div className="trust-item">
              <span className="ico"><Shield size={17} /></span>
              <div>
                <strong>{t('product.warrantyMonths', { count: product.warrantyMonths || 12 })}</strong>
                <span>{t('product.freeReplacement')}</span>
              </div>
            </div>
            <div className="trust-item">
              <span className="ico"><Refresh size={17} /></span>
              <div>
                <strong>{t('product.returnDays', { count: product.returnDays || 30 })}</strong>
                <span>{t('product.hassleFree')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {['description', 'specs', 'reviews'].map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            className={`tab ${tab === tabKey ? 'active' : ''}`}
            onClick={() => setTab(tabKey)}
          >
            {tabKey === 'description'
              ? t('product.tabDescription')
              : tabKey === 'specs'
                ? t('product.tabSpecs')
                : t('product.tabReviews', { count: summary.total || 0 })}
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {tab === 'description' ? (
          <div style={{ maxWidth: '70ch' }}>
            <p>{product.description}</p>
            {product.tags?.length ? (
              <div className="chips mt-16">
                {product.tags.map((tag) => (
                  <Link key={tag} to={`/products?tag=${tag}`} className="chip">#{tag}</Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'specs' ? (
          <table style={{ width: '100%', maxWidth: 560, borderCollapse: 'collapse' }}>
            <tbody>
              {[
                [t('product.specBrand'), product.brand],
                [t('product.specSku'), product.sku],
                [t('product.specCategory'), product.category?.name],
                [t('product.specStock'), product.stock],
                [t('product.specColors'), product.colors?.join(', ') || '-'],
                [t('product.specWarranty'), t('product.specMonths', { count: product.warrantyMonths || 12 })],
                [t('product.specReturns'), t('product.specDays', { count: product.returnDays || 30 })],
                [t('product.specShipping'), product.freeShipping ? t('product.specFree') : t('product.specStandardRates')],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)', width: 180 }}>{label}</td>
                  <td style={{ padding: '10px 0', fontWeight: 600 }}>{value ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === 'reviews' ? (
          <div className="shop-layout" style={{ gridTemplateColumns: '300px 1fr', marginTop: 0 }}>
            <div className="card card-pad">
              <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800 }}>
                  {(summary.average || 0).toFixed(1)}
                </span>
                <Rating value={summary.average} size={16} />
                <span className="small muted">{t('product.totalReviews', { count: summary.total })}</span>
              </div>
              <div className="stack gap-6 mt-16">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = summary.buckets?.[star] || 0;
                  const pct = summary.total ? (count / summary.total) * 100 : 0;
                  return (
                    <div key={star} className="rating-bar">
                      <span>{star}★</span>
                      <span className="track"><span className="fill" style={{ width: `${pct}%` }} /></span>
                      <span className="muted" style={{ width: 26, textAlign: 'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <form className="card card-pad mb-24" onSubmit={submitReview}>
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('product.writeReview')}</h3>
                {!user ? (
                  <div className="alert alert-info">
                    <Link to="/login" className="link">{t('auth.signIn')}</Link>
                    {' '}
                    {t('product.signInToReview')}
                  </div>
                ) : null}
                <div className="field">
                  <span className="field-label">{t('product.yourRating')}</span>
                  <div className="row gap-4">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setReviewForm((f) => ({ ...f, rating: r }))}
                        style={{ padding: 4 }}
                        aria-label={t(r > 1 ? 'product.starsAria' : 'product.starAria', { count: r })}
                      >
                        {reviewForm.rating >= r
                          ? <StarFilled size={20} className="star-on" />
                          : <Star size={20} className="star-off" />}
                      </button>
                    ))}
                    <span className="small muted">{reviewForm.rating} / 5</span>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="review-title">{t('product.reviewTitle')}</label>
                  <input
                    id="review-title"
                    className="input"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={t('product.reviewTitlePlaceholder')}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="review-comment">{t('product.reviewBody')}</label>
                  <textarea
                    id="review-comment"
                    className="textarea"
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                    placeholder={t('product.reviewBodyPlaceholder')}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submittingReview || !user}>
                  {submittingReview ? t('product.submitting') : t('product.submitReview')}
                </button>
              </form>

              {reviews.length === 0 ? (
                <p className="muted">{t('product.noReviews')}</p>
              ) : (
                reviews.map((r) => (
                  <div key={r._id} className="review-item">
                    <div className="row gap-12">
                      <span className="review-avatar">{(r.user?.name || '?').charAt(0)}</span>
                      <div className="grow">
                        <div className="row between wrap gap-8">
                          <div>
                            <span className="bold small">{r.user?.name || t('product.customer')}</span>
                            {r.isVerifiedPurchase ? (
                              <span className="badge badge-ok" style={{ marginLeft: 8 }}>
                                <Check size={11} /> {t('product.verifiedPurchase')}
                              </span>
                            ) : null}
                          </div>
                          <span className="tiny muted">{relativeDate(r.createdAt)}</span>
                        </div>
                        <Rating value={r.rating} />
                        {r.title ? <div className="bold small mt-8">{r.title}</div> : null}
                        <p className="small muted" style={{ marginTop: 4 }}>{r.comment}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>{t('product.youMightLike')}</h2>
          </div>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
