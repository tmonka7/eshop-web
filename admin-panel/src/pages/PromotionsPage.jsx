import { useCallback, useEffect, useState } from 'react';
import { couponApi } from '../api';
import { Badge, ConfirmModal, Empty, Modal, Pagination, Spinner, Switch } from '../components/ui';
import { Plus, Edit, Trash, Megaphone } from '../components/Icons';
import { useToastStore } from '../store';
import { useI18n } from '../i18n';
import { currency, formatDate } from '../utils/format';

const emptyCoupon = {
  code: '',
  description: '',
  discountType: 'percent',
  discountValue: '',
  minPurchase: '',
  maxDiscount: '',
  usageLimit: '',
  expiresAt: '',
  isActive: true,
};

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export default function PromotionsPage() {
  const { t } = useI18n();
  const toast = useToastStore();

  const [coupons, setCoupons] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCoupon);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    couponApi
      .list({ page, limit: 20 })
      .then((res) => {
        setCoupons(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(load, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyCoupon);
    setModalOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description || '',
      discountType: c.discountType,
      discountValue: c.discountValue,
      minPurchase: c.minPurchase || '',
      maxDiscount: c.maxDiscount || '',
      usageLimit: c.usageLimit || '',
      expiresAt: toDateInput(c.expiresAt),
      isActive: c.isActive,
    });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minPurchase: form.minPurchase === '' ? 0 : Number(form.minPurchase),
        maxDiscount: form.maxDiscount === '' ? 0 : Number(form.maxDiscount),
        usageLimit: form.usageLimit === '' ? 0 : Number(form.usageLimit),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isActive: form.isActive,
      };
      if (editing) {
        await couponApi.update(editing._id, payload);
        toast.success(t('promotions.updated'));
      } else {
        await couponApi.create(payload);
        toast.success(t('promotions.created'));
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
      await couponApi.remove(deleteTarget._id);
      toast.success(t('promotions.deleted'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const isExpired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('promotions.title')}</h1>
          <p>{t('promotions.headCount', { total: pagination.total })}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> {t('promotions.add')}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : coupons.length === 0 ? (
          <Empty
            icon={<Megaphone size={26} />}
            title={t('promotions.emptyTitle')}
            action={(
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                {t('promotions.createOne')}
              </button>
            )}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('common.code')}</th>
                    <th>{t('orders.discount')}</th>
                    <th className="right">{t('promotions.minPurchase')}</th>
                    <th className="right">{t('common.used')}</th>
                    <th>{t('common.expires')}</th>
                    <th>{t('common.status')}</th>
                    <th className="right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <div className="bold">{c.code}</div>
                        <div className="tiny muted truncate" style={{ maxWidth: 220 }}>{c.description}</div>
                      </td>
                      <td className="bold">
                        {c.discountType === 'percent' ? `${c.discountValue}%` : currency(c.discountValue)}
                        {c.maxDiscount > 0 && c.discountType === 'percent' ? (
                          <span className="tiny muted">
                            {' '}
                            {t('promotions.maxParen', { amount: currency(c.maxDiscount) })}
                          </span>
                        ) : null}
                      </td>
                      <td className="right">{c.minPurchase ? currency(c.minPurchase) : '—'}</td>
                      <td className="right">
                        {c.usedCount}
                        {c.usageLimit > 0 ? <span className="muted"> / {c.usageLimit}</span> : null}
                      </td>
                      <td className="muted">{c.expiresAt ? formatDate(c.expiresAt) : t('common.never')}</td>
                      <td>
                        {isExpired(c) ? (
                          <Badge tone="danger">{t('promotions.expired')}</Badge>
                        ) : (
                          <Badge tone={c.isActive ? 'ok' : 'muted'}>
                            {c.isActive ? t('common.active') : t('promotions.paused')}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(c)} aria-label={t('promotions.editAria')}>
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger-ghost btn-icon"
                            onClick={() => setDeleteTarget(c)}
                            aria-label={t('promotions.deleteAria')}
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
        title={editing ? t('promotions.editTitle', { code: editing.code }) : t('promotions.add')}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="coupon-form" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </>
        }
      >
        <form id="coupon-form" onSubmit={save}>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="co-code">{t('promotions.codeRequired')}</label>
              <input
                id="co-code"
                className="input"
                required
                minLength={3}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME10"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="co-type">{t('promotions.discountTypeRequired')}</label>
              <select
                id="co-type"
                className="select"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              >
                <option value="percent">{t('promotions.percentage')}</option>
                <option value="fixed">{t('promotions.fixedAmount')}</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="co-desc">{t('common.description')}</label>
            <input
              id="co-desc"
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('promotions.descriptionPlaceholder')}
            />
          </div>

          <div className="form-row-3">
            <div className="field">
              <label className="field-label" htmlFor="co-value">
                {t('promotions.valueRequired', {
                  unit: form.discountType === 'percent' ? '(%)' : '($)',
                })}
              </label>
              <input
                id="co-value"
                type="number"
                min="0"
                step="0.01"
                className="input"
                required
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="co-min">{t('promotions.minPurchase')}</label>
              <input
                id="co-min"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.minPurchase}
                onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="co-max">{t('promotions.maxDiscount')}</label>
              <input
                id="co-max"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
              />
              <span className="field-hint">0 = uncapped</span>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="co-limit">{t('promotions.usageLimit')}</label>
              <input
                id="co-limit"
                type="number"
                min="0"
                className="input"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              />
              <span className="field-hint">0 = unlimited</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="co-exp">{t('promotions.expiresOn')}</label>
              <input
                id="co-exp"
                type="date"
                className="input"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
          </div>

          <label className="row gap-8 small">
            <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
            {t('common.active')}
          </label>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('promotions.deleteTitle')}
        message={t('promotions.deleteMessage', { code: deleteTarget?.code })}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </>
  );
}
