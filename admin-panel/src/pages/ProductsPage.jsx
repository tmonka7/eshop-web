import { useCallback, useEffect, useState } from 'react';
import { productApi, categoryApi, uploadApi, visualSearchApi } from '../api';
import { Badge, ConfirmModal, Empty, Modal, Pagination, Spinner, Switch } from '../components/ui';
import {
  Plus, Search, Edit, Trash, Boxes, X, Refresh, Image as ImageIcon,
} from '../components/Icons';
import TranslationFields from '../components/TranslationFields';
import VisualIndexBar from '../components/VisualIndexBar';
import { useToastStore } from '../store';
import { currency } from '../utils/format';
import { CURRENCIES } from '../utils/constants';
import { useI18n } from '../i18n';

// The fields below are the canonical English copy; `translations` carries the
// zh and ja versions and is edited in the block at the bottom of the form.
const emptyProduct = {
  name: '',
  brand: '',
  category: '',
  price: '',
  currency: 'USD',
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
  translations: {},
};

/** Badge tone for each DINOv3 index state (see VISUAL_INDEX_STATUS on the API). */
const VISUAL_TONES = {
  indexed: 'ok',
  partial: 'warn',
  pending: 'info',
  no_images: 'muted',
  failed: 'danger',
  unavailable: 'danger',
};

/** Which of the translatable fields a product actually carries. */
const TRANSLATED_FIELDS = ['name', 'shortDescription', 'description'];

