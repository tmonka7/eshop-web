import { Link } from 'react-router-dom';
import { Heart, HeartFilled, Cart } from './Icons';
import { Rating } from './ui';
import { compactNumber, currency, discountPercent, imageUrl } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { userApi } from '../api';
import { useI18n } from '../i18n';

export default function ProductCard({ product, isNew = false }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const toggleLocal = useAuthStore((s) => s.toggleWishlistLocal);
  const addToCart = useCartStore((s) => s.add);
  const toast = useToastStore();

  const wishIds = (user?.wishlist || []).map((w) => (typeof w === 'string' ? w : w._id));
  const wished = wishIds.includes(product._id);
  const off = discountPercent(product.price, product.comparePrice);
  const outOfStock = product.stock <= 0;

  async function handleWishlist(e) {
    e.preventDefault();
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

  async function handleAdd(e) {
    e.preventDefault();
    if (outOfStock) return;
    try {
      const message = await addToCart(product, 1, null, Boolean(user));
      toast.success(message || t('toast.addedToCart'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <article className={`product-card ${isNew ? 'product-card-new' : ''}`}>
      <Link to={`/product/${product.slug}`} className="product-media">
        <img
          src={imageUrl(product.images?.[0])}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
        {/* The design puts the discount beside the price rather than over the
            photo, so the only flag left here is availability - and the "New"
            marker, which has no other place to live. */}
        {outOfStock ? (
          <span className="product-flag out">{t('common.outOfStock')}</span>
        ) : isNew ? (
          <span className="product-flag new">{t('home.newSeason')}</span>
        ) : null}
      </Link>

      <button
        type="button"
        className={`wish-btn ${wished ? 'on' : ''}`}
        onClick={handleWishlist}
        aria-label={wished ? t('a11y.removeFromWishlist') : t('a11y.addToWishlist')}
      >
        {wished ? <HeartFilled size={16} /> : <Heart size={16} />}
      </button>

      <div className="product-body">
        <div className="product-meta">
          <span className="truncate">{product.brand}</span>
        </div>

        <Link to={`/product/${product.slug}`} className="product-name clamp-2">
          {product.name}
        </Link>

        <div className="product-meta">
          <Rating value={product.rating} size={12} showValue />
          {product.soldCount > 0 ? (
            <span className="truncate">{t('product.soldCount', { count: compactNumber(product.soldCount) })}</span>
          ) : null}
        </div>

        <div className="product-price-row">
          <span className="price">{currency(product.price, product.currency)}</span>
          {product.comparePrice > product.price ? (
            <span className="price-old">{currency(product.comparePrice, product.currency)}</span>
          ) : null}
          {off > 0 ? <span className="off-pill">-{off}%</span> : null}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm btn-block"
          onClick={handleAdd}
          disabled={outOfStock}
        >
          <Cart size={15} />
          {outOfStock ? t('common.outOfStock') : t('product.addToCart')}
        </button>
      </div>
    </article>
  );
}
