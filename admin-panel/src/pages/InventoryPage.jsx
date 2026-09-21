import { useCallback, useEffect, useState } from 'react';
import { inventoryApi, productApi } from '../api';
import { Badge, Empty, Pagination, Spinner, StatCard } from '../components/ui';
import { AlertTriangle, Boxes, Check, Package } from '../components/Icons';
import { useToastStore } from '../store';
import { currency } from '../utils/format';

export default function InventoryPage() {
  const toast = useToastStore();

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ lowStock: 0, outOfStock: 0, threshold: 10 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .alerts({ page, limit: 20 })
      .then((res) => {
        setItems(res.data);
        setSummary(res.summary);
        setPagination(res.pagination);
        setDrafts(Object.fromEntries(res.data.map((p) => [p._id, p.stock])));
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(load, [load]);

  async function saveStock(product) {
    const stock = Number(drafts[product._id]);
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error('Enter a stock number of 0 or more');
      return;
    }
    setSavingId(product._id);
    try {
      await productApi.updateStock(product._id, stock);
      toast.success(`${product.name} restocked to ${stock}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <p>Products at or below {summary.threshold} units</p>
        </div>
      </div>

      <div className="grid grid-3 mb-24">
        <StatCard
          label="Out of stock"
          value={summary.outOfStock}
          icon={<AlertTriangle size={18} />}
          tone="red"
        />
        <StatCard
          label="Low stock"
          value={summary.lowStock}
          icon={<Boxes size={18} />}
          tone="amber"
        />
        <StatCard
          label="Needs attention"
          value={pagination.total}
          icon={<Package size={18} />}
          tone="blue"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Restock list</span>
          <span className="small muted">Edit a number and press Save to update stock</span>
        </div>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty
            icon={<Check size={26} />}
            title="Everything is well stocked"
            message="No product is below the low-stock threshold."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="right">Price</th>
                    <th className="right">Current</th>
                    <th>Status</th>
                    <th style={{ width: 210 }}>New stock</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div className="row gap-8">
                          <img className="thumb" src={p.images?.[0]} alt="" />
                          <div>
                            <div className="bold truncate" style={{ maxWidth: 220 }}>{p.name}</div>
                            <div className="tiny muted">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{p.category?.name || '-'}</td>
                      <td className="right">{currency(p.price)}</td>
                      <td className="right bold">{p.stock}</td>
                      <td>
                        {p.stock <= 0
                          ? <Badge tone="danger">Out of Stock</Badge>
                          : <Badge tone="warn">Low Stock</Badge>}
                      </td>
                      <td>
                        <div className="row gap-6">
                          <input
                            type="number"
                            min="0"
                            className="input"
                            value={drafts[p._id] ?? p.stock}
                            onChange={(e) => setDrafts({ ...drafts, [p._id]: e.target.value })}
                            style={{ width: 90 }}
                            aria-label={`Stock for ${p.name}`}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => saveStock(p)}
                            disabled={savingId === p._id}
                          >
                            {savingId === p._id ? 'Saving…' : 'Save'}
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
    </>
  );
}
