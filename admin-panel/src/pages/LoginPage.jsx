import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useToastStore } from '../store';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const login = useAuthStore((s) => s.login);
  const toast = useToastStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const redirectTo = location.state?.from || '/';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(t('login.signedInAs', { name: user.name }));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="row between gap-12 mb-24">
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: 'linear-gradient(135deg, #22c55e, #15803d)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '1.2rem',
            }}
          >
            A
          </span>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>{t('app.brand')}</div>
            <div className="tiny muted">{t('app.panel')}</div>
          </div>
          <LanguageSwitcher compact />
        </div>

        <h1 style={{ fontSize: '1.3rem', marginBottom: 6 }}>{t('login.title')}</h1>
        <p className="small muted">{t('login.staffOnly')}</p>

        <div className="demo-box">
          <strong>{t('login.demoCredentials')}</strong>
          <div className="stack gap-4 mt-8">
            {[
              { label: t('login.demoAdmin'), email: 'admin@auramart.com', password: 'Admin@123' },
              { label: t('login.demoManager'), email: 'manager@auramart.com', password: 'Manager@123' },
            ].map((d) => (
              <button
                key={d.email}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', padding: '3px 6px' }}
                onClick={() => setForm({ email: d.email, password: d.password })}
              >
                {d.label}: {d.email} / {d.password}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="email">{t('login.email')}</label>
            <input
              id="email"
              type="email"
              className="input"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">{t('login.password')}</label>
            <input
              id="password"
              type="password"
              className="input"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
