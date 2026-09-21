import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';

const DEMO = [
  { label: 'Customer', email: 'john@example.com', password: 'Password@123' },
  { label: 'Admin', email: 'admin@auramart.com', password: 'Admin@123' },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
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
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
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
        <div className="row gap-12 mb-24">
          <span className="brand-mark">A</span>
          <div>
            <div className="brand-name">AuraMart</div>
            <div className="brand-tag">Welcome back</div>
          </div>
        </div>

        <h1 style={{ fontSize: '1.4rem', marginBottom: 6 }}>Sign in</h1>
        <p className="small muted">Enter your details to continue shopping.</p>

        <div className="demo-box">
          <strong>Demo accounts</strong>
          <div className="stack gap-4 mt-8">
            {DEMO.map((d) => (
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
            <label className="field-label" htmlFor="email">Email</label>
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
            <label className="field-label" htmlFor="password">Password</label>
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
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="small muted mt-24" style={{ textAlign: 'center' }}>
          New to AuraMart? <Link to="/register" className="link">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
