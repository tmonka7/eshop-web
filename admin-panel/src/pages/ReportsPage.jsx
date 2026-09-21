import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dashboardApi } from '../api';
import { Empty, Spinner, StatCard } from '../components/ui';
import { Dollar, Package, Chart, TrendUp } from '../components/Icons';
import { currency, compactNumber } from '../utils/format';
import { CHART_COLORS, RANGE_OPTIONS } from '../utils/constants';

export default function ReportsPage() {
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

  if (loading) return <Spinner label="Building reports..." />;
  if (!data) return <Empty title="Could not load reports" message="Check that the API is running." />;

  const { stats, sales, byCategory, top, growth } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Deeper analytics across revenue, catalogue and customers</p>
        </div>
        <div className="tabs">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`tab-chip ${range === r.value ? 'active' : ''}`}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-4 mb-24">
        <StatCard label="Revenue" value={currency(stats.totalRevenue.value)} delta={stats.totalRevenue.change} icon={<Dollar size={18} />} tone="red" />
        <StatCard label="Orders" value={compactNumber(stats.totalOrders.value)} delta={stats.totalOrders.change} icon={<Package size={18} />} tone="blue" />
        <StatCard label="Avg. order value" value={currency(stats.averageOrderValue)} icon={<Chart size={18} />} tone="green" />
        <StatCard label="Active products" value={stats.activeProducts} icon={<TrendUp size={18} />} tone="purple" />
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <span className="card-title">Orders per day</span>
          <span className="small muted">Order volume across the selected range</span>
        </div>
        <div className="card-pad" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sales} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d) => (d.length > 7 ? d.slice(5) : d)}
                minTickGap={24}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-2 mb-24">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenue by category</span>
          </div>
          <div className="card-pad" style={{ height: 300 }}>
            {byCategory.segments.length === 0 ? (
              <p className="muted small">No sales in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byCategory.segments}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => compactNumber(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(value) => currency(value)}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" radius={[0, 5, 5, 0]} barSize={18}>
                    {byCategory.segments.map((seg, i) => (
                      <Cell key={seg.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">New customers per month</span>
            <span className="bold">{compactNumber(growth.total)} total</span>
          </div>
          <div className="card-pad" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth.series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="count" fill="#10b981" radius={[5, 5, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Best selling products</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="right">Price</th>
                <th className="right">Units sold</th>
                <th className="right">Revenue</th>
                <th className="right">Stock left</th>
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
