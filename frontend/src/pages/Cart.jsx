import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { Breadcrumb, EmptyState } from '../components/ui';
import { Cart as CartIcon, Minus, Plus, Trash, Tag, Truck, X } from '../components/Icons';
import { currency, imageUrl } from '../utils/format';
import { useI18n } from '../i18n';

export default function CartPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
      toast.success(t('toast.itemRemoved'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function applyCoupon(e) {
    e.preventDefault();
    if (!user) {
      toast.info(t('toast.signInForPromo'));
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
        <Breadcrumb items={[{ label: t('common.home'), to: '/' }, { label: t('cart.short') }]} />
        <EmptyState
          icon={<CartIcon size={30} />}
          title={t('cart.emptyTitle')}
          message={t('cart.emptyMessage')}
          action={<Link to="/products" className="btn btn-primary btn-lg">{t('common.startShopping')}</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container">
      <Breadcrumb items={[{ label: t('common.home'), to: '/' }, { label: t('cart.breadcrumb') }]} />

      <div className="row between wrap gap-12">
        <h1 style={{ fontSize: '1.6rem' }}>{t('cart.title', { count: cart.itemCount })}</h1>
        <div className="row gap-8">
          <Link to="/products" className="btn btn-ghost btn-sm">{t('cart.continueShopping')}</Link>
          <button
            type="button"
            className="btn btn-danger-ghost btn-sm"
            onClick={() => cart.clear(Boolean(user))}
          >
            <Trash size={14} /> {t('cart.clearCart')}
          </button>
        </div>
      </div>

      <div className="cart-layout">
        <div className="card card-pad">
          {remainingForFreeShipping > 0 ? (
            <div className="free-ship-bar mb-16">
              <span className="row gap-8">
                <Truck size={15} />
                {t('cart.addMoreForFreeShipping', { amount: currency(remainingForFreeShipping) })}
              </span>
              <span className="track"><span className="fill" style={{ width: `${shippingProgress}%` }} /></span>
            </div>
          ) : (
            <div className="free-ship-bar mb-16">
              <span className="row gap-8"><Truck size={15} /> {t('cart.haveFreeShipping')}</span>
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
                <span className="small muted">{t('cart.each', { amount: currency(item.price) })}</span>

                <div className="row gap-12 mt-8 wrap">
                  <div className="qty">
                    <button
                      type="button"
                      onClick={() => changeQty(item, item.quantity - 1)}
                      disabled={item.quantity <= 1 || busyId === item._id}
                      aria-label={t('cart.decrease')}
                    >
                      <Minus size={13} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(item, item.quantity + 1)}
                      disabled={item.quantity >= (item.product.stock || 99) || busyId === item._id}
                      aria-label={t('cart.increase')}
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
                    <Trash size={14} /> {t('common.remove')}
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
            <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>{t('cart.orderSummary')}</h3>

            <div className="summary-row">
              <span className="muted">{t('cart.subtotal')}</span>
              <span className="bold">{currency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 ? (
              <div className="summary-row">
                <span className="muted">{t('cart.discount')} {cart.coupon ? `(${cart.coupon.code})` : ''}</span>
                <span className="bold" style={{ color: 'var(--primary-ink)' }}>
                  −{currency(totals.discount)}
                </span>
              </div>
            ) : null}
            <div className="summary-row">
              <span className="muted">{t('cart.shipping')}</span>
              <span className="bold" style={{ color: totals.shipping === 0 ? 'var(--primary-ink)' : undefined }}>
                {totals.shipping === 0 ? t('common.free') : currency(totals.shipping)}
              </span>
            </div>
            <div className="summary-row">
              <span className="muted">{t('cart.tax', { percent: Math.round(rules.taxRate * 100) })}</span>
              <span className="bold">{currency(totals.tax)}</span>
            </div>
            <div className="summary-row total">
              <span>{t('cart.total')}</span>
              <span>{currency(totals.total)}</span>
            </div>

            <hr className="divider" />

            {cart.coupon ? (
              <div className="row between" style={{ padding: '8px 12px', background: 'var(--green-50)', borderRadius: 8 }}>
                <span className="row gap-8 small bold" style={{ color: 'var(--primary-ink)' }}>
                  <Tag size={14} /> {t('cart.couponApplied', { code: cart.coupon.code })}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cart.removeCoupon()}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <form className="row gap-8" onSubmit={applyCoupon}>
                <input
                  className="input"
                  placeholder={t('cart.promoPlaceholder')}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  aria-label={t('cart.promoAria')}
                />
                <button type="submit" className="btn btn-outline" disabled={applying || !couponCode}>
                  {t('common.apply')}
                </button>
              </form>
            )}

            <button type="button" className="btn btn-primary btn-lg btn-block mt-16" onClick={goToCheckout}>
              {t('cart.proceedToCheckout')}
            </button>

            {!user ? (
              <p className="tiny muted mt-8" style={{ textAlign: 'center' }}>
                {t('cart.signInFirst')}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
