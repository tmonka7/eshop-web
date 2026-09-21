import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../api';
import { Spinner, EmptyState, Badge } from '../components/ui';
import { CheckCircle, Package, Truck } from '../components/Icons';
import { currency, formatDate, imageUrl, statusLabel } from '../utils/format';
import { useI18n } from '../i18n';

export default function OrderSuccess() {
  const { t } = useI18n();
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApi
      .get(orderNumber)
      .then((res) => setOrder(res.data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  if (loading) return <Spinner />;

  if (!order) {
    return (
      <div className="container">
        <EmptyState
          title={t('orderSuccess.notFoundTitle')}
          message={t('orderSuccess.notFoundMessage')}
          action={<Link to="/orders" className="btn btn-primary">{t('orderSuccess.viewMyOrders')}</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 680, paddingTop: 48, paddingBottom: 48 }}>
      <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
        <div
          style={{
            width: 76,
            height: 76,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'var(--green-50)',
            color: 'var(--primary-ink)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CheckCircle size={40} />
        </div>

        <h1 style={{ fontSize: '1.6rem', marginBottom: 8 }}>{t('orderSuccess.title')}</h1>
        <p className="muted">{t('orderSuccess.subtitle')}</p>

        <div
          className="row center gap-12 wrap mt-16"
          style={{ padding: 14, background: 'var(--ink-50)', borderRadius: 10 }}
        >
          <span className="small muted">{t('orderSuccess.order')}</span>
          <span className="bold">{order.orderNumber}</span>
          <Badge tone="warn">{statusLabel(order.status)}</Badge>
        </div>

        <div className="stack gap-8 mt-24" style={{ textAlign: 'left' }}>
          {order.items.map((item) => (
            <div key={item._id} className="order-item-row" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
              <img src={imageUrl(item.image)} alt="" />
              <div className="grow">
                <div className="small bold">{item.name}</div>
                <div className="tiny muted">{t('orderSuccess.qty', { count: item.quantity })}</div>
              </div>
              <span className="bold small">{currency(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="summary-row total" style={{ justifyContent: 'space-between' }}>
          <span>{t('orderSuccess.totalPaid')}</span>
          <span>{currency(order.pricing.total)}</span>
        </div>

        <div className="row center gap-12 wrap mt-16 small muted">
          <span className="row gap-6"><Truck size={15} /> {order.carrier} · {order.trackingNumber}</span>
          <span className="row gap-6">
            <Package size={15} /> {t('orderSuccess.estimated', { date: formatDate(order.estimatedDelivery) })}
          </span>
        </div>

        <div className="row gap-12 mt-24">
          <Link to={`/orders/${order.orderNumber}`} className="btn btn-primary btn-lg grow">
            {t('orderSuccess.viewOrder')}
          </Link>
          <Link to="/products" className="btn btn-outline btn-lg grow">
            {t('common.continueShopping')}
          </Link>
        </div>
      </div>
    </div>
  );
}
