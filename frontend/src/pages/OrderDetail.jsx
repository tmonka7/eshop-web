import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../api';
import { Breadcrumb, EmptyState, Spinner, Badge } from '../components/ui';
import { Package, MapPin, CreditCard, Truck } from '../components/Icons';
import { useToastStore } from '../store/toastStore';
import { currency, formatDate, formatDateTime, imageUrl, statusLabel } from '../utils/format';
import { ORDER_STATUS_META } from '../utils/constants';

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToastStore();

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([orderApi.get(id), orderApi.track(id)])
      .then(([o, t]) => {
        setOrder(o.data);
        setTracking(t.data);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  async function cancelOrder() {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Cancel this order? Stock will be returned and any payment refunded.')) return;
    setCancelling(true);
    try {
      await orderApi.cancel(id, 'Cancelled by customer');
      toast.success('Order cancelled');
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
          title="Order not found"
          action={<Link to="/orders" className="btn btn-primary">Back to my orders</Link>}
        />
      </div>
    );
  }

  const meta = ORDER_STATUS_META[order.status] || { label: order.status, tone: 'muted' };
  const canCancel = ['pending', 'processing'].includes(order.status);

  return (
    <div className="container">
      <Breadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'My Orders', to: '/orders' },
          { label: order.orderNumber },
        ]}
      />

      <div className="row between wrap gap-12 mb-24">
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>Order {order.orderNumber}</h1>
          <p className="small muted" style={{ margin: 0 }}>
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="row gap-12">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {canCancel ? (
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={cancelOrder}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="cart-layout" style={{ marginTop: 0 }}>
        <div className="stack gap-20">
          <div className="card">
            <div className="card-header"><span className="card-title">Order Tracking</span></div>
            <div className="card-pad">
              {order.status === 'cancelled' ? (
                <div className="alert alert-error">
                  This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : ''}.
                </div>
              ) : (
                <div className="row between wrap gap-12 mb-24">
                  <span className="row gap-8 small">
                    <Truck size={16} /> {order.carrier} · <strong>{order.trackingNumber}</strong>
                  </span>
                  <span className="small muted">
                    Estimated delivery {formatDate(order.estimatedDelivery)}
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
                        {s.at ? formatDateTime(s.at) : i === 0 ? '' : 'Pending'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Items ({order.items.length})</span>
            </div>
            {order.items.map((item) => (
              <div key={item._id} className="order-item-row">
                <img src={imageUrl(item.image)} alt="" />
                <div className="grow">
                  <div className="small bold">{item.name}</div>
                  <div className="tiny muted">
                    SKU {item.sku} · Qty {item.quantity} · {currency(item.price)}
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
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Payment Summary</h3>
            <div className="summary-row">
              <span className="muted">Subtotal</span>
              <span>{currency(order.pricing.subtotal)}</span>
            </div>
            {order.pricing.discount > 0 ? (
              <div className="summary-row">
                <span className="muted">Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                <span style={{ color: 'var(--green-600)' }}>−{currency(order.pricing.discount)}</span>
              </div>
            ) : null}
            <div className="summary-row">
              <span className="muted">Shipping</span>
              <span>{order.pricing.shipping === 0 ? 'Free' : currency(order.pricing.shipping)}</span>
            </div>
            <div className="summary-row">
              <span className="muted">Tax</span>
              <span>{currency(order.pricing.tax)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{currency(order.pricing.total)}</span>
            </div>

            <hr className="divider" />
            <div className="row gap-8 small">
              <CreditCard size={15} />
              <span className="grow">{statusLabel(order.payment.method)}</span>
              <Badge tone={order.payment.status === 'paid' ? 'ok' : order.payment.status === 'refunded' ? 'info' : 'warn'}>
                {statusLabel(order.payment.status)}
              </Badge>
            </div>
            {order.payment.cardLast4 ? (
              <div className="tiny muted mt-8">Card ending {order.payment.cardLast4}</div>
            ) : null}
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>
              <span className="row gap-8"><MapPin size={15} /> Shipping Address</span>
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
