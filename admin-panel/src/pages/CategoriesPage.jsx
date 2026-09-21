import { useCallback, useEffect, useState } from 'react';
import { categoryApi } from '../api';
import { ConfirmModal, Empty, Modal, Spinner, Switch, Badge } from '../components/ui';
import { Plus, Edit, Trash, Layers } from '../components/Icons';
import { useToastStore } from '../store';

const emptyCategory = { name: '', description: '', icon: 'tag', parent: '', order: 0, isActive: true };

export default function CategoriesPage() {
  const toast = useToastStore();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCategory);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    categoryApi
      .list()
      .then((res) => setCategories(res.data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(load, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyCategory);
    setModalOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description || '',
      icon: c.icon || 'tag',
      parent: c.parent || '',
      order: c.order || 0,
      isActive: c.isActive,
    });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, parent: form.parent || null, order: Number(form.order) || 0 };
      if (editing) {
        await categoryApi.update(editing._id, payload);
        toast.success('Category updated');
      } else {
        await categoryApi.create(payload);
        toast.success('Category created');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await categoryApi.remove(deleteTarget._id);
      toast.success('Category deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const nameById = new Map(categories.map((c) => [String(c._id), c.name]));
  const roots = categories.filter((c) => !c.parent);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Categories</h1>
          <p>{categories.length} categories, {roots.length} top-level</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : categories.length === 0 ? (
          <Empty icon={<Layers size={26} />} title="No categories yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Parent</th>
                  <th className="right">Products</th>
                  <th className="right">Order</th>
                  <th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="row gap-8">
                        {c.image ? <img className="thumb" src={c.image} alt="" /> : null}
                        <span className="bold">{c.name}</span>
                      </div>
                    </td>
                    <td className="muted">{c.slug}</td>
                    <td className="muted">{c.parent ? nameById.get(String(c.parent)) || '-' : '—'}</td>
                    <td className="right bold">{c.productCount ?? 0}</td>
                    <td className="right muted">{c.order}</td>
                    <td>
                      <Badge tone={c.isActive ? 'ok' : 'muted'}>{c.isActive ? 'Active' : 'Hidden'}</Badge>
                    </td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(c)} aria-label="Edit">
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-icon"
                          onClick={() => setDeleteTarget(c)}
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
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit: ${editing.name}` : 'Add Category'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="category-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={save}>
          <div className="field">
            <label className="field-label" htmlFor="c-name">Name *</label>
            <input
              id="c-name"
              className="input"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <span className="field-hint">The URL slug is generated from the name.</span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="c-desc">Description</label>
            <input
              id="c-desc"
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="c-parent">Parent category</label>
              <select
                id="c-parent"
                className="select"
                value={form.parent}
                onChange={(e) => setForm({ ...form, parent: e.target.value })}
              >
                <option value="">None (top level)</option>
                {roots
                  .filter((c) => !editing || c._id !== editing._id)
                  .map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="c-order">Sort order</label>
              <input
                id="c-order"
                type="number"
                className="input"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
              />
            </div>
          </div>

          <label className="row gap-8 small">
            <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
            Visible on the storefront
          </label>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete category"
        message={`Delete “${deleteTarget?.name}”? Categories that still hold products or sub-categories cannot be removed.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </>
  );
}
