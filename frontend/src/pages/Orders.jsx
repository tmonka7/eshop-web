import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../api';
import { Breadcrumb, EmptyState, Pagination, Spinner, Badge } from '../components/ui';
import { Package } from '../components/Icons';
import { currency, formatDate, imageUrl } from '../utils/format';
import { ORDER_STATUS_META } from '../utils/constants';
import { useI18n } from '../i18n';

const FILTERS = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    orderApi
      .list({ status, page, limit: 8 })
      .then((res) => {
        if (!alive) return;
        setOrders(res.data);
        setPagination(res.pagination);
      })
      .catch(() => alive && setOrders([]))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
    // Line-item names are localised server-side, so refetch on a switch.
  }, [status, page, locale]);

  return (
    <div className="container">
      <Breadcrumb items={[{ label: t('common.home'), to: '/' }, { label: t('orders.breadcrumb') }]} />
      <h1 style={{ fontSize: '1.6rem', marginBottom: 16 }}>{t('orders.title')}</h1>

      <div className="chips mb-24">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            style={
              status === f
                ? { background: 'var(--primary)', color: '#fff' }
                : { background: 'var(--ink-100)', color: 'var(--ink-600)' }
            }
            onClick={() => {
              setStatus(f);
              setPage(1);
            }}
          >
            {f === 'all' ? t('orders.filterAll') : t(ORDER_STATUS_META[f]?.labelKey || f)}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package size={30} />}
          title={t('orders.emptyTitle')}
          message={
            status === 'all'
              ? t('orders.emptyMessage')
              : t('orders.emptyFiltered', { status: t(ORDER_STATUS_META[status]?.labelKey || status) })
          }
          action={<Link to="/products" className="btn btn-primary">{t('common.startShopping')}</Link>}
        />
      ) : (
        <>
          {orders.map((order) => {
            const meta = ORDER_STATUS_META[order.status];
            const statusText = meta ? t(meta.labelKey) : order.status;
            return (
              <div key={order._id} className="order-card">
                <div className="order-card-head">
                  <div className="row gap-16 wrap">
                    <div>
                      <div className="tiny muted">{t('orders.orderLabel')}</div>
                      <div className="bold small">{order.orderNumber}</div>
                    </div>
                    <div>
                      <div className="tiny muted">{t('orders.placed')}</div>
                      <div className="small">{formatDate(order.createdAt)}</div>
                    </div>
                    <div>
                      <div className="tiny muted">{t('cart.total')}</div>
                      <div className="bold small">{currency(order.pricing.total)}</div>
                    </div>
                  </div>
                  <div className="row gap-12">
                    <Badge tone={meta ? meta.tone : 'muted'}>{statusText}</Badge>
                    <Link to={`/orders/${order.orderNumber}`} className="btn btn-outline btn-sm">
                      {t('orders.viewDetails')}
                    </Link>
                  </div>
                </div>

                {order.items.slice(0, 3).map((item) => (
                  <div key={item._id} className="order-item-row">
                    <img src={imageUrl(item.image)} alt="" />
                    <div className="grow">
                      <div className="small bold">{item.name}</div>
                      <div className="tiny muted">
                        {t('orderSuccess.qty', { count: item.quantity })} · {currency(item.price)}
                      </div>
                    </div>
                    <span className="small bold">{currency(item.subtotal)}</span>
                  </div>
                ))}

                {order.items.length > 3 ? (
                  <div className="order-item-row tiny muted">
                    {t('orders.moreItems', { count: order.items.length - 3 })}
                  </div>
                ) : null}
              </div>
            );
          })}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
