import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, reviewApi, userApi } from '../api';
import ProductCard from '../components/ProductCard';
import { Breadcrumb, Rating, Spinner, EmptyState, Badge } from '../components/ui';
import {
  Cart, Heart, HeartFilled, Truck, Shield, Refresh, Minus, Plus, Check, Star, StarFilled,
} from '../components/Icons';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { currency, discountPercent, imageUrl, relativeDate } from '../utils/format';
import { COLOR_SWATCHES } from '../utils/constants';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

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
  const [variant, setVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('description');
  const [busy, setBusy] = useState(false);

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
  }, [slug]);

  if (loading) return <Spinner label="Loading product..." />;

  if (notFound || !product) {
    return (
      <div className="container">
        <EmptyState
          title="Product not found"
          message="This product may have been removed or renamed."
          action={<Link to="/products" className="btn btn-primary">Browse products</Link>}
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
      toast.success(`${product.name} added to cart`);
      if (buyNow) navigate('/cart');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleWishlist() {
    if (!user) {
      toast.info('Sign in to save items to your wishlist');
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
      toast.info('Sign in to write a review');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await reviewApi.create({ productId: product._id, ...reviewForm });
      setReviews((prev) => [res.data, ...prev]);
      setReviewForm({ rating: 5, title: '', comment: '' });
      toast.success('Thanks for your review');
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
          { label: 'Home', to: '/' },
          { label: product.category?.name || 'Products', to: `/products?category=${product.category?.slug || ''}` },
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
                aria-label={`View image ${i + 1}`}
              >
                <img src={imageUrl(src)} alt="" />
              </button>
            ))}
          </div>
          <div className="gallery-main">
            <img src={imageUrl(product.images?.[imageIndex])} alt={product.name} />
          </div>
        </div>

        <div>
          <div className="row gap-8 mb-16 wrap">
            <span className="small muted">{product.brand}</span>
            <span className="muted">·</span>
            <span className="small muted">SKU {product.sku}</span>
            {product.isFeatured ? <Badge tone="danger">Featured</Badge> : null}
          </div>

          <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>{product.name}</h1>

          <div className="row gap-12 mb-16 wrap">
            <Rating value={summary.average || product.rating} showValue />
            <span className="small muted">({summary.total || product.reviewCount} reviews)</span>
            <span className="muted">·</span>
            <span className="small muted">{product.soldCount} sold</span>
          </div>

          <div className="row gap-12 wrap mb-16">
            <span className="price" style={{ fontSize: '2rem' }}>{currency(effectivePrice)}</span>
            {product.comparePrice > product.price ? (
              <>
                <span className="price-old" style={{ fontSize: '1.1rem' }}>{currency(product.comparePrice)}</span>
                <Badge tone="danger">{off}% OFF</Badge>
              </>
            ) : null}
          </div>

          <p className="muted">{product.shortDescription || product.description?.slice(0, 180)}</p>

          {colorVariants.length > 0 ? (
            <div className="field mt-24">
              <span className="field-label">
                Color: <strong>{variant?.name === 'Color' ? variant.value : colorVariants[0].value}</strong>
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
              <span className="field-label">Size</span>
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
            <span className="field-label">Quantity</span>
            <div className="row gap-12 wrap">
              <div className="qty">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  disabled={quantity >= product.stock}
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
              {outOfStock ? (
                <Badge tone="danger">Out of stock</Badge>
              ) : product.stock <= 10 ? (
                <Badge tone="warn">Only {product.stock} left</Badge>
              ) : (
                <Badge tone="ok"><Check size={12} /> In stock</Badge>
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
              <Cart size={17} /> Add to Cart
            </button>
            <button
              type="button"
              className="btn btn-success btn-lg grow"
              onClick={() => handleAdd(true)}
              disabled={outOfStock || busy}
            >
              Buy Now
            </button>
            <button
              type="button"
              className="btn btn-outline btn-lg"
              onClick={handleWishlist}
              aria-label="Toggle wishlist"
            >
              {wished ? <HeartFilled size={17} style={{ color: 'var(--primary)' }} /> : <Heart size={17} />}
            </button>
          </div>

          <div className="trust-row">
            <div className="trust-item">
              <span className="ico"><Truck size={17} /></span>
              <div>
                <strong>{product.freeShipping ? 'Free Shipping' : 'Fast Shipping'}</strong>
                <span>{product.freeShipping ? 'On this item' : 'Free over $50'}</span>
              </div>
            </div>
            <div className="trust-item">
              <span className="ico"><Shield size={17} /></span>
              <div>
                <strong>{product.warrantyMonths || 12} Month Warranty</strong>
                <span>Free replacement</span>
              </div>
            </div>
            <div className="trust-item">
              <span className="ico"><Refresh size={17} /></span>
              <div>
                <strong>{product.returnDays || 30} Days Return</strong>
                <span>Hassle free</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {['description', 'specs', 'reviews'].map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'description' ? 'Description' : t === 'specs' ? 'Specifications' : `Reviews (${summary.total || 0})`}
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {tab === 'description' ? (
          <div style={{ maxWidth: '70ch' }}>
            <p>{product.description}</p>
            {product.tags?.length ? (
              <div className="chips mt-16">
                {product.tags.map((t) => (
                  <Link key={t} to={`/products?tag=${t}`} className="chip">#{t}</Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'specs' ? (
          <table style={{ width: '100%', maxWidth: 560, borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Brand', product.brand],
                ['SKU', product.sku],
                ['Category', product.category?.name],
                ['Available stock', product.stock],
                ['Colors', product.colors?.join(', ') || '-'],
                ['Warranty', `${product.warrantyMonths || 12} months`],
                ['Returns', `${product.returnDays || 30} days`],
                ['Shipping', product.freeShipping ? 'Free' : 'Standard rates apply'],
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
                <span className="small muted">{summary.total} reviews</span>
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
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Write a review</h3>
                {!user ? (
                  <div className="alert alert-info">
                    <Link to="/login" className="link">Sign in</Link> to share your experience.
                  </div>
                ) : null}
                <div className="field">
                  <span className="field-label">Your rating</span>
                  <div className="row gap-4">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setReviewForm((f) => ({ ...f, rating: r }))}
                        style={{ padding: 4 }}
                        aria-label={`${r} star${r > 1 ? 's' : ''}`}
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
                  <label className="field-label" htmlFor="review-title">Title</label>
                  <input
                    id="review-title"
                    className="input"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Sum it up in a few words"
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="review-comment">Review</label>
                  <textarea
                    id="review-comment"
                    className="textarea"
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                    placeholder="What did you like or dislike?"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submittingReview || !user}>
                  {submittingReview ? 'Submitting…' : 'Submit review'}
                </button>
              </form>

              {reviews.length === 0 ? (
                <p className="muted">No reviews yet. Be the first to review this product.</p>
              ) : (
                reviews.map((r) => (
                  <div key={r._id} className="review-item">
                    <div className="row gap-12">
                      <span className="review-avatar">{(r.user?.name || '?').charAt(0)}</span>
                      <div className="grow">
                        <div className="row between wrap gap-8">
                          <div>
                            <span className="bold small">{r.user?.name || 'Customer'}</span>
                            {r.isVerifiedPurchase ? (
                              <span className="badge badge-ok" style={{ marginLeft: 8 }}>
                                <Check size={11} /> Verified purchase
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
            <h2>You might also like</h2>
          </div>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
