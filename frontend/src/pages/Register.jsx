import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';

export default function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const mergeCart = useCartStore((s) => s.merge);
  const toast = useToastStore();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (form.password !== form.confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' });
      return;
    }

    setBusy(true);
    try {
      const user = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      await mergeCart().catch(() => {});
      toast.success(`Welcome to AuraMart, ${user.name.split(' ')[0]}`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.errors) {
        setFieldErrors(Object.fromEntries(err.errors.map((x) => [x.field, x.message])));
      }
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
            <div className="brand-tag">Better Products, Brighter Life</div>
          </div>
        </div>

        <h1 style={{ fontSize: '1.4rem', marginBottom: 6 }}>Create your account</h1>
        <p className="small muted">It takes less than a minute.</p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="name">Full name</label>
            <input
              id="name"
              className={`input ${fieldErrors.name ? 'has-error' : ''}`}
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {fieldErrors.name ? <span className="field-error">{fieldErrors.name}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={`input ${fieldErrors.email ? 'has-error' : ''}`}
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {fieldErrors.email ? <span className="field-error">{fieldErrors.email}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="phone">Phone (optional)</label>
            <input
              id="phone"
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={`input ${fieldErrors.password ? 'has-error' : ''}`}
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <span className="field-hint">At least 6 characters.</span>
            {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              className={`input ${fieldErrors.confirm ? 'has-error' : ''}`}
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
            {fieldErrors.confirm ? <span className="field-error">{fieldErrors.confirm}</span> : null}
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="small muted mt-24" style={{ textAlign: 'center' }}>
          Already have an account? <Link to="/login" className="link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
