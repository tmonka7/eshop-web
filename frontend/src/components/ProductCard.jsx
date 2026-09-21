import { Link } from 'react-router-dom';
import { Heart, HeartFilled, Cart } from './Icons';
import { Rating } from './ui';
import { currency, discountPercent, imageUrl } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { userApi } from '../api';

export default function ProductCard({ product }) {
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

  async function handleAdd(e) {
    e.preventDefault();
    if (outOfStock) return;
    try {
      const message = await addToCart(product, 1, null, Boolean(user));
      toast.success(message || 'Added to cart');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`} className="product-media">
        <img
          src={imageUrl(product.images?.[0])}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
        {outOfStock ? (
          <span className="product-flag out">Out of stock</span>
        ) : off > 0 ? (
          <span className="product-flag">{off}% OFF</span>
        ) : null}
      </Link>

      <button
        type="button"
        className={`wish-btn ${wished ? 'on' : ''}`}
        onClick={handleWishlist}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
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

        <Rating value={product.rating} count={product.reviewCount} />

        <div className="product-price-row">
          <span className="price">{currency(product.price)}</span>
          {product.comparePrice > product.price ? (
            <span className="price-old">{currency(product.comparePrice)}</span>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm btn-block"
          onClick={handleAdd}
          disabled={outOfStock}
        >
          <Cart size={15} />
          {outOfStock ? 'Out of stock' : 'Add to Cart'}
        </button>
      </div>
    </article>
  );
}
