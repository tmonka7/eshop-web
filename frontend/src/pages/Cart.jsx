import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { Breadcrumb, EmptyState } from '../components/ui';
import { Cart as CartIcon, Minus, Plus, Trash, Tag, Truck, X } from '../components/Icons';
import { currency, imageUrl } from '../utils/format';

export default function CartPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const cart = useCartStore();
  const toast = useToastStore();

  const [couponCode, setCouponCode] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    cart.load(Boolean(user));
    // Reloading whenever the sign-in state flips keeps guest and account carts in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    cart.notices?.forEach((n) => toast.info(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.notices]);

  const { items, totals, rules } = cart;
  const remainingForFreeShipping = Math.max(0, rules.freeShippingThreshold - totals.subtotal);
  const shippingProgress = Math.min(100, (totals.subtotal / rules.freeShippingThreshold) * 100);

  async function changeQty(item, next) {
    if (next < 0) return;
    setBusyId(item._id);
    try {
      await cart.update(item._id, next, Boolean(user));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(item) {
    setBusyId(item._id);
    try {
      await cart.remove(item._id, Boolean(user));
      toast.success('Item removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function applyCoupon(e) {
    e.preventDefault();
    if (!user) {
      toast.info('Sign in to use a promo code');
      return;
    }
    setApplying(true);
    try {
      const message = await cart.applyCoupon(couponCode);
      setCouponCode('');
      toast.success(message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApplying(false);
    }
  }

  function goToCheckout() {
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  }

  if (!items.length) {
    return (
      <div className="container">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
        <EmptyState
          icon={<CartIcon size={30} />}
          title="Your cart is empty"
          message="Browse the catalogue and add something you like."
          action={<Link to="/products" className="btn btn-primary btn-lg">Start shopping</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container">
      <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Shopping Cart' }]} />

      <div className="row between wrap gap-12">
        <h1 style={{ fontSize: '1.6rem' }}>Your Cart ({cart.itemCount})</h1>
        <div className="row gap-8">
          <Link to="/products" className="btn btn-ghost btn-sm">Continue shopping</Link>
          <button
            type="button"
            className="btn btn-danger-ghost btn-sm"
            onClick={() => cart.clear(Boolean(user))}
          >
            <Trash size={14} /> Clear cart
          </button>
        </div>
      </div>

      <div className="cart-layout">
        <div className="card card-pad">
          {remainingForFreeShipping > 0 ? (
            <div className="free-ship-bar mb-16">
              <span className="row gap-8">
                <Truck size={15} />
                Add <strong>{currency(remainingForFreeShipping)}</strong> more for free shipping
              </span>
              <span className="track"><span className="fill" style={{ width: `${shippingProgress}%` }} /></span>
            </div>
          ) : (
            <div className="free-ship-bar mb-16">
              <span className="row gap-8"><Truck size={15} /> You have free shipping on this order</span>
            </div>
          )}

          {items.map((item) => (
            <div key={item._id} className="cart-line">
              <Link to={`/product/${item.product.slug}`}>
                <img src={imageUrl(item.product.image || item.product.images?.[0])} alt={item.product.name} />
              </Link>

              <div className="stack gap-6">
                <Link to={`/product/${item.product.slug}`} className="bold">{item.product.name}</Link>
                {item.variant?.value ? (
                  <span className="small muted">{item.variant.name}: {item.variant.value}</span>
                ) : null}
                <span className="small muted">{currency(item.price)} each</span>

                <div className="row gap-12 mt-8 wrap">
                  <div className="qty">
                    <button
                      type="button"
                      onClick={() => changeQty(item, item.quantity - 1)}
                      disabled={item.quantity <= 1 || busyId === item._id}
                      aria-label="Decrease"
                    >
                      <Minus size={13} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(item, item.quantity + 1)}
                      disabled={item.quantity >= (item.product.stock || 99) || busyId === item._id}
                      aria-label="Increase"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => removeItem(item)}
                    disabled={busyId === item._id}
                  >
                    <Trash size={14} /> Remove
                  </button>
                </div>
              </div>

              <div className="right">
                <div className="price" style={{ fontSize: '1.05rem' }}>
                  {currency(item.subtotal ?? item.price * item.quantity)}
                </div>
                {item.product.comparePrice > item.price ? (
                  <div className="price-old small">
                    {currency(item.product.comparePrice * item.quantity)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <aside className="summary">
          <div className="card card-pad">
            <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>Order Summary</h3>

            <div className="summary-row">
              <span className="muted">Subtotal</span>
              <span className="bold">{currency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 ? (
              <div className="summary-row">
                <span className="muted">Discount {cart.coupon ? `(${cart.coupon.code})` : ''}</span>
                <span className="bold" style={{ color: 'var(--green-600)' }}>
                  −{currency(totals.discount)}
                </span>
              </div>
            ) : null}
            <div className="summary-row">
              <span className="muted">Shipping</span>
              <span className="bold" style={{ color: totals.shipping === 0 ? 'var(--green-600)' : undefined }}>
                {totals.shipping === 0 ? 'Free' : currency(totals.shipping)}
              </span>
            </div>
            <div className="summary-row">
              <span className="muted">Tax ({Math.round(rules.taxRate * 100)}%)</span>
              <span className="bold">{currency(totals.tax)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{currency(totals.total)}</span>
            </div>

            <hr className="divider" />

            {cart.coupon ? (
              <div className="row between" style={{ padding: '8px 12px', background: 'var(--green-50)', borderRadius: 8 }}>
                <span className="row gap-8 small bold" style={{ color: 'var(--green-600)' }}>
                  <Tag size={14} /> {cart.coupon.code} applied
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cart.removeCoupon()}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <form className="row gap-8" onSubmit={applyCoupon}>
                <input
                  className="input"
                  placeholder="Promo code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  aria-label="Promo code"
                />
                <button type="submit" className="btn btn-outline" disabled={applying || !couponCode}>
                  Apply
                </button>
              </form>
            )}

            <button type="button" className="btn btn-primary btn-lg btn-block mt-16" onClick={goToCheckout}>
              Proceed to Checkout
            </button>

            {!user ? (
              <p className="tiny muted mt-8" style={{ textAlign: 'center' }}>
                You will be asked to sign in first.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
