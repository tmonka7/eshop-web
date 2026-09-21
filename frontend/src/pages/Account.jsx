import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { authApi, userApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { Breadcrumb, EmptyState, Badge } from '../components/ui';
import { User, MapPin, Package, Heart, Settings, LogOut, Plus, Trash, Check } from '../components/Icons';
import { formatDate } from '../utils/format';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

const emptyAddress = {
  label: 'Home',
  fullName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Finland',
};

function Profile() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToastStore();

  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userApi.updateProfile(form);
      setUser(res.data);
      toast.success(t('toast.profileUpdated'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-pad">
      <h2 style={{ fontSize: '1.1rem', marginBottom: 18 }}>{t('account.profile')}</h2>
      <form onSubmit={save} style={{ maxWidth: 480 }}>
        <div className="field">
          <label className="field-label" htmlFor="name">{t('account.fullName')}</label>
          <input
            id="name"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="email">{t('account.email')}</label>
          <input id="email" className="input" value={user?.email || ''} disabled />
          <span className="field-hint">{t('account.emailReadOnly')}</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="phone">{t('account.phone')}</label>
          <input
            id="phone"
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <span className="field-label">{t('account.preferredLanguage')}</span>
          <LanguageSwitcher />
          <span className="field-hint">{t('account.preferredLanguageHint')}</span>
        </div>
        <div className="field">
          <span className="field-label">{t('account.memberSince')}</span>
          <span className="small muted">{formatDate(user?.createdAt)}</span>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('account.saving') : t('common.saveChanges')}
        </button>
      </form>
    </div>
  );
}

function Addresses() {
  const { t } = useI18n();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore();

  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyAddress);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    userApi.addresses().then((res) => setAddresses(res.data)).catch(() => {});
  }, []);

  function sync(list) {
    setAddresses(list);
    setUser({ ...user, addresses: list });
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const res = editingId
        ? await userApi.updateAddress(editingId, form)
        : await userApi.addAddress(form);
      sync(res.data);
      setForm(emptyAddress);
      setEditingId(null);
      setShowForm(false);
      toast.success(editingId ? t('account.addressUpdated') : t('account.addressAdded'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(id) {
    try {
      const res = await userApi.deleteAddress(id);
      sync(res.data);
      toast.success(t('toast.addressRemoved'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function makeDefault(id) {
    try {
      const res = await userApi.setDefaultAddress(id);
      sync(res.data);
      toast.success(t('account.defaultAddressUpdated'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="card card-pad">
      <div className="row between mb-16">
        <h2 style={{ fontSize: '1.1rem' }}>{t('account.addresses')}</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setForm(emptyAddress);
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          <Plus size={14} /> {t('account.addAddress')}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="card card-pad mb-24" style={{ background: 'var(--ink-50)' }}>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="a-label">{t('account.addressLabel')}</label>
              <input id="a-label" className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-name">{t('account.fullNameRequired')}</label>
              <input id="a-name" className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="a-street">{t('account.streetRequired')}</label>
            <input id="a-street" className="input" required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="a-city">{t('account.cityRequired')}</label>
              <input id="a-city" className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-state">{t('account.state')}</label>
              <input id="a-state" className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="a-zip">{t('account.zipRequired')}</label>
              <input id="a-zip" className="input" required value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-country">{t('account.countryRequired')}</label>
              <input id="a-country" className="input" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="a-phone">{t('account.phone')}</label>
            <input id="a-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="row gap-8">
            <button type="submit" className="btn btn-primary">
              {editingId ? t('account.updateAddress') : t('account.saveAddress')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {addresses.length === 0 ? (
        <p className="muted">{t('account.noAddresses')}</p>
      ) : (
        addresses.map((a) => (
          <div key={a._id} className={`address-option ${a.isDefault ? 'active' : ''}`}>
            <div className="row between wrap gap-12">
              <div>
                <div className="row gap-8">
                  <span className="bold small">{a.label || t('account.addressFallbackLabel')}</span>
                  {a.isDefault ? <Badge tone="ok"><Check size={11} /> {t('common.default')}</Badge> : null}
                </div>
                <div className="small">{a.fullName}</div>
                <div className="small muted">{a.street}, {a.city} {a.zipCode}, {a.country}</div>
                {a.phone ? <div className="tiny muted">{a.phone}</div> : null}
              </div>
              <div className="row gap-8">
                {!a.isDefault ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => makeDefault(a._id)}>
                    {t('account.makeDefault')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setForm({ ...emptyAddress, ...a });
                    setEditingId(a._id);
                    setShowForm(true);
                  }}
                >
                  {t('common.edit')}
                </button>
                <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => remove(a._id)}>
                  <Trash size={14} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SecuritySettings() {
  const { t } = useI18n();
  const toast = useToastStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast.error(t('account.passwordsDoNotMatch'));
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success(t('account.passwordChanged'));
      await logout();
      navigate('/login');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-pad">
      <h2 style={{ fontSize: '1.1rem', marginBottom: 18 }}>{t('account.security')}</h2>
      <form onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="field">
          <label className="field-label" htmlFor="cur">{t('account.currentPassword')}</label>
          <input
            id="cur"
            type="password"
            className="input"
            required
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new">{t('account.newPassword')}</label>
          <input
            id="new"
            type="password"
            className="input"
            required
            minLength={6}
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="confirm">{t('account.confirmNewPassword')}</label>
          <input
            id="confirm"
            type="password"
            className="input"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('account.updating') : t('account.changePassword')}
        </button>
      </form>
    </div>
  );
}

export default function Account() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const resetCart = useCartStore((s) => s.reset);
  const navigate = useNavigate();

  const links = [
    { to: '/account', end: true, icon: <User size={16} />, label: t('account.tabProfile') },
    { to: '/account/addresses', icon: <MapPin size={16} />, label: t('account.tabAddresses') },
    { to: '/orders', icon: <Package size={16} />, label: t('orders.title') },
    { to: '/wishlist', icon: <Heart size={16} />, label: t('wishlist.breadcrumb') },
    { to: '/account/settings', icon: <Settings size={16} />, label: t('account.tabSecurity') },
  ];

  async function handleLogout() {
    await logout();
    resetCart();
    navigate('/');
  }

  return (
    <div className="container">
      <Breadcrumb items={[{ label: t('common.home'), to: '/' }, { label: t('account.breadcrumb') }]} />

      <div className="account-layout">
        <aside>
          <div className="card card-pad mb-16">
            <div className="row gap-12">
              <span className="review-avatar" style={{ width: 46, height: 46 }}>
                {(user?.name || '?').charAt(0)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="bold small truncate">{user?.name}</div>
                <div className="tiny muted truncate">{user?.email}</div>
              </div>
            </div>
          </div>

          <nav className="card card-pad account-nav stack gap-4">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.icon} {l.label}
              </NavLink>
            ))}
            <button type="button" className="btn btn-danger-ghost btn-sm mt-8" onClick={handleLogout}>
              <LogOut size={15} /> {t('header.signOut')}
            </button>
          </nav>
        </aside>

        <section>
          <Routes>
            <Route index element={<Profile />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="settings" element={<SecuritySettings />} />
            <Route
              path="*"
              element={
                <EmptyState
                  title={t('account.pageNotFound')}
                  action={<Link to="/account" className="btn btn-primary">{t('account.backToAccount')}</Link>}
                />
              }
            />
          </Routes>
        </section>
      </div>
    </div>
  );
}
