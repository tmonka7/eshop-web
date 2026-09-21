import { useCallback, useEffect, useState } from 'react';
import { productApi, categoryApi, uploadApi } from '../api';
import { Badge, ConfirmModal, Empty, Modal, Pagination, Spinner, Switch } from '../components/ui';
import { Plus, Search, Edit, Trash, Boxes, X, Image as ImageIcon } from '../components/Icons';
import { useToastStore } from '../store';
import { currency } from '../utils/format';

const emptyProduct = {
  name: '',
  brand: '',
  category: '',
  price: '',
  comparePrice: '',
  cost: '',
  stock: '',
  shortDescription: '',
  description: '',
  images: [],
  tags: '',
  colors: '',
  isActive: true,
  isFeatured: false,
  freeShipping: false,
};

function stockBadge(stock) {
  if (stock <= 0) return <Badge tone="danger">Out of Stock</Badge>;
  if (stock <= 10) return <Badge tone="warn">Low Stock</Badge>;
  return <Badge tone="ok">In Stock</Badge>;
}

export default function ProductsPage() {
  const toast = useToastStore();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ search: '', category: '', status: '', stock: '' });
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    productApi
      .list({ ...filters, page, limit: 20 })
      .then((res) => {
        setProducts(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  useEffect(() => {
    categoryApi.list().then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  // Debounce so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 260);
    return () => clearTimeout(timer);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyProduct, category: categories[0]?._id || '' });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyProduct);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name,
      brand: p.brand,
      category: p.category?._id || p.category,
      price: p.price,
      comparePrice: p.comparePrice || '',
      cost: p.cost || '',
      stock: p.stock,
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      images: p.images || [],
      tags: (p.tags || []).join(', '),
      colors: (p.colors || []).join(', '),
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      freeShipping: p.freeShipping,
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Product name is required';
    if (!form.category) next.category = 'Pick a category';
    if (form.price === '' || Number(form.price) < 0) next.price = 'Enter a valid price';
    if (form.stock === '' || Number(form.stock) < 0) next.stock = 'Enter a valid stock count';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(e) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || 'Generic',
      category: form.category,
      price: Number(form.price),
      comparePrice: form.comparePrice === '' ? 0 : Number(form.comparePrice),
      cost: form.cost === '' ? 0 : Number(form.cost),
      stock: Number(form.stock),
      shortDescription: form.shortDescription,
      description: form.description,
      images: form.images,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      colors: form.colors.split(',').map((c) => c.trim()).filter(Boolean),
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      freeShipping: form.freeShipping,
    };

    setSaving(true);
    try {
      if (editing) {
        await productApi.update(editing._id, payload);
        toast.success('Product updated');
      } else {
        await productApi.create(payload);
        toast.success('Product created');
      }
      closeModal();
      setPage(1);
      load();
    } catch (err) {
      toast.error(err.message);
      if (err.errors) setErrors(Object.fromEntries(err.errors.map((x) => [x.field, x.message])));
    } finally {
      setSaving(false);
    }
  }

  async function uploadImages(files) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const res = await uploadApi.products(files);
      setForm((f) => ({ ...f, images: [...f.images, ...res.data.map((x) => x.url)] }));
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleStatus(p, isActive) {
    // Optimistic: flip locally, roll back if the API rejects it.
    setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, isActive } : x)));
    try {
      await productApi.toggleStatus(p._id, isActive);
    } catch (err) {
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, isActive: !isActive } : x)));
      toast.error(err.message);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await productApi.remove(deleteTarget._id);
      toast.success('Product deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products Management</h1>
          <p>{pagination.total} product(s) in the catalogue</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box" style={{ minWidth: 240 }}>
            <Search size={15} />
            <input
              className="input"
              placeholder="Search products…"
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
            />
          </div>

          <div className="row gap-8 wrap">
            <select
              className="select"
              value={filters.category}
              onChange={(e) => {
                setFilters({ ...filters, category: e.target.value });
                setPage(1);
              }}
              style={{ width: 170 }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c.slug}>{c.name}</option>
              ))}
            </select>

            <select
              className="select"
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
              style={{ width: 150 }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              className="select"
              value={filters.stock}
              onChange={(e) => {
                setFilters({ ...filters, stock: e.target.value });
                setPage(1);
              }}
              style={{ width: 150 }}
            >
              <option value="">All Stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : products.length === 0 ? (
          <Empty
            icon={<Boxes size={26} />}
            title="No products found"
            message="Adjust the filters or add your first product."
            action={<button type="button" className="btn btn-primary" onClick={openCreate}>Add Product</button>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th className="right">Price</th>
                    <th className="right">Stock</th>
                    <th>Status</th>
                    <th>Active</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id}>
                      <td><img className="thumb" src={p.images?.[0]} alt="" /></td>
                      <td>
                        <div className="bold truncate" style={{ maxWidth: 240 }}>{p.name}</div>
                        <div className="tiny muted">{p.brand} · {p.sku}</div>
                      </td>
                      <td className="muted">{p.category?.name || '-'}</td>
                      <td className="right">
                        <div className="bold">{currency(p.price)}</div>
                        {p.comparePrice > p.price ? (
                          <div className="tiny muted" style={{ textDecoration: 'line-through' }}>
                            {currency(p.comparePrice)}
                          </div>
                        ) : null}
                      </td>
                      <td className="right bold">{p.stock}</td>
                      <td>{stockBadge(p.stock)}</td>
                      <td>
                        <Switch checked={p.isActive} onChange={(v) => toggleStatus(p, v)} />
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => openEdit(p)}
                            aria-label="Edit"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger-ghost btn-icon"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Delete"
                          >
                            <Trash size={15} />
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
        open={modalOpen}
        wide
        title={editing ? `Edit: ${editing.name}` : 'Add Product'}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={save}>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="p-name">Product name *</label>
              <input
                id="p-name"
                className={`input ${errors.name ? 'has-error' : ''}`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {errors.name ? <span className="field-error">{errors.name}</span> : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-brand">Brand</label>
              <input
                id="p-brand"
                className="input"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-cat">Category *</label>
            <select
              id="p-cat"
              className={`select ${errors.category ? 'has-error' : ''}`}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {errors.category ? <span className="field-error">{errors.category}</span> : null}
          </div>

          <div className="form-row-3">
            <div className="field">
              <label className="field-label" htmlFor="p-price">Price *</label>
              <input
                id="p-price"
                type="number"
                step="0.01"
                min="0"
                className={`input ${errors.price ? 'has-error' : ''}`}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              {errors.price ? <span className="field-error">{errors.price}</span> : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-compare">Compare at</label>
              <input
                id="p-compare"
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.comparePrice}
                onChange={(e) => setForm({ ...form, comparePrice: e.target.value })}
              />
              <span className="field-hint">Shown struck through</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-cost">Cost</label>
              <input
                id="p-cost"
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="p-stock">Stock *</label>
              <input
                id="p-stock"
                type="number"
                min="0"
                className={`input ${errors.stock ? 'has-error' : ''}`}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
              {errors.stock ? <span className="field-error">{errors.stock}</span> : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-colors">Colors</label>
              <input
                id="p-colors"
                className="input"
                value={form.colors}
                onChange={(e) => setForm({ ...form, colors: e.target.value })}
                placeholder="Black, Red, White"
              />
              <span className="field-hint">Comma separated</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-short">Short description</label>
            <input
              id="p-short"
              className="input"
              maxLength={300}
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-desc">Full description</label>
            <textarea
              id="p-desc"
              className="textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-tags">Tags</label>
            <input
              id="p-tags"
              className="input"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="audio, wireless, best-seller"
            />
          </div>

          <div className="field">
            <span className="field-label">Images</span>
            <div className="row gap-8 wrap mb-8">
              {form.images.map((src) => (
                <div key={src} style={{ position: 'relative' }}>
                  <img
                    src={src}
                    alt=""
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, background: 'var(--ink-100)' }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    style={{ position: 'absolute', top: -7, right: -7, width: 22, height: 22 }}
                    onClick={() => setForm((f) => ({ ...f, images: f.images.filter((i) => i !== src) }))}
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {form.images.length === 0 ? (
                <div
                  className="row center muted"
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    border: '1px dashed var(--border)',
                    justifyContent: 'center',
                  }}
                >
                  <ImageIcon size={20} />
                </div>
              ) : null}
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => uploadImages(e.target.files)}
              disabled={uploading}
            />
            {uploading ? <span className="field-hint">Uploading…</span> : null}
          </div>

          <div className="row gap-20 wrap">
            <label className="row gap-8 small">
              <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
              Active
            </label>
            <label className="row gap-8 small">
              <Switch checked={form.isFeatured} onChange={(v) => setForm({ ...form, isFeatured: v })} />
              Featured
            </label>
            <label className="row gap-8 small">
              <Switch checked={form.freeShipping} onChange={(v) => setForm({ ...form, freeShipping: v })} />
              Free shipping
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete product"
        message={`Delete “${deleteTarget?.name}”? Its reviews are removed too. This cannot be undone.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </>
  );
}
