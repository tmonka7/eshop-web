import { Link } from 'react-router-dom';
import { Star, StarFilled, X } from './Icons';
import { useToastStore } from '../store/toastStore';

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
  const rounded = Math.round(value);
  return (
    <span className="rating" title={`${value} out of 5`}>
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
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
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
  if (!totalPages || totalPages <= 1) return null;

  // Show a sliding window of 5 pages around the current one.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  return (
    <div className="pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Prev
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
        Next
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="grow">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
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
