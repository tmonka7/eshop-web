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

export default function DashboardPage() {
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

  if (loading) return <Spinner label="Loading dashboard..." />;

  if (!data) {
    return (
      <Empty
        title="Could not load the dashboard"
        message="Check that the API is running and try again."
      />
    );
  }

  const { stats, sales, byCategory, recent, top, growth } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Store performance at a glance</p>
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
        <StatCard
          label="Total Revenue"
          value={currency(stats.totalRevenue.value)}
          delta={stats.totalRevenue.change}
          icon={<Dollar size={18} />}
          tone="red"
        />
        <StatCard
          label="Total Orders"
          value={compactNumber(stats.totalOrders.value)}
          delta={stats.totalOrders.change}
          icon={<Package size={18} />}
          tone="blue"
        />
        <StatCard
          label="Total Customers"
          value={compactNumber(stats.totalCustomers.value)}
          delta={stats.totalCustomers.change}
          icon={<Users size={18} />}
          tone="green"
        />
        <StatCard
          label="Conversion Rate"
          value={`${stats.conversionRate.value}%`}
          delta={stats.conversionRate.change}
          icon={<TrendUp size={18} />}
          tone="purple"
        />
      </div>

      <div className="grid grid-2-1 mb-24">
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">Sales Overview</span>
              <div className="tiny muted">Revenue per day in the selected range</div>
            </div>
            <span className="bold">{currency(stats.totalRevenue.value)}</span>
          </div>
          <div className="card-pad" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => (d.length > 7 ? d.slice(5) : d)}
                  minTickGap={22}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => compactNumber(v)}
                />
                <Tooltip
                  formatter={(value, name) => (name === 'revenue' ? currency(value) : value)}
                  labelFormatter={(l) => `Date: ${l}`}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#ef4444"
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
              <span className="card-title">Sales by Category</span>
              <div className="tiny muted">Share of revenue</div>
            </div>
          </div>
          <div className="card-pad">
            {byCategory.segments.length === 0 ? (
              <p className="muted small">No sales in this range yet.</p>
            ) : (
              <>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategory.segments}
                        dataKey="revenue"
                        nameKey="category"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {byCategory.segments.map((seg, i) => (
                          <Cell key={seg.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => currency(value)}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="center bold mb-16" style={{ fontSize: '1.15rem' }}>
                  {currency(byCategory.total)}
                </div>

                <div className="legend">
                  {byCategory.segments.slice(0, 6).map((seg, i) => (
                    <div key={seg.category} className="legend-item">
                      <span
                        className="legend-dot"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
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
            <span className="card-title">Recent Orders</span>
            <Link to="/orders" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="right">Total</th>
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
              <span className="card-title">Customer Growth</span>
              <span className="bold">{compactNumber(growth.total)}</span>
            </div>
            <div className="card-pad" style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth.series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="#d1fae5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Top Products</span>
              <Link to="/products" className="btn btn-ghost btn-sm">All</Link>
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
              {top.length === 0 ? <p className="muted small">No products yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
