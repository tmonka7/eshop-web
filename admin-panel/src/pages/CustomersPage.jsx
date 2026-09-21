import { useCallback, useEffect, useState } from 'react';
import { customerApi } from '../api';
import { Badge, Empty, Modal, Pagination, Spinner, Switch } from '../components/ui';
import { Search, Users, Eye, Download } from '../components/Icons';
import { useToastStore } from '../store';
import { tokenStore } from '../api/client';
import { currency, formatDate, statusLabel } from '../utils/format';
import { STATUS_TONE } from '../utils/constants';
import { useI18n } from '../i18n';

export default function CustomersPage() {
  const { t, locale } = useI18n();
  const toast = useToastStore();

  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    customerApi
      .list({ search, status, page, limit: 20 })
      .then((res) => {
        setCustomers(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  useEffect(() => {
    const timer = setTimeout(load, 260);
    return () => clearTimeout(timer);
  }, [load]);

  async function openDetail(customer) {
    setDetail({ customer, stats: null, recentOrders: [] });
    setDetailLoading(true);
    try {
      const res = await customerApi.get(customer._id);
      setDetail(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleActive(customer, isActive) {
    setCustomers((list) => list.map((c) => (c._id === customer._id ? { ...c, isActive } : c)));
    try {
      await customerApi.toggleStatus(customer._id, isActive);
      toast.success(isActive ? t('customers.activated') : t('customers.deactivated'));
    } catch (err) {
      setCustomers((list) => list.map((c) => (c._id === customer._id ? { ...c, isActive: !isActive } : c)));
      toast.error(err.message);
    }
  }

  /**
   * The export route needs the bearer token, so fetch it manually and hand the
   * browser a blob rather than a plain link.
   */
  async function exportCsv() {
    setExporting(true);
    try {
      // This is a raw fetch, so the axios interceptor does not add the header
      // for us; without it the CSV comes back with English column titles.
      const res = await fetch(customerApi.exportUrl(), {
        headers: {
          Authorization: `Bearer ${tokenStore.access}`,
          'X-Language': locale,
        },
      });
      if (!res.ok) throw new Error(t('customers.exportFailed'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('customers.exported'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('customers.title')}</h1>
          <p>{t('customers.headCount', { total: pagination.total })}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={exporting}>
          <Download size={15} /> {exporting ? t('customers.exporting') : t('customers.exportCsv')}
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box" style={{ minWidth: 260 }}>
            <Search size={15} />
            <input
              className="input"
              placeholder={t('customers.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            style={{ width: 160 }}
          >
            <option value="">{t('customers.allStatus')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>
        </div>

        {loading ? (
          <Spinner />
        ) : customers.length === 0 ? (
          <Empty icon={<Users size={26} />} title={t('customers.emptyTitle')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('common.name')}</th>
                    <th>{t('common.email')}</th>
                    <th>{t('common.phone')}</th>
                    <th className="right">{t('customers.orders')}</th>
                    <th className="right">{t('customers.totalSpent')}</th>
                    <th>{t('customers.joined')}</th>
                    <th>{t('common.active')}</th>
                    <th className="right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <div className="row gap-8">
                          <span className="avatar-circle">{c.name.charAt(0)}</span>
                          <span className="bold">{c.name}</span>
                        </div>
                      </td>
                      <td className="muted truncate" style={{ maxWidth: 200 }}>{c.email}</td>
                      <td className="muted">{c.phone || '-'}</td>
                      <td className="right bold">{c.orderCount}</td>
                      <td className="right bold">{currency(c.totalSpent)}</td>
                      <td className="muted">{formatDate(c.createdAt)}</td>
                      <td><Switch checked={c.isActive} onChange={(v) => toggleActive(c, v)} /></td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => openDetail(c)}
                            aria-label={t('customers.viewCustomerAria')}
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
        title={detail ? detail.customer.name : ''}
        onClose={() => setDetail(null)}
      >
        {detailLoading || !detail?.stats ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-4 mb-16">
              <div className="card card-pad">
                <div className="tiny muted">{t('customers.orders')}</div>
                <div className="bold" style={{ fontSize: '1.3rem' }}>{detail.stats.orderCount}</div>
              </div>
              <div className="card card-pad">
                <div className="tiny muted">{t('customers.totalSpent')}</div>
                <div className="bold" style={{ fontSize: '1.3rem' }}>{currency(detail.stats.totalSpent)}</div>
              </div>
              <div className="card card-pad">
                <div className="tiny muted">{t('customers.avgOrder')}</div>
                <div className="bold" style={{ fontSize: '1.3rem' }}>{currency(detail.stats.averageOrder)}</div>
              </div>
              <div className="card card-pad">
                <div className="tiny muted">{t('customers.reviews')}</div>
                <div className="bold" style={{ fontSize: '1.3rem' }}>{detail.stats.reviewCount}</div>
              </div>
            </div>

            <div className="grid grid-2 mb-16">
              <div className="card card-pad">
                <h3 className="mb-8" style={{ fontSize: '0.85rem' }}>{t('settings.contact')}</h3>
                <div className="small">{detail.customer.email}</div>
                <div className="small muted">{detail.customer.phone || t('customers.noPhone')}</div>
                <div className="small muted">Joined {formatDate(detail.customer.createdAt)}</div>
                <div className="mt-8">
                  <Badge tone={detail.customer.isActive ? 'ok' : 'danger'}>
                    {detail.customer.isActive ? t('common.active') : t('customers.deactivatedLabel')}
                  </Badge>
                </div>
              </div>
              <div className="card card-pad">
                <h3 className="mb-8" style={{ fontSize: '0.85rem' }}>{t('customers.addresses')}</h3>
                {detail.customer.addresses?.length ? (
                  detail.customer.addresses.map((a) => (
                    <div key={a._id} className="small muted mb-8">
                      <span className="bold" style={{ color: 'var(--text)' }}>{a.label}</span>
                      {a.isDefault ? <Badge tone="ok">{t('common.default')}</Badge> : null}
                      <div>{a.street}, {a.city} {a.zipCode}, {a.country}</div>
                    </div>
                  ))
                ) : (
                  <p className="small muted">{t('customers.noAddresses')}</p>
                )}
              </div>
            </div>

            <h3 className="mb-8" style={{ fontSize: '0.85rem' }}>{t('customers.recentOrders')}</h3>
            {detail.recentOrders.length === 0 ? (
              <p className="small muted">{t('customers.noOrders')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('common.order')}</th>
                      <th>{t('common.date')}</th>
                      <th>{t('common.status')}</th>
                      <th className="right">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recentOrders.map((o) => (
                      <tr key={o._id}>
                        <td className="bold">#{o.orderNumber}</td>
                        <td className="muted">{formatDate(o.createdAt)}</td>
                        <td><Badge tone={STATUS_TONE[o.status] || 'muted'}>{statusLabel(o.status)}</Badge></td>
                        <td className="right bold">{currency(o.pricing.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
