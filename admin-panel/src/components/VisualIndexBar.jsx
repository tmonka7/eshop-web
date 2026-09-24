import { useCallback, useEffect, useRef, useState } from 'react';
import { visualSearchApi } from '../api';
import { Badge } from './ui';
import { Refresh } from './Icons';
import { useToastStore } from '../store';
import { useI18n } from '../i18n';

const POLL_MS = 2000;

/**
 * Health of the DINOv3 image-search index: whether the model is loaded, how
 * much of the catalogue has feature vectors, and a button to rebuild it.
 * Polls while a rebuild runs and calls `onFinished` once it completes so the
 * product table can refresh its per-row status badges.
 */
export default function VisualIndexBar({ onFinished }) {
  const { t } = useI18n();
  const toast = useToastStore();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const wasRunning = useRef(false);

  const refresh = useCallback(
    () => visualSearchApi.status().then((res) => setStatus(res.data)).catch(() => setStatus(null)),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const running = Boolean(status?.job?.running);
  useEffect(() => {
    if (wasRunning.current && !running) onFinished?.();
    wasRunning.current = running;
    if (!running) return undefined;
    const timer = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer);
  }, [running, status, refresh, onFinished]);

  async function rebuild(force) {
    setBusy(true);
    try {
      const res = await visualSearchApi.reindex(force);
      toast.success(res.message);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const indexed = status.byStatus?.indexed || 0;
  const job = status.job || {};

  return (
    <div className="card mb-16">
      <div className="card-header">
        <div className="row gap-8 wrap">
          <span className="bold">{t('visualIndex.title')}</span>
          {status.available ? (
            <Badge tone="ok">{t('visualIndex.modelReady')}</Badge>
          ) : (
            <Badge tone="danger">{t('visualIndex.modelMissing')}</Badge>
          )}
          <span className="tiny muted">{status.model}</span>
        </div>

        <div className="row gap-8 wrap">
          <span className="small muted">
            {running
              ? t('visualIndex.progress', { processed: job.processed, total: job.total })
              : t('visualIndex.coverage', { indexed, total: status.products, vectors: status.vectors })}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={!status.available || running || busy}
            onClick={() => rebuild(false)}
            title={t('visualIndex.rebuildHint')}
          >
            <Refresh size={14} /> {t('visualIndex.rebuild')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!status.available || running || busy}
            onClick={() => rebuild(true)}
            title={t('visualIndex.forceHint')}
          >
            {t('visualIndex.force')}
          </button>
        </div>
      </div>
      {!status.available && status.error ? (
        <div className="tiny muted" style={{ padding: '10px 18px' }}>{status.error}</div>
      ) : null}
    </div>
  );
}
