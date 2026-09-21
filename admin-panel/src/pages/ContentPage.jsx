import { useCallback, useEffect, useState } from 'react';
import { bannerApi, uploadApi } from '../api';
import { Badge, ConfirmModal, Empty, Modal, Spinner, Switch } from '../components/ui';
import { Plus, Edit, Trash, Image as ImageIcon } from '../components/Icons';
import TranslationFields from '../components/TranslationFields';
import { useToastStore } from '../store';
import { useI18n } from '../i18n';

// The canonical fields stay English; `translations` carries zh and ja.
const emptyBanner = {
  title: '',
  subtitle: '',
  image: '',
  ctaText: 'Shop Now',
  ctaLink: '/products',
  placement: 'hero',
  order: 0,
  isActive: true,
  translations: {},
};

/** Which of the translatable fields a banner actually carries. */
const TRANSLATED_FIELDS = ['title', 'subtitle', 'ctaText'];

const PLACEMENTS = [
  { value: 'hero', labelKey: 'content.homepageHero' },
  { value: 'promo', labelKey: 'content.promoStrip' },
  { value: 'mobile', labelKey: 'content.mobileApp' },
];

export default function ContentPage() {
  const { t } = useI18n();
  const toast = useToastStore();

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyBanner);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    bannerApi
      .list()
      .then((res) => setBanners(res.data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(load, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyBanner);
    setModalOpen(true);
  }

  function openEdit(b) {
    setEditing(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle || '',
      image: b.image || '',
      ctaText: b.ctaText || 'Shop Now',
      ctaLink: b.ctaLink || '/products',
      placement: b.placement,
      order: b.order || 0,
      isActive: b.isActive,
      translations: b.translations || {},
    });
    setModalOpen(true);
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadApi.banner(file);
      setForm((f) => ({ ...f, image: res.data[0].url }));
      toast.success(t('products.imageUploaded'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, order: Number(form.order) || 0 };
      if (editing) {
        await bannerApi.update(editing._id, payload);
        toast.success(t('content.updated'));
      } else {
        await bannerApi.create(payload);
        toast.success(t('content.created'));
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
      await bannerApi.remove(deleteTarget._id);
      toast.success(t('content.deleted'));
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
          <h1>{t('content.title')}</h1>
          <p>{t('content.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : banners.length === 0 ? (
        <div className="card">
          <Empty
            icon={<ImageIcon size={26} />}
            title={t('content.emptyTitle')}
            action={(
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                {t('content.createOne')}
              </button>
            )}
          />
        </div>
      ) : (
        <div className="grid grid-3">
          {banners.map((b) => (
            <div key={b._id} className="card">
              <div
                style={{
                  height: 140,
                  background: 'var(--ink-100)',
                  borderRadius: 'var(--radius) var(--radius) 0 0',
                  overflow: 'hidden',
                }}
              >
                {b.image ? (
                  <img src={b.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="row center muted" style={{ height: '100%', justifyContent: 'center' }}>
                    <ImageIcon size={24} />
                  </div>
                )}
              </div>
              <div className="card-pad">
                <div className="row between mb-8">
                  <Badge tone="info">
                    {(() => {
                      const hit = PLACEMENTS.find((p) => p.value === b.placement);
                      return hit ? t(hit.labelKey) : b.placement;
                    })()}
                  </Badge>
                  <Badge tone={b.isActive ? 'ok' : 'muted'}>
                    {b.isActive ? t('content.live') : t('content.hidden')}
                  </Badge>
                </div>
                <div className="bold">{b.title}</div>
                <div className="small muted">{b.subtitle}</div>
                <div className="tiny muted mt-8">{b.ctaText} → {b.ctaLink}</div>
                <div className="row gap-8 mt-16">
                  <button type="button" className="btn btn-outline btn-sm grow" onClick={() => openEdit(b)}>
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => setDeleteTarget(b)}
                    aria-label={t('content.deleteBannerAria')}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? t('content.editTitle', { name: editing.title }) : t('content.add')}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="banner-form" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </>
        }
      >
        <form id="banner-form" onSubmit={save}>
          <div className="field">
            <label className="field-label" htmlFor="b-title">{t('content.titleRequired')}</label>
            <input
              id="b-title"
              className="input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="b-sub">{t('content.subtitleField')}</label>
            <input
              id="b-sub"
              className="input"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="b-cta">{t('content.buttonText')}</label>
              <input
                id="b-cta"
                className="input"
                value={form.ctaText}
                onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="b-link">{t('content.buttonLink')}</label>
              <input
                id="b-link"
                className="input"
                value={form.ctaLink}
                onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                placeholder="/products?category=electronics"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="b-place">{t('content.placement')}</label>
              <select
                id="b-place"
                className="select"
                value={form.placement}
                onChange={(e) => setForm({ ...form, placement: e.target.value })}
              >
                {PLACEMENTS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="b-order">{t('content.sortOrder')}</label>
              <input
                id="b-order"
                type="number"
                className="input"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">{t('common.image')}</span>
            {form.image ? (
              <img
                src={form.image}
                alt=""
                style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
              />
            ) : null}
            <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files[0])} disabled={uploading} />
            {uploading ? <span className="field-hint">{t('content.uploading')}</span> : null}
          </div>

          <label className="row gap-8 small">
            <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
            {t('content.live')}
          </label>

          <TranslationFields
            fields={TRANSLATED_FIELDS}
            value={form.translations}
            onChange={(translations) => setForm({ ...form, translations })}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('content.deleteTitle')}
        message={t('content.deleteMessage', { name: deleteTarget?.title })}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </>
  );
}