export default function ProductsPage() {
  const { t } = useI18n();
  const toast = useToastStore();

  function stockBadge(stock) {
    if (stock <= 0) return <Badge tone="danger">{t('products.outOfStock')}</Badge>;
    if (stock <= 10) return <Badge tone="warn">{t('products.lowStock')}</Badge>;
    return <Badge tone="ok">{t('products.inStock')}</Badge>;
  }

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
  const [reindexing, setReindexing] = useState(null);

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
      currency: p.currency || 'USD',
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
      // Admin responses carry the whole sub-document, so it round-trips intact.
      translations: p.translations || {},
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = t('products.nameRequired');
    if (!form.category) next.category = t('products.pickCategory');
    if (form.price === '' || Number(form.price) < 0) next.price = t('products.invalidPrice');
    if (form.stock === '' || Number(form.stock) < 0) next.stock = t('products.invalidStock');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(e) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || 'Generic',
      translations: form.translations,
      category: form.category,
      price: Number(form.price),
      currency: form.currency,
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
      let res;
      if (editing) {
        res = await productApi.update(editing._id, payload);
        toast.success(t('products.updated'));
      } else {
        res = await productApi.create(payload);
        toast.success(t('products.created'));
      }
      // Saving never fails because of image search, so say when the product
      // did not make it into the index.
      const visual = res.data?.visualIndex?.status;
      if (['failed', 'partial', 'unavailable'].includes(visual)) {
        toast.error(t('visualIndex.saveWarning', { status: t(`visualIndex.status.${visual}`) }));
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

  async function reindexProduct(p) {
    setReindexing(p._id);
    try {
      const res = await visualSearchApi.reindexProduct(p._id);
      const { visualIndex } = res.data;
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, visualIndex } : x)));
      if (visualIndex.status === 'indexed') toast.success(res.message);
      else toast.error(visualIndex.error || t(`visualIndex.status.${visualIndex.status}`));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReindexing(null);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await productApi.remove(deleteTarget._id);
      toast.success(t('products.deleted'));
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
          <h1>{t('products.title')}</h1>
          <p>{t('products.headCount', { total: pagination.total })}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> {t('products.add')}
        </button>
      </div>

      <VisualIndexBar onFinished={load} />

      <div className="card">
        <div className="card-header">
          <div className="search-box" style={{ minWidth: 240 }}>
            <Search size={15} />
            <input
              className="input"
              placeholder={t('products.searchPlaceholder')}
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
              <option value="">{t('products.allCategories')}</option>
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
              <option value="">{t('products.allStatus')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
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
              <option value="">{t('products.allStock')}</option>
              <option value="low">{t('inventory.lowStock')}</option>
              <option value="out">{t('inventory.outOfStock')}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : products.length === 0 ? (
          <Empty
            icon={<Boxes size={26} />}
            title={t('products.emptyTitle')}
            message={t('products.emptyMessage')}
            action={(
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                {t('products.add')}
              </button>
            )}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('common.image')}</th>
                    <th>{t('common.name')}</th>
                    <th>{t('common.category')}</th>
                    <th className="right">{t('common.price')}</th>
                    <th className="right">{t('common.stock')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.active')}</th>
                    <th>{t('visualIndex.column')}</th>
                    <th className="right">{t('common.actions')}</th>
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
                        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                          {/* The code is spelled out beside every figure, not
                              just colour-coded: two currencies that cannot be
                              converted must never be told apart by hue alone. */}
                          <span className={`currency-tag currency-${(p.currency || 'USD').toLowerCase()}`}>
                            {p.currency || 'USD'}
                          </span>
                          <span className="bold">{currency(p.price, p.currency)}</span>
                        </div>
                        {p.comparePrice > p.price ? (
                          <div className="tiny muted" style={{ textDecoration: 'line-through' }}>
                            {currency(p.comparePrice, p.currency)}
                          </div>
                        ) : null}
                      </td>
                      <td className="right bold">{p.stock}</td>
                      <td>{stockBadge(p.stock)}</td>
                      <td>
                        <Switch checked={p.isActive} onChange={(v) => toggleStatus(p, v)} />
                      </td>
                      <td>
                        <VisualIndexCell index={p.visualIndex} t={t} />
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => reindexProduct(p)}
                            disabled={reindexing === p._id}
                            aria-label={t('visualIndex.reindexAria')}
                            title={t('visualIndex.reindexAria')}
                          >
                            <Refresh size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => openEdit(p)}
                            aria-label={t('products.editAria')}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger-ghost btn-icon"
                            onClick={() => setDeleteTarget(p)}
                            aria-label={t('products.deleteAria')}
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
        title={editing ? t('products.editTitle', { name: editing.name }) : t('products.add')}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>
              {saving
                ? t('common.saving')
                : editing ? t('common.saveChanges') : t('products.create')}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={save}>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="p-name">{t('products.nameField')}</label>
              <input
                id="p-name"
                className={`input ${errors.name ? 'has-error' : ''}`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {errors.name ? <span className="field-error">{errors.name}</span> : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-brand">{t('common.brand')}</label>
              <input
                id="p-brand"
                className="input"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-cat">{t('products.categoryField')}</label>
            <select
              id="p-cat"
              className={`select ${errors.category ? 'has-error' : ''}`}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">{t('products.selectCategory')}</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {errors.category ? <span className="field-error">{errors.category}</span> : null}
          </div>

          {/* Listing currency. The two are separate price universes - there is
              no rate between them - so this choice decides what every figure
              below means, which is why it sits above them rather than beside
              the cost field. */}
          <div className="field">
            <span className="field-label">{t('products.currencyField')}</span>
            <div className="currency-choice">
              {CURRENCIES.map((c) => (
                <label
                  key={c.value}
                  className={`currency-option currency-${c.value.toLowerCase()} ${
                    form.currency === c.value ? 'active' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="currency"
                    value={c.value}
                    checked={form.currency === c.value}
                    onChange={() => setForm({ ...form, currency: c.value })}
                  />
                  <span className="currency-code">{c.value}</span>
                  <span className="currency-name">{t(c.labelKey)}</span>
                </label>
              ))}
            </div>
            <span className="field-hint">{t('products.currencyHint')}</span>
          </div>

          <div className="form-row-3">
            <div className="field">
              <label className="field-label" htmlFor="p-price">{t('products.priceField')}</label>
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
              <label className="field-label" htmlFor="p-compare">{t('products.comparePrice')}</label>
              <input
                id="p-compare"
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.comparePrice}
                onChange={(e) => setForm({ ...form, comparePrice: e.target.value })}
              />
              <span className="field-hint">{t('products.comparePriceHint')}</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-cost">{t('products.cost')}</label>
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
              <label className="field-label" htmlFor="p-stock">{t('products.stockField')}</label>
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
              <label className="field-label" htmlFor="p-colors">{t('products.colors')}</label>
              <input
                id="p-colors"
                className="input"
                value={form.colors}
                onChange={(e) => setForm({ ...form, colors: e.target.value })}
                placeholder={t('products.colorsPlaceholder')}
              />
              <span className="field-hint">{t('products.commaSeparated')}</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-short">{t('products.shortDescription')}</label>
            <input
              id="p-short"
              className="input"
              maxLength={300}
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-desc">{t('products.fullDescription')}</label>
            <textarea
              id="p-desc"
              className="textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="p-tags">{t('products.tags')}</label>
            <input
              id="p-tags"
              className="input"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder={t('products.tagsPlaceholder')}
            />
          </div>

          <div className="field">
            <span className="field-label">{t('common.images')}</span>
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
                    aria-label={t('products.removeImage')}
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
            {uploading ? <span className="field-hint">{t('products.uploading')}</span> : null}
          </div>

          <div className="row gap-20 wrap">
            <label className="row gap-8 small">
              <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
              {t('common.active')}
            </label>
            <label className="row gap-8 small">
              <Switch checked={form.isFeatured} onChange={(v) => setForm({ ...form, isFeatured: v })} />
              {t('products.featured')}
            </label>
            <label className="row gap-8 small">
              <Switch checked={form.freeShipping} onChange={(v) => setForm({ ...form, freeShipping: v })} />
              {t('products.freeShipping')}
            </label>
          </div>

          <TranslationFields
            fields={TRANSLATED_FIELDS}
            value={form.translations}
            onChange={(translations) => setForm({ ...form, translations })}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('products.deleteTitle')}
        message={t('products.deleteMessage', { name: deleteTarget?.name })}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </>
  );
}

/** Per-product DINOv3 index state; the tooltip carries any extraction error. */
function VisualIndexCell({ index, t }) {
  const vi = index || { status: 'pending', vectors: 0 };
  return (
    <span title={vi.error || ''}>
      <Badge tone={VISUAL_TONES[vi.status] || 'muted'}>{t(`visualIndex.status.${vi.status}`)}</Badge>
      {vi.vectors ? (
        <span className="tiny muted" style={{ marginLeft: 6 }}>
          {t('visualIndex.vectors', { count: vi.vectors })}
        </span>
      ) : null}
    </span>
  );
}
