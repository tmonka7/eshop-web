import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { authApi, userApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { Breadcrumb, EmptyState, Badge } from '../components/ui';
import { User, MapPin, Package, Heart, Settings, LogOut, Plus, Trash, Check } from '../components/Icons';
import { formatDate } from '../utils/format';

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
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-pad">
      <h2 style={{ fontSize: '1.1rem', marginBottom: 18 }}>Profile</h2>
      <form onSubmit={save} style={{ maxWidth: 480 }}>
        <div className="field">
          <label className="field-label" htmlFor="name">Full name</label>
          <input
            id="name"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" className="input" value={user?.email || ''} disabled />
          <span className="field-hint">Your email address cannot be changed.</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="phone">Phone</label>
          <input
            id="phone"
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <span className="field-label">Member since</span>
          <span className="small muted">{formatDate(user?.createdAt)}</span>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

function Addresses() {
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
      toast.success(editingId ? 'Address updated' : 'Address added');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(id) {
    try {
      const res = await userApi.deleteAddress(id);
      sync(res.data);
      toast.success('Address removed');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function makeDefault(id) {
    try {
      const res = await userApi.setDefaultAddress(id);
      sync(res.data);
      toast.success('Default address updated');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="card card-pad">
      <div className="row between mb-16">
        <h2 style={{ fontSize: '1.1rem' }}>Addresses</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setForm(emptyAddress);
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          <Plus size={14} /> Add address
        </button>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="card card-pad mb-24" style={{ background: 'var(--ink-50)' }}>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="a-label">Label</label>
              <input id="a-label" className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-name">Full name *</label>
              <input id="a-name" className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="a-street">Street *</label>
            <input id="a-street" className="input" required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="a-city">City *</label>
              <input id="a-city" className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-state">State</label>
              <input id="a-state" className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="a-zip">Zip *</label>
              <input id="a-zip" className="input" required value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-country">Country *</label>
              <input id="a-country" className="input" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="a-phone">Phone</label>
            <input id="a-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="row gap-8">
            <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Save'} address</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {addresses.length === 0 ? (
        <p className="muted">No saved addresses yet.</p>
      ) : (
        addresses.map((a) => (
          <div key={a._id} className={`address-option ${a.isDefault ? 'active' : ''}`}>
            <div className="row between wrap gap-12">
              <div>
                <div className="row gap-8">
                  <span className="bold small">{a.label || 'Address'}</span>
                  {a.isDefault ? <Badge tone="ok"><Check size={11} /> Default</Badge> : null}
                </div>
                <div className="small">{a.fullName}</div>
                <div className="small muted">{a.street}, {a.city} {a.zipCode}, {a.country}</div>
                {a.phone ? <div className="tiny muted">{a.phone}</div> : null}
              </div>
              <div className="row gap-8">
                {!a.isDefault ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => makeDefault(a._id)}>
                    Make default
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
                  Edit
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
  const toast = useToastStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast.error('The new passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed — please sign in again');
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
      <h2 style={{ fontSize: '1.1rem', marginBottom: 18 }}>Security</h2>
      <form onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="field">
          <label className="field-label" htmlFor="cur">Current password</label>
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
          <label className="field-label" htmlFor="new">New password</label>
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
          <label className="field-label" htmlFor="confirm">Confirm new password</label>
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
          {saving ? 'Updating…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}

export default function Account() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const resetCart = useCartStore((s) => s.reset);
  const navigate = useNavigate();

  const links = [
    { to: '/account', end: true, icon: <User size={16} />, label: 'Profile' },
    { to: '/account/addresses', icon: <MapPin size={16} />, label: 'Addresses' },
    { to: '/orders', icon: <Package size={16} />, label: 'My Orders' },
    { to: '/wishlist', icon: <Heart size={16} />, label: 'Wishlist' },
    { to: '/account/settings', icon: <Settings size={16} />, label: 'Security' },
  ];

  async function handleLogout() {
    await logout();
    resetCart();
    navigate('/');
  }

  return (
    <div className="container">
      <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'My Account' }]} />

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
              <LogOut size={15} /> Sign out
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
                  title="Page not found"
                  action={<Link to="/account" className="btn btn-primary">Back to account</Link>}
                />
              }
            />
          </Routes>
        </section>
      </div>
    </div>
  );
}
