import { useEffect } from 'react';
import { X, TrendUp, TrendDown } from './Icons';
import { useToastStore } from '../store';
import { useI18n } from '../i18n';
import { useCountUp } from '../utils/motion';

export function Spinner({ label }) {
  return (
    <div className="loader-wrap">
      <div className="stack center" style={{ alignItems: 'center', gap: 10 }}>
        <div className="spinner" />
        {label ? <span className="small muted">{label}</span> : null}
      </div>
    </div>
  );
}

export function Badge({ tone = 'muted', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Empty({ icon, title, message, action }) {
  return (
    <div className="empty">
      {icon ? <div className="ico">{icon}</div> : null}
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

/**
 * A KPI tile.
 *
 * Pass `value` for a figure that should just be printed. Pass `count` (a
 * number) with `format` instead and the tile counts up to it - `format` runs
 * on every frame, so currency, compact and percent tiles all animate the same
 * way and the units never disappear mid-count.
 */
export function StatCard({ label, value, count, format, delta, icon, tone = 'red' }) {
  const { t } = useI18n();
  const counted = useCountUp(count ?? 0);
  const shown = count === undefined || count === null ? value : format(counted);
  const tones = {
    red: { bg: 'var(--red-50)', fg: 'var(--red-500)' },
    green: { bg: 'var(--green-50)', fg: 'var(--green-600)' },
    blue: { bg: 'var(--blue-50)', fg: 'var(--blue-600)' },
    purple: { bg: 'var(--purple-50)', fg: 'var(--purple-500)' },
    amber: { bg: 'var(--amber-50)', fg: 'var(--amber-600)' },
  };
  const t = tones[tone] || tones.red;
  const up = Number(delta) >= 0;

  return (
    <div className="card stat-card">
      <div className="row between">
        <span className="label">{label}</span>
        {icon ? (
          <span className="stat-icon" style={{ background: t.bg, color: t.fg }}>{icon}</span>
        ) : null}
      </div>
      <span className="value">{shown}</span>
      {delta !== undefined && delta !== null ? (
        <span className={`delta ${up ? 'up' : 'down'}`}>
          {up ? <TrendUp size={13} /> : <TrendDown size={13} />}
          {up ? '+' : ''}{Number(delta).toFixed(1)}%
          <span className="muted" style={{ fontWeight: 500 }}>{t('dashboard.vsPrevious')}</span>
        </span>
      ) : null}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, total, limit, onChange }) {
  const { t } = useI18n();
  if (!totalPages || totalPages < 1) return null;

  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="small muted">
        {t('common.showingRange', { from, to, total })}
      </span>
      <div className="pages">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>{t('common.prev')}</button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={p === page ? 'active' : ''}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>{t('common.next')}</button>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="slider" />
    </label>
  );
}

export function Toasts() {
  const { t } = useI18n();
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`toast ${item.type}`}>
          <span className="grow">{item.message}</span>
          <button type="button" onClick={() => dismiss(item.id)} aria-label={t('common.close')}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Confirm dialog used before destructive actions. */
export function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onClose, busy }) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? t('common.working') : (confirmLabel || t('common.delete'))}
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}
