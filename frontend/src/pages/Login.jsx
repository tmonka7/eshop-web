import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DEMO = [
  { labelKey: 'auth.demoCustomer', email: 'john@example.com', password: 'Password@123' },
  { labelKey: 'auth.demoAdmin', email: 'admin@auramart.com', password: 'Admin@123' },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const login = useAuthStore((s) => s.login);
  const mergeCart = useCartStore((s) => s.merge);
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
      await mergeCart().catch(() => {});
      toast.success(t('auth.welcomeBackName', { name: user.name.split(' ')[0] }));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="row between gap-12 mb-24">
          <div className="row gap-12">
            <span className="brand-mark">A</span>
            <div>
              <div className="brand-name">{t('brand.name')}</div>
              <div className="brand-tag">{t('auth.welcomeBack')}</div>
            </div>
          </div>
          <LanguageSwitcher compact />
        </div>

        <h1 style={{ fontSize: '1.4rem', marginBottom: 6 }}>{t('auth.signInTitle')}</h1>
        <p className="small muted">{t('auth.signInSubtitle')}</p>

        <div className="demo-box">
          <strong>{t('auth.demoAccounts')}</strong>
          <div className="stack gap-4 mt-8">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', padding: '3px 6px' }}
                onClick={() => setForm({ email: d.email, password: d.password })}
              >
                {t(d.labelKey)}: {d.email} / {d.password}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="email">{t('auth.email')}</label>
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
            <label className="field-label" htmlFor="password">{t('auth.password')}</label>
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

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <p className="small muted mt-24" style={{ textAlign: 'center' }}>
          {t('auth.newHere')} <Link to="/register" className="link">{t('auth.createAnAccount')}</Link>
        </p>
      </div>
    </div>
  );
}
