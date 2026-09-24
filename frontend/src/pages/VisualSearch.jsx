import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard';
import { Breadcrumb, EmptyState, SkeletonGrid } from '../components/ui';
import { Camera, Search, Upload } from '../components/Icons';
import { useI18n } from '../i18n';

/**
 * Search by photo. The header's camera button hands the picked file over in
 * router state; the page also has its own drop zone so shoppers can retry.
 * The API ranks products with DINOv3 features computed on the server.
 */
export default function VisualSearch() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [file, setFile] = useState(location.state?.file || null);
  const [preview, setPreview] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // null, 'unavailable' (model not loaded on the server), or an API message.
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  // A photo picked with the header's camera button arrives in history state.
  // This runs on every such navigation, not only on mount: picking a second
  // photo while already on this page re-uses the component, so reading the
  // state only in useState() would ignore it. The state is then cleared so a
  // reload or a back navigation does not silently run the same search again.
  useEffect(() => {
    const incoming = location.state?.file;
    if (!incoming) return;
    setFile(incoming);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Re-runs on a language change so product names come back translated.
  useEffect(() => {
    if (!file) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    catalogApi
      .visualSearch(file, { limit: 24 })
      .then((res) => alive && setResults(res.data))
      .catch((err) => {
        if (!alive) return;
        setResults([]);
        setError(err.status === 503 ? 'unavailable' : err.message);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [file, locale]);

  const accept = useCallback((picked) => {
    if (picked && picked.type.startsWith('image/')) setFile(picked);
  }, []);

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0]);
  }

  const dropZone = (
    <label
      className={`visual-drop ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <Upload size={30} />
      <span>
        {t('visualSearch.drop')} <span className="link">{t('visualSearch.pick')}</span>
      </span>
      <span className="tiny muted">{t('visualSearch.formats')}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </label>
  );

  return (
    <div className="container">
      <Breadcrumb items={[{ label: t('common.home'), to: '/' }, { label: t('visualSearch.title') }]} />
      <h1 style={{ fontSize: '1.6rem', marginBottom: 6 }}>{t('visualSearch.title')}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>{t('visualSearch.subtitle')}</p>

      {!file ? (
        dropZone
      ) : (
        <div className="visual-search">
          <aside className="visual-query">
            {preview ? <img src={preview} alt={t('visualSearch.yourPhoto')} /> : null}
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => inputRef.current?.click()}
            >
              <Camera size={16} /> {t('visualSearch.change')}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                accept(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </aside>

          <section>
            <div className="toolbar">
              <div>
                <h2 style={{ fontSize: '1.2rem' }}>{t('visualSearch.resultsTitle')}</h2>
                <p className="small muted" style={{ margin: 0 }}>
                  {loading
                    ? t('visualSearch.searching')
                    : t('visualSearch.found', { count: results.length })}
                </p>
              </div>
            </div>

            {loading ? (
              <SkeletonGrid count={8} />
            ) : error || results.length === 0 ? (
              <EmptyState
                icon={<Search size={28} />}
                title={error === 'unavailable' ? t('visualSearch.unavailable') : t('visualSearch.emptyTitle')}
                message={error && error !== 'unavailable' ? error : t('visualSearch.emptyMessage')}
              />
            ) : (
              <div className="product-grid">
                {results.map((p) => (
                  <div key={p._id} className="visual-hit">
                    <span className="match">
                      {t('visualSearch.match', { percent: Math.round(Math.max(0, p.similarity) * 100) })}
                    </span>
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
