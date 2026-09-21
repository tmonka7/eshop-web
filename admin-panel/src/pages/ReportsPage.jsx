import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dashboardApi } from '../api';
import { Empty, Spinner, StatCard } from '../components/ui';
import { Dollar, Package, Chart, TrendUp } from '../components/Icons';
import { currency, compactNumber, wholeNumber } from '../utils/format';
import { CHART_COLORS, RANGE_OPTIONS } from '../utils/constants';
import { useI18n } from '../i18n';

export default function ReportsPage() {
  const { t } = useI18n();
  const [range, setRange] = useState('90d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([
      dashboardApi.stats({ range }),
      dashboardApi.salesOverview({ range }),
      dashboardApi.salesByCategory({ range }),
      dashboardApi.topProducts(10),
      dashboardApi.customerGrowth({ months: 12 }),
    ])
      .then(([stats, sales, byCategory, top, growth]) => {
        if (!alive) return;
        setData({
          stats: stats.data,
          sales: sales.data,
          byCategory: byCategory.data,
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

  if (loading) return <Spinner label={t('reports.loading')} />;
  if (!data) {
    return <Empty title={t('reports.loadFailed')} message={t('reports.loadFailedMessage')} />;
  }

  const { stats, sales, byCategory, top, growth } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('reports.title')}</h1>
          <p>{t('reports.subtitle')}</p>
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
        <StatCard label={t('dashboard.revenue')} count={stats.totalRevenue.value} format={currency} delta={stats.totalRevenue.change} icon={<Dollar size={18} />} tone="green" />
        <StatCard label={t('dashboard.orders')} count={stats.totalOrders.value} format={compactNumber} delta={stats.totalOrders.change} icon={<Package size={18} />} tone="blue" />
        <StatCard label={t('dashboard.avgOrderValue')} count={stats.averageOrderValue} format={currency} icon={<Chart size={18} />} tone="green" />
        <StatCard label={t('dashboard.activeProducts')} count={stats.activeProducts} format={wholeNumber} icon={<TrendUp size={18} />} tone="purple" />
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <span className="card-title">{t('reports.ordersPerDay')}</span>
          <span className="small muted">{t('dashboard.orderVolumeSub')}</span>
        </div>
        <div className="card-pad" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sales} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2ece6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ab0a3" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d) => (d.length > 7 ? d.slice(5) : d)}
                minTickGap={24}
              />
              <YAxis tick={{ fontSize: 11, fill: "#9ab0a3" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2ece6", fontSize: 12 }} />
              <Line type="monotone" dataKey="orders" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-2 mb-24">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('reports.revenueByCategory')}</span>
          </div>
          <div className="card-pad" style={{ height: 300 }}>
            {byCategory.segments.length === 0 ? (
              <p className="muted small">{t('reports.noSalesInRange')}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byCategory.segments}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2ece6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9ab0a3" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => compactNumber(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "#4b6557" }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(value) => currency(value)}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2ece6", fontSize: 12 }}
                  />
                  {/* One series, one colour. These bars are revenue-sorted, so
                      colouring them by index would encode rank rather than
                      category — and repaint every bar when the range changes.
                      The y-axis labels already carry identity. */}
                  <Bar dataKey="revenue" radius={[0, 5, 5, 0]} barSize={18} fill={CHART_COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('dashboard.newCustomersPerMonth')}</span>
            <span className="bold">{compactNumber(growth.total)} total</span>
          </div>
          <div className="card-pad" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth.series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ece6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ab0a3" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ab0a3" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2ece6", fontSize: 12 }} />
                <Bar dataKey="count" fill="#16a34a" radius={[5, 5, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('dashboard.bestSelling')}</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('common.product')}</th>
                <th className="right">{t('common.price')}</th>
                <th className="right">{t('dashboard.unitsSold')}</th>
                <th className="right">{t('dashboard.revenue')}</th>
                <th className="right">{t('dashboard.stockLeft')}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p, i) => (
                <tr key={p._id}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <div className="row gap-8">
                      <img className="thumb" src={p.images?.[0]} alt="" />
                      <span className="bold truncate" style={{ maxWidth: 260 }}>{p.name}</span>
                    </div>
                  </td>
                  <td className="right">{currency(p.price)}</td>
                  <td className="right bold">{p.soldCount}</td>
                  <td className="right bold">{currency(p.price * p.soldCount)}</td>
                  <td className="right">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
