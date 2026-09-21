import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { dashboardApi } from '../api';
import { Badge, Spinner, StatCard, Empty } from '../components/ui';
import { Dollar, Package, Users, TrendUp } from '../components/Icons';
import { currency, compactNumber, formatDate } from '../utils/format';
import { CHART_COLORS, RANGE_OPTIONS, STATUS_TONE } from '../utils/constants';
import { foldSegments, OTHER_COLOR } from '../utils/chart';
import { useI18n } from '../i18n';

export default function DashboardPage() {
  const { t } = useI18n();
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([
      dashboardApi.stats({ range }),
      dashboardApi.salesOverview({ range }),
      dashboardApi.salesByCategory({ range }),
      dashboardApi.recentOrders(6),
      dashboardApi.topProducts(5),
      dashboardApi.customerGrowth({ months: 6 }),
    ])
      .then(([stats, sales, byCategory, recent, top, growth]) => {
        if (!alive) return;
        setData({
          stats: stats.data,
          sales: sales.data,
          byCategory: byCategory.data,
          recent: recent.data,
          top: top.data,
          growth: growth.data,
        });
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [range]);

  if (loading) return <Spinner label={t('dashboard.loading')} />;

  if (!data) {
    return (
      <Empty
        title={t('dashboard.loadFailed')}
        message={t('toast.dashboardRetry')}
      />
    );
  }

  const { stats, sales, byCategory, recent, top, growth } = data;

  // Past the palette's cap the remainder becomes one "Other" slice, so no two
  // segments ever share a hue and every segment can carry a legend entry.
  const segments = foldSegments(byCategory.segments, t('dashboard.otherCategories'));
  const segmentColor = (seg, i) => (seg.category === t('dashboard.otherCategories')
    ? OTHER_COLOR
    : CHART_COLORS[i]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <div className="tabs">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`tab-chip ${range === r.value ? 'active' : ''}`}
              onClick={() => setRange(r.value)}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-4 mb-24">
        {/* Each tile counts up to its figure; `format` runs per frame so the
            currency symbol and the compact suffix stay attached throughout.
            Revenue reads green rather than red - red is the destructive and
            discount colour here, and money coming in is not either. */}
        <StatCard
          label={t('dashboard.totalRevenue')}
          count={stats.totalRevenue.value}
          format={currency}
          delta={stats.totalRevenue.change}
          icon={<Dollar size={18} />}
          tone="green"
        />
        <StatCard
          label={t('dashboard.totalOrders')}
          count={stats.totalOrders.value}
          format={compactNumber}
          delta={stats.totalOrders.change}
          icon={<Package size={18} />}
          tone="blue"
        />
        <StatCard
          label={t('dashboard.totalCustomers')}
          count={stats.totalCustomers.value}
          format={compactNumber}
          delta={stats.totalCustomers.change}
          icon={<Users size={18} />}
          tone="amber"
        />
        <StatCard
          label={t('dashboard.conversionRate')}
          count={stats.conversionRate.value}
          // The API rounds to 2dp; Number() drops the trailing zero so the
          // figure it settles on is the one the tile showed before.
          format={(v) => `${Number(v.toFixed(2))}%`}
          delta={stats.conversionRate.change}
          icon={<TrendUp size={18} />}
          tone="purple"
        />
      </div>

      <div className="grid grid-2-1 mb-24">
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">{t('dashboard.salesOverview')}</span>
              <div className="tiny muted">{t('dashboard.salesOverviewSub')}</div>
            </div>
            <span className="bold">{currency(stats.totalRevenue.value)}</span>
          </div>
          <div className="card-pad" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ece6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#5a7566" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => (d.length > 7 ? d.slice(5) : d)}
                  minTickGap={22}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#5a7566" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => compactNumber(v)}
                />
                <Tooltip
                  formatter={(value, name) => (name === 'revenue' ? currency(value) : value)}
                  labelFormatter={(l) => `Date: ${l}`}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2ece6", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">{t('dashboard.salesByCategory')}</span>
              <div className="tiny muted">{t('dashboard.shareOfRevenue')}</div>
            </div>
          </div>
          <div className="card-pad">
            {segments.length === 0 ? (
              <p className="muted small">{t('dashboard.noSalesInRange')}</p>
            ) : (
              <>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={segments}
                        dataKey="revenue"
                        nameKey="category"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {segments.map((seg, i) => (
                          <Cell key={seg.category} fill={segmentColor(seg, i)} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => currency(value)}
                        contentStyle={{ borderRadius: 10, border: "1px solid #e2ece6", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="center bold mb-16" style={{ fontSize: '1.15rem' }}>
                  {currency(byCategory.total)}
                </div>

                {/* Every segment is listed: the palette's separation at this
                    size is only legal alongside labels, not colour alone. */}
                <div className="legend">
                  {segments.map((seg, i) => (
                    <div key={seg.category} className="legend-item">
                      <span className="legend-dot" style={{ background: segmentColor(seg, i) }} />
                      <span className="grow truncate">{seg.category}</span>
                      <span className="muted">{seg.percent}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2-1">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('dashboard.recentOrders')}</span>
            <Link to="/orders" className="btn btn-ghost btn-sm">{t('common.viewAll')}</Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('orders.orderId')}</th>
                  <th>{t('common.customer')}</th>
                  <th>{t('common.date')}</th>
                  <th>{t('common.status')}</th>
                  <th className="right">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o._id}>
                    <td className="bold">
                      <Link to={`/orders?search=${o.orderNumber}`}>#{o.orderNumber}</Link>
                    </td>
                    <td>{o.customerName}</td>
                    <td className="muted">{formatDate(o.createdAt)}</td>
                    <td><Badge tone={STATUS_TONE[o.status] || 'muted'}>{o.status}</Badge></td>
                    <td className="right bold">{currency(o.pricing.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack gap-16">
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('dashboard.customerGrowth')}</span>
              <span className="bold">{compactNumber(growth.total)}</span>
            </div>
            <div className="card-pad" style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth.series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2ece6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5a7566" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#5a7566" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2ece6", fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} fill="#dcfce7" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('dashboard.topProducts')}</span>
              <Link to="/products" className="btn btn-ghost btn-sm">{t('common.all')}</Link>
            </div>
            <div className="card-pad stack gap-12">
              {top.map((p) => (
                <div key={p._id} className="row gap-12">
                  <img className="thumb" src={p.images?.[0]} alt="" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small bold truncate">{p.name}</div>
                    <div className="tiny muted">{p.soldCount} sold · {p.stock} in stock</div>
                  </div>
                  <span className="small bold">{currency(p.price)}</span>
                </div>
              ))}
              {top.length === 0 ? <p className="muted small">{t('products.empty')}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
