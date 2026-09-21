import { Link } from 'react-router-dom';
import { Star, StarFilled, X } from './Icons';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n';

export function Spinner({ label }) {
  return (
    <div className="loader-wrap">
      <div className="stack center" style={{ alignItems: 'center', gap: 12 }}>
        <div className="spinner" />
        {label ? <span className="small muted">{label}</span> : null}
      </div>
    </div>
  );
}

export function Rating({ value = 0, count, size = 13, showValue = false }) {
  const { t } = useI18n();
  const rounded = Math.round(value);
  return (
    <span className="rating" title={t('product.ratingOutOf', { value })}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= rounded ? (
          <StarFilled key={i} size={size} className="star-on" />
        ) : (
          <Star key={i} size={size} className="star-off" />
        ),
      )}
      {showValue ? <span className="small bold" style={{ marginLeft: 4 }}>{Number(value).toFixed(1)}</span> : null}
      {count !== undefined ? <span className="tiny muted" style={{ marginLeft: 4 }}>({count})</span> : null}
    </span>
  );
}

export function Badge({ tone = 'muted', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      {icon ? <div className="ico">{icon}</div> : null}
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

export function Breadcrumb({ items }) {
  const { t } = useI18n();
  return (
    <nav className="breadcrumb" aria-label={t('a11y.breadcrumb')}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="row gap-6">
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span className="bold">{item.label}</span>}
          {i < items.length - 1 ? <span aria-hidden>/</span> : null}
        </span>
      ))}
    </nav>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  const { t } = useI18n();
  if (!totalPages || totalPages <= 1) return null;

  // Show a sliding window of 5 pages around the current one.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  return (
    <div className="pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        {t('common.prev')}
      </button>
      {start > 1 ? (
        <>
          <button type="button" onClick={() => onChange(1)}>1</button>
          <span className="muted">…</span>
        </>
      ) : null}
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
      {start + 4 < totalPages ? (
        <>
          <span className="muted">…</span>
          <button type="button" onClick={() => onChange(totalPages)}>{totalPages}</button>
        </>
      ) : null}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        {t('common.next')}
      </button>
    </div>
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
          <button type="button" onClick={() => dismiss(item.id)} aria-label={t('common.dismiss')}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card" style={{ overflow: 'hidden' }}>
          <div className="skeleton" style={{ aspectRatio: '1 / 1', borderRadius: 0 }} />
          <div style={{ padding: 14 }}>
            <div className="skeleton" style={{ height: 13, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: '65%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 18, width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
