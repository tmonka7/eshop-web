import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard';
import RegionSelector from '../components/RegionSelector';
import { Breadcrumb, EmptyState, SkeletonGrid } from '../components/ui';
import { Camera, Search, Upload } from '../components/Icons';
import { useI18n } from '../i18n';

const WHOLE_PHOTO = { x: 0, y: 0, w: 1, h: 1 };
/** Longest side of an area cropped in the browser; the model sees 224 px. */
const CROP_MAX_SIDE = 1024;

/**
 * The part of the photo inside `box` (fractions of the upright image) as a
 * JPEG file. Used when the API does not take a `box` itself (an API from
 * before product-area detection), so a chosen area is still what gets searched.
 */
async function cropPhoto(url, box) {
  const img = new Image();
  img.src = url;
  await img.decode(); // natural size and drawing follow the EXIF orientation
  const sx = box.x * img.naturalWidth;
  const sy = box.y * img.naturalHeight;
  const sw = Math.max(1, box.w * img.naturalWidth);
  const sh = Math.max(1, box.h * img.naturalHeight);
  const scale = Math.min(1, CROP_MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // JPEG has no alpha: transparent areas become white, as on the server
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('crop failed');
  return new File([blob], 'area.jpg', { type: 'image/jpeg' });
}

/**
 * Search by photo. The header's camera button hands the picked file over in
 * router state; the page also has its own drop zone so shoppers can retry.
 * The API ranks products with DINOv3 features computed on the server.
 *
 * The server first finds the product in the photo and searches only that
 * area; the page draws it as a green box. If the box is wrong the shopper
 * moves or resizes it, and the search runs again for the new area.
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
  // The area searched last (from the API), and the one the shopper chose, if any.
  const [region, setRegion] = useState(null);
  const [userBox, setUserBox] = useState(null);
  // False once the API has answered without a `region`: it neither detects the
  // product nor takes a box, so chosen areas are cropped here instead.
  const [apiRegions, setApiRegions] = useState(true);

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
    // A new photo starts from automatic detection again.
    setRegion(null);
    setUserBox(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Re-runs on a language change so product names come back translated, and
  // whenever the shopper settles on a different search area.
  useEffect(() => {
    if (!file || !preview) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    const manual = userBox ? { ...userBox, auto: false, found: true } : null;
    const searchCrop = async () => {
      const area = await cropPhoto(preview, userBox);
      return catalogApi.visualSearch(area, { limit: 24, detect: false });
    };
    (async () => {
      if (userBox && !apiRegions) return { res: await searchCrop(), shown: manual };
      const res = await catalogApi.visualSearch(file, { limit: 24 }, userBox);
      if (res.region) return { res, shown: res.region, regions: true };
      // No region: the API ignored `box` too, so search the chosen area again as a crop.
      if (userBox) return { res: await searchCrop(), shown: manual, regions: false };
      return { res, shown: { ...WHOLE_PHOTO, auto: true, found: false, unsupported: true }, regions: false };
    })()
      .then(({ res, shown, regions }) => {
        if (!alive) return;
        if (regions !== undefined) setApiRegions(regions);
        setResults(res.data);
        setRegion(shown);
      })
      .catch((err) => {
        if (!alive) return;
        setResults([]);
        setError(err.status === 503 ? 'unavailable' : err.message);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // apiRegions is read, not watched: learning it must not repeat the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, preview, locale, userBox]);

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
            {preview ? (
              <RegionSelector
                src={preview}
                alt={t('visualSearch.yourPhoto')}
                region={region}
                onChange={setUserBox}
                disabled={loading && !region}
                label={t('visualSearch.regionLabel')}
              />
            ) : null}
            {region ? (
              <p className={`region-note ${region.auto && !region.found ? 'is-warn' : ''}`}>
                {!region.auto
                  ? t('visualSearch.regionAdjusted')
                  : t(region.unsupported
                    ? 'visualSearch.regionUnsupported'
                    : region.found ? 'visualSearch.regionAuto' : 'visualSearch.regionNone')}
              </p>
            ) : null}
            {region ? (
              <div className="region-actions">
                {apiRegions ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setUserBox(null)}
                    disabled={!userBox || loading}
                  >
                    {t('visualSearch.resetRegion')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setUserBox(WHOLE_PHOTO)}
                  disabled={loading || (region.w > 0.999 && region.h > 0.999)}
                >
                  {t('visualSearch.wholePhoto')}
                </button>
              </div>
            ) : null}
            <p className="tiny muted region-hint">{t('visualSearch.regionHint')}</p>
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
