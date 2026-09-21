import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard';
import { Breadcrumb, EmptyState, Pagination, Rating, SkeletonGrid } from '../components/ui';
import { Filter, Search, X } from '../components/Icons';
import { SORT_OPTIONS, COLOR_SWATCHES } from '../utils/constants';
import { currency } from '../utils/format';
import { useI18n } from '../i18n';

const LIST_KEYS = ['brand', 'color'];

export default function Products() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [facets, setFacets] = useState({ brands: [], colors: [], price: { min: 0, max: 0 }, ratings: [] });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const query = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const activeCategory = query.category || '';

  const patchParams = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') next.delete(key);
        else next.set(key, value);
      });
      if (resetPage) next.delete('page');
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  /** Adds/removes one value inside a comma-separated multi-select param. */
  const toggleListParam = useCallback(
    (key, value) => {
      const current = (searchParams.get(key) || '').split(',').filter(Boolean);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      patchParams({ [key]: next.join(',') });
    },
    [searchParams, patchParams],
  );

  useEffect(() => {
    catalogApi.categories({ withCounts: true }).then((res) => setCategories(res.data)).catch(() => {});
    // Category names come translated from the API, so refetch on a switch.
  }, [locale]);

  useEffect(() => {
    catalogApi
      .filters({ category: activeCategory })
      .then((res) => setFacets(res.data))
      .catch(() => {});
  }, [activeCategory]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    catalogApi
      .products({ ...query, limit: query.limit || 12 })
      .then((res) => {
        if (!alive) return;
        setProducts(res.data);
        setPagination(res.pagination);
      })
      .catch(() => {
        if (alive) setProducts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [query, locale]);

  const activeChips = [];
  if (query.search) activeChips.push({ key: 'search', label: `“${query.search}”` });
  if (query.category) {
    const cat = categories.find((c) => c.slug === query.category);
    activeChips.push({ key: 'category', label: cat ? cat.name : query.category });
  }
  LIST_KEYS.forEach((key) => {
    (query[key] || '').split(',').filter(Boolean).forEach((value) => {
      activeChips.push({ key, label: value, value });
    });
  });
  if (query.minPrice || query.maxPrice) {
    activeChips.push({
      key: 'price',
      label: `${currency(query.minPrice || 0)} – ${currency(query.maxPrice || facets.price.max)}`,
    });
  }
  if (query.minRating) {
    activeChips.push({
      key: 'minRating',
      label: t('products.ratingAndUp', { rating: query.minRating }),
    });
  }

  function clearChip(chip) {
    if (chip.key === 'price') patchParams({ minPrice: '', maxPrice: '' });
    else if (LIST_KEYS.includes(chip.key)) toggleListParam(chip.key, chip.value);
    else patchParams({ [chip.key]: '' });
  }

  const rootCategories = categories.filter((c) => !c.parent);

  return (
    <div className="container">
      <Breadcrumb
        items={[
          { label: t('common.home'), to: '/' },
          {
            label: query.category
              ? activeChips.find((c) => c.key === 'category')?.label
              : t('common.allProducts'),
          },
        ]}
      />

      <div className="shop-layout">
        <aside className={`filter-panel ${showFilters ? '' : 'mobile-hidden'}`}>
          <div className="card card-pad">
            <div className="row between mb-16">
              <h3 style={{ fontSize: '0.95rem' }}>{t('products.filters')}</h3>
              {activeChips.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSearchParams(new URLSearchParams())}
                >
                  {t('products.clearAll')}
                </button>
              ) : null}
            </div>

            <div className="filter-group">
              <h4>{t('products.category')}</h4>
              <label className="filter-option">
                <input
                  type="radio"
                  name="category"
                  checked={!activeCategory}
                  onChange={() => patchParams({ category: '' })}
                />
                {t('products.allCategories')}
              </label>
              {rootCategories.map((c) => (
                <label key={c._id} className="filter-option">
                  <input
                    type="radio"
                    name="category"
                    checked={activeCategory === c.slug}
                    onChange={() => patchParams({ category: c.slug })}
                  />
                  {c.name}
                  {c.productCount !== undefined ? <span className="count">{c.productCount}</span> : null}
                </label>
              ))}
            </div>

            <div className="filter-group">
              <h4>{t('products.price')}</h4>
              <div className="row gap-8">
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder={String(facets.price.min || 0)}
                  value={query.minPrice || ''}
                  onChange={(e) => patchParams({ minPrice: e.target.value })}
                  aria-label={t('products.minPriceAria')}
                />
                <span className="muted">–</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder={String(facets.price.max || 0)}
                  value={query.maxPrice || ''}
                  onChange={(e) => patchParams({ maxPrice: e.target.value })}
                  aria-label={t('products.maxPriceAria')}
                />
              </div>
            </div>

            {facets.brands.length > 0 ? (
              <div className="filter-group">
                <h4>{t('products.brand')}</h4>
                {facets.brands.map((b) => (
                  <label key={b.value} className="filter-option">
                    <input
                      type="checkbox"
                      checked={(query.brand || '').split(',').includes(b.value)}
                      onChange={() => toggleListParam('brand', b.value)}
                    />
                    {b.value}
                    <span className="count">{b.count}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {facets.colors.length > 0 ? (
              <div className="filter-group">
                <h4>{t('products.color')}</h4>
                {facets.colors.map((c) => (
                  <label key={c.value} className="filter-option">
                    <input
                      type="checkbox"
                      checked={(query.color || '').split(',').includes(c.value)}
                      onChange={() => toggleListParam('color', c.value)}
                    />
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: '1px solid var(--border)',
                        background: COLOR_SWATCHES[c.value] || 'var(--ink-200)',
                      }}
                    />
                    {c.value}
                    <span className="count">{c.count}</span>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="filter-group">
              <h4>{t('products.rating')}</h4>
              {(facets.ratings || [4, 3, 2, 1]).map((r) => (
                <label key={r} className="filter-option">
                  <input
                    type="radio"
                    name="minRating"
                    checked={String(query.minRating) === String(r)}
                    onChange={() => patchParams({ minRating: r })}
                  />
                  <Rating value={r} /> {t('products.andUp')}
                </label>
              ))}
            </div>

            <div className="filter-group">
              <h4>{t('products.availability')}</h4>
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={query.inStock === 'true'}
                  onChange={(e) => patchParams({ inStock: e.target.checked ? 'true' : '' })}
                />
                {t('products.inStockOnly')}
              </label>
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={query.featured === 'true'}
                  onChange={(e) => patchParams({ featured: e.target.checked ? 'true' : '' })}
                />
                {t('products.featuredOnly')}
              </label>
            </div>
          </div>
        </aside>

        <section>
          <div className="toolbar">
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>
                {query.search
                  ? t('products.resultsFor', { term: query.search })
                  : t('common.allProducts')}
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                {loading
                  ? t('common.loading')
                  : t(pagination.total === 1 ? 'products.foundOne' : 'products.foundMany', {
                    count: pagination.total,
                  })}
              </p>
            </div>

            <div className="row gap-8">
              <button
                type="button"
                className="btn btn-outline btn-sm filters-toggle"
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter size={15} /> {t('products.filters')}
              </button>
              <label className="row gap-8 small muted">
                {t('products.sortBy')}
                <select
                  className="select"
                  value={query.sort || 'best_selling'}
                  onChange={(e) => patchParams({ sort: e.target.value })}
                  style={{ width: 180 }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {activeChips.length > 0 ? (
            <div className="chips mb-16">
              {activeChips.map((chip, i) => (
                <span key={`${chip.key}-${chip.label}-${i}`} className="chip">
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => clearChip(chip)}
                    aria-label={t('products.removeFilter', { label: chip.label })}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {loading ? (
            <SkeletonGrid count={8} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Search size={28} />}
              title={t('products.emptyTitle')}
              message={t('products.emptyMessage')}
              action={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setSearchParams(new URLSearchParams())}
                >
                  {t('products.clearAllFilters')}
                </button>
              }
            />
          ) : (
            <>
              <div className="product-grid">
                {products.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onChange={(p) => patchParams({ page: p }, { resetPage: false })}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
