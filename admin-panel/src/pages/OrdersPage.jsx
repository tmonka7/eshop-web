import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderApi } from '../api';
import { Badge, Empty, Modal, Pagination, Spinner } from '../components/ui';
import { Search, Package, Eye, Truck } from '../components/Icons';
import { useToastStore } from '../store';
import { currency, formatDate, formatDateTime, statusLabel } from '../utils/format';
import { ORDER_STATUSES, STATUS_TONE, STATUS_FLOW, PAYMENT_TONE } from '../utils/constants';
import { useI18n } from '../i18n';

export default function OrdersPage() {
  const { t } = useI18n();
  const toast = useToastStore();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState({ carrier: '', trackingNumber: '' });
  const [savingTracking, setSavingTracking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    orderApi
      .list({ status, search, page, limit: 20 })
      .then((res) => {
        setOrders(res.data);
        setPagination(res.pagination);
        setStatusCounts(res.statusCounts || {});
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, page]);

  useEffect(() => {
    const timer = setTimeout(load, 260);
    return () => clearTimeout(timer);
  }, [load]);

  async function openDetail(order) {
    setDetail(order);
    setNote('');
    setDetailLoading(true);
    try {
      const res = await orderApi.get(order._id);
      setDetail(res.data);
      // Seed the tracking inputs from the order that was just loaded, so the
      // form edits what is there rather than starting blank over real values.
      setTracking({
        carrier: res.data.carrier || '',
        trackingNumber: res.data.trackingNumber || '',
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveTracking(e) {
    e.preventDefault();
    setSavingTracking(true);
    try {
      const res = await orderApi.updateTracking(detail._id, tracking);
      setDetail(res.data);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingTracking(false);
    }
  }

  async function changeStatus(next) {
    setUpdating(true);
    try {
      const res = await orderApi.updateStatus(detail._id, next, note);
      setDetail(res.data);
      setNote('');
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  }

  const tabs = ['all', ...ORDER_STATUSES];
  const allowedNext = detail ? STATUS_FLOW[detail.status] || [] : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('orders.title')}</h1>
          <p>{t('orders.headCount', { total: pagination.total })}</p>
        </div>
        <div className="search-box" style={{ minWidth: 260 }}>
          <Search size={15} />
          <input
            className="input"
            placeholder={t('orders.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="tabs mb-16">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab-chip ${status === tab ? 'active' : ''}`}
            onClick={() => {
              setStatus(tab);
              setPage(1);
            }}
          >
            {tab === 'all' ? t('orders.filterAll') : statusLabel(tab)}
            {statusCounts[tab] !== undefined ? <span className="n">{statusCounts[tab]}</span> : null}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <Empty
            icon={<Package size={26} />}
            title={t('orders.emptyTitle')}
            message={t('orders.emptyMessage')}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('orders.orderId')}</th>
                    <th>{t('common.date')}</th>
                    <th>{t('common.customer')}</th>
                    <th className="right">{t('orders.items')}</th>
                    <th className="right">{t('common.total')}</th>
                    <th>{t('orders.payment')}</th>
                    <th>{t('common.status')}</th>
                    <th className="right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td className="bold">#{o.orderNumber}</td>
                      <td className="muted">{formatDate(o.createdAt)}</td>
                      <td>
                        <div className="bold">{o.customerName}</div>
                        <div className="tiny muted truncate" style={{ maxWidth: 180 }}>{o.customerEmail}</div>
                      </td>
                      <td className="right">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                      <td className="right bold">{currency(o.pricing.total)}</td>
                      <td>
                        <Badge tone={PAYMENT_TONE[o.payment.status] || 'muted'}>
                          {statusLabel(o.payment.status, 'paymentStatus')}
                        </Badge>
                      </td>
                      <td><Badge tone={STATUS_TONE[o.status] || 'muted'}>{statusLabel(o.status)}</Badge></td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => openDetail(o)}
                            aria-label={t('orders.viewOrderAria')}
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onChange={setPage}
            />
          </>
        )}
      </div>

      <Modal
        open={Boolean(detail)}
        wide
        title={detail ? `Order #${detail.orderNumber}` : ''}
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <div className="row between grow wrap gap-12">
              <span className="small muted">
                {t('orders.placedAt', { datetime: formatDateTime(detail.createdAt) })}
              </span>
              <div className="row gap-8 wrap">
                {allowedNext.length === 0 ? (
                  <span className="small muted">{t('orders.noFurtherChanges')}</span>
                ) : (
                  allowedNext.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => changeStatus(s)}
                      disabled={updating}
                    >
                      {t('orders.markAs', { status: statusLabel(s) })}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null
        }
      >
        {detailLoading || !detail ? (
          <Spinner />
        ) : (
          <>
            <div className="row between wrap gap-12 mb-16">
              <div className="row gap-8">
                <Badge tone={STATUS_TONE[detail.status] || 'muted'}>{statusLabel(detail.status)}</Badge>
                <Badge tone={PAYMENT_TONE[detail.payment.status] || 'muted'}>
                  {statusLabel(detail.payment.method, 'paymentMethod')}
                  {' · '}
                  {statusLabel(detail.payment.status, 'paymentStatus')}
                </Badge>
              </div>
              {/* Tracking is editable here rather than display-only: the API
                  has always exposed PATCH /orders/:id/tracking, and without
                  this there was no way to reach it from the panel. */}
              <form className="tracking-form" onSubmit={saveTracking}>
                <Truck size={15} />
                <input
                  className="input"
                  placeholder={t('orders.carrierPlaceholder')}
                  aria-label={t('orders.carrier')}
                  value={tracking.carrier}
                  onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })}
                />
                <input
                  className="input"
                  placeholder={t('orders.trackingPlaceholder')}
                  aria-label={t('orders.trackingNumber')}
                  value={tracking.trackingNumber}
                  onChange={(e) => setTracking({ ...tracking, trackingNumber: e.target.value })}
                />
                <button type="submit" className="btn btn-outline btn-sm" disabled={savingTracking}>
                  {savingTracking ? t('common.working') : t('common.save')}
                </button>
              </form>
            </div>

            <div className="grid grid-2 mb-16">
              <div className="card card-pad">
                <h3 className="mb-8" style={{ fontSize: '0.85rem' }}>{t('common.customer')}</h3>
                <div className="small">{detail.customerName}</div>
                <div className="small muted">{detail.customerEmail}</div>
                {detail.user?.phone ? <div className="small muted">{detail.user.phone}</div> : null}
              </div>
              <div className="card card-pad">
                <h3 className="mb-8" style={{ fontSize: '0.85rem' }}>{t('orders.shippingAddress')}</h3>
                <div className="small">{detail.shippingAddress.fullName}</div>
                <div className="small muted">
                  {detail.shippingAddress.street}, {detail.shippingAddress.city}{' '}
                  {detail.shippingAddress.zipCode}, {detail.shippingAddress.country}
                </div>
                {detail.shippingAddress.phone ? (
                  <div className="small muted">{detail.shippingAddress.phone}</div>
                ) : null}
              </div>
            </div>

            <div className="table-wrap mb-16">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('common.product')}</th>
                    <th className="right">{t('common.price')}</th>
                    <th className="right">{t('orders.qty')}</th>
                    <th className="right">{t('orders.subtotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div className="row gap-8">
                          <img className="thumb" src={item.image} alt="" />
                          <div>
                            <div className="bold">{item.name}</div>
                            <div className="tiny muted">
                              {item.sku}{item.variant?.value ? ` · ${item.variant.value}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="right">{currency(item.price)}</td>
                      <td className="right">{item.quantity}</td>
                      <td className="right bold">{currency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card card-pad mb-16">
              <div className="row between small"><span className="muted">{t('orders.subtotal')}</span><span>{currency(detail.pricing.subtotal)}</span></div>
              {detail.pricing.discount > 0 ? (
                <div className="row between small">
                  <span className="muted">{t('orders.discount')} {detail.couponCode ? `(${detail.couponCode})` : ''}</span>
                  <span style={{ color: 'var(--green-600)' }}>−{currency(detail.pricing.discount)}</span>
                </div>
              ) : null}
              <div className="row between small"><span className="muted">{t('orders.shipping')}</span><span>{detail.pricing.shipping === 0 ? t('common.free') : currency(detail.pricing.shipping)}</span></div>
              <div className="row between small"><span className="muted">{t('orders.tax')}</span><span>{currency(detail.pricing.tax)}</span></div>
              <hr className="divider" />
              <div className="row between bold"><span>{t('common.total')}</span><span>{currency(detail.pricing.total)}</span></div>
            </div>

            <div className="card card-pad mb-16">
              <h3 className="mb-8" style={{ fontSize: '0.85rem' }}>{t('orders.timeline')}</h3>
              {detail.timeline.map((entry, i) => (
                <div key={`${entry.status}-${i}`} className="row between small" style={{ padding: '4px 0' }}>
                  <span className="row gap-8">
                    <Badge tone={STATUS_TONE[entry.status] || 'muted'}>{statusLabel(entry.status)}</Badge>
                    {entry.note ? <span className="muted">{entry.note}</span> : null}
                  </span>
                  <span className="muted tiny">{formatDateTime(entry.at)}</span>
                </div>
              ))}
            </div>

            {allowedNext.length > 0 ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="status-note">{t('orders.statusNote')}</label>
                <input
                  id="status-note"
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('orders.notePlaceholder')}
                />
              </div>
            ) : null}
          </>
        )}
      </Modal>
    </>
  );
}
