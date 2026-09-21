import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { API_URL, ASSET_URL } from '../api/client';
import { Badge } from '../components/ui';
import { useAuthStore, useToastStore } from '../store';
import { formatDateTime } from '../utils/format';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toast = useToastStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  async function changePassword(e) {
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
      toast.success('Password changed — sign in again');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your account and the environment this panel is talking to</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h2 className="mb-16" style={{ fontSize: '1rem' }}>Account</h2>
          <div className="row gap-12 mb-16">
            <span className="avatar-circle" style={{ width: 44, height: 44 }}>
              {(user?.name || 'A').charAt(0)}
            </span>
            <div>
              <div className="bold">{user?.name}</div>
              <div className="small muted">{user?.email}</div>
              <div className="mt-8"><Badge tone="danger">{user?.role}</Badge></div>
            </div>
          </div>
          <div className="small muted">
            Last sign-in: {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
          </div>
        </div>

        <div className="card card-pad">
          <h2 className="mb-16" style={{ fontSize: '1rem' }}>Environment</h2>
          <div className="stack gap-8 small">
            <div className="row between">
              <span className="muted">API base URL</span>
              <code>{API_URL}</code>
            </div>
            <div className="row between">
              <span className="muted">Asset base URL</span>
              <code>{ASSET_URL}</code>
            </div>
            <div className="row between">
              <span className="muted">Storefront</span>
              <a className="bold" href="http://localhost:5173" target="_blank" rel="noreferrer">
                localhost:5173
              </a>
            </div>
          </div>
          <div className="alert alert-info mt-16" style={{ marginBottom: 0 }}>
            These come from <code>.env</code> (<code>VITE_API_URL</code>, <code>VITE_ASSET_URL</code>).
            Restart the dev server after changing them.
          </div>
        </div>
      </div>

      <div className="card card-pad mt-24" style={{ maxWidth: 480 }}>
        <h2 className="mb-16" style={{ fontSize: '1rem' }}>Change password</h2>
        <form onSubmit={changePassword}>
          <div className="field">
            <label className="field-label" htmlFor="s-cur">Current password</label>
            <input
              id="s-cur"
              type="password"
              className="input"
              required
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="s-new">New password</label>
            <input
              id="s-new"
              type="password"
              className="input"
              required
              minLength={6}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="s-confirm">Confirm new password</label>
            <input
              id="s-confirm"
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
    </>
  );
}
