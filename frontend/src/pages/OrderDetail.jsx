import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../api';
import { Breadcrumb, EmptyState, Spinner, Badge } from '../components/ui';
import { Package, MapPin, CreditCard, Truck } from '../components/Icons';
import { useToastStore } from '../store/toastStore';
import { currency, formatDate, formatDateTime, imageUrl, statusLabel } from '../utils/format';
import { ORDER_STATUS_META } from '../utils/constants';
import { useI18n } from '../i18n';

export default function OrderDetail() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const toast = useToastStore();

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([orderApi.get(id), orderApi.track(id)])
      .then(([orderRes, trackRes]) => {
        setOrder(orderRes.data);
        setTracking(trackRes.data);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
    // Line-item names are localised server-side, so reload on a switch.
  }, [id, locale]);

  useEffect(load, [load]);

  async function cancelOrder() {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('orders.cancelConfirm'))) return;
    setCancelling(true);
    try {
      await orderApi.cancel(id, t('orders.cancelledByCustomer'));
      toast.success(t('toast.orderCancelled'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Spinner />;

  if (!order) {
    return (
      <div className="container">
        <EmptyState
          icon={<Package size={30} />}
          title={t('orders.notFoundTitle')}
          action={<Link to="/orders" className="btn btn-primary">{t('orders.backToOrders')}</Link>}
        />
      </div>
    );
  }

  const meta = ORDER_STATUS_META[order.status];
  const statusText = meta ? t(meta.labelKey) : order.status;
  const canCancel = ['pending', 'processing'].includes(order.status);

  return (
    <div className="container">
      <Breadcrumb
        items={[
          { label: t('common.home'), to: '/' },
          { label: t('orders.breadcrumb'), to: '/orders' },
          { label: order.orderNumber },
        ]}
      />

      <div className="row between wrap gap-12 mb-24">
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>{t('orders.orderTitle', { number: order.orderNumber })}</h1>
          <p className="small muted" style={{ margin: 0 }}>
            {t('orders.placedAt', { datetime: formatDateTime(order.createdAt) })}
          </p>
        </div>
        <div className="row gap-12">
          <Badge tone={meta ? meta.tone : 'muted'}>{statusText}</Badge>
          {canCancel ? (
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={cancelOrder}
              disabled={cancelling}
            >
              {cancelling ? t('orders.cancelling') : t('orders.cancelOrder')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="cart-layout" style={{ marginTop: 0 }}>
        <div className="stack gap-20">
          <div className="card">
            <div className="card-header"><span className="card-title">{t('orders.tracking')}</span></div>
            <div className="card-pad">
              {order.status === 'cancelled' ? (
                <div className="alert alert-error">
                  {order.cancelReason
                    ? t('orders.cancelledNoticeWithReason', { reason: order.cancelReason })
                    : t('orders.cancelledNotice')}
                </div>
              ) : (
                <div className="row between wrap gap-12 mb-24">
                  <span className="row gap-8 small">
                    <Truck size={16} /> {order.carrier} · <strong>{order.trackingNumber}</strong>
                  </span>
                  <span className="small muted">
                    {t('orders.estimatedDelivery', { date: formatDate(order.estimatedDelivery) })}
                  </span>
                </div>
              )}

              <div className="timeline">
                {(tracking?.steps || []).map((s, i) => {
                  const current = tracking.status === s.status;
                  return (
                    <div
                      key={s.status}
                      className={`timeline-item ${s.reached ? 'done' : ''} ${current ? 'current' : ''}`}
                    >
                      <div className="bold small">{statusLabel(s.status)}</div>
                      <div className="tiny muted">
                        {s.at ? formatDateTime(s.at) : i === 0 ? '' : t('orderStatus.pending')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('orders.itemsCount', { count: order.items.length })}</span>
            </div>
            {order.items.map((item) => (
              <div key={item._id} className="order-item-row">
                <img src={imageUrl(item.image)} alt="" />
                <div className="grow">
                  <div className="small bold">{item.name}</div>
                  <div className="tiny muted">
                    {t('orders.itemMeta', {
                      sku: item.sku,
                      qty: item.quantity,
                      price: currency(item.price),
                    })}
                    {item.variant?.value ? ` · ${item.variant.value}` : ''}
                  </div>
                </div>
                <span className="bold small">{currency(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="stack gap-20">
          <div className="card card-pad">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>{t('orders.paymentSummary')}</h3>
            <div className="summary-row">
              <span className="muted">{t('cart.subtotal')}</span>
              <span>{currency(order.pricing.subtotal)}</span>
            </div>
            {order.pricing.discount > 0 ? (
              <div className="summary-row">
                <span className="muted">{t('cart.discount')} {order.couponCode ? `(${order.couponCode})` : ''}</span>
                <span style={{ color: 'var(--primary-ink)' }}>−{currency(order.pricing.discount)}</span>
              </div>
            ) : null}
            <div className="summary-row">
              <span className="muted">{t('cart.shipping')}</span>
              <span>{order.pricing.shipping === 0 ? t('common.free') : currency(order.pricing.shipping)}</span>
            </div>
            <div className="summary-row">
              <span className="muted">{t('checkout.tax')}</span>
              <span>{currency(order.pricing.tax)}</span>
            </div>
            <div className="summary-row total">
              <span>{t('cart.total')}</span>
              <span>{currency(order.pricing.total)}</span>
            </div>

            <hr className="divider" />
            <div className="row gap-8 small">
              <CreditCard size={15} />
              <span className="grow">{t(`payment.${order.payment.method}`)}</span>
              <Badge tone={order.payment.status === 'paid' ? 'ok' : order.payment.status === 'refunded' ? 'info' : 'warn'}>
                {t(`paymentStatus.${order.payment.status}`)}
              </Badge>
            </div>
            {order.payment.cardLast4 ? (
              <div className="tiny muted mt-8">
                {t('orders.cardEnding', { last4: order.payment.cardLast4 })}
              </div>
            ) : null}
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>
              <span className="row gap-8"><MapPin size={15} /> {t('checkout.shippingAddress')}</span>
            </h3>
            <div className="small muted">
              <strong style={{ color: 'var(--text)' }}>{order.shippingAddress.fullName}</strong><br />
              {order.shippingAddress.street}<br />
              {order.shippingAddress.city} {order.shippingAddress.zipCode}<br />
              {order.shippingAddress.country}
              {order.shippingAddress.phone ? <><br />{order.shippingAddress.phone}</> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
