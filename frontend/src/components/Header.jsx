import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Cart, Heart, User, Package, LogOut, Settings, MapPin, ChevronDown,
  Truck, Shield, Headset, Tag, Grid,
} from './Icons';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { catalogApi } from '../api';
import { currency, imageUrl } from '../utils/format';
import { useI18n } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const items = useCartStore((s) => s.items);
  const resetCart = useCartStore((s) => s.reset);

  const [categories, setCategories] = useState([]);
  const [term, setTerm] = useState(searchParams.get('search') || '');
  const [suggestions, setSuggestions] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const cartCount = items.reduce((n, i) => n + i.quantity, 0);
  const wishCount = user?.wishlist?.length || 0;

  useEffect(() => {
    catalogApi
      .categories({ parent: 'root' })
      .then((res) => setCategories(res.data.slice(0, 9)))
      .catch(() => setCategories([]));
  }, []);

  // Debounced type-ahead against the product list endpoint.
  useEffect(() => {
    if (term.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      catalogApi
        .products({ search: term.trim(), limit: 5 })
        .then((res) => setSuggestions(res.data))
        .catch(() => setSuggestions([]));
    }, 280);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function submitSearch(e) {
    e.preventDefault();
    setSuggestions([]);
    navigate(term.trim() ? `/products?search=${encodeURIComponent(term.trim())}` : '/products');
  }

  async function handleLogout() {
    await logout();
    resetCart();
    setMenuOpen(false);
    navigate('/');
  }

  return (
    <header className="header">
      {/* Benefit bar. The currency is a label, not a control: prices are USD
          everywhere by design, so a picker here would be a menu of one. */}
      <div className="header-top">
        <div className="container">
          <div className="promise-bar">
            <span><Truck size={14} /> {t('header.freeShippingOver', { amount: currency(50) })}</span>
            <span><Shield size={14} /> {t('header.moneyBack')}</span>
            <span><Headset size={14} /> {t('header.support247')}</span>
          </div>
          <div className="row gap-16">
            <LanguageSwitcher compact />
            <span className="row gap-6 currency-tag"><Tag size={13} /> USD</span>
          </div>
        </div>
      </div>

      <div className="header-main">
        <div className="container">
          <Link to="/" className="brand">
            <span className="brand-mark">A</span>
            <span className="brand-text">
              <span className="brand-name">{t('brand.name')}</span>
              <span className="brand-tag" style={{ display: 'block' }}>{t('brand.tagline')}</span>
            </span>
          </Link>

          <form className="search" onSubmit={submitSearch} role="search">
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.searchAria')}
            />
            <button type="submit" aria-label={t('common.search')}><Search size={16} /></button>

            {suggestions.length > 0 ? (
              <div className="search-suggest">
                {suggestions.map((p) => (
                  <Link
                    key={p._id}
                    to={`/product/${p.slug}`}
                    onClick={() => { setSuggestions([]); setTerm(''); }}
                  >
                    <img src={imageUrl(p.images?.[0])} alt="" />
                    <span className="grow truncate">{p.name}</span>
                    <span className="price small">{currency(p.price)}</span>
                  </Link>
                ))}
                <button
                  type="submit"
                  className="btn btn-ghost btn-sm btn-block"
                  style={{ borderRadius: 0, borderTop: '1px solid var(--border)' }}
                >
                  {t('header.seeAllResults', { term })}
                </button>
              </div>
            ) : null}
          </form>

          <div className="header-actions">
            {/* Signed-out visitors get the two-line Sign In / Register block
                from the design; signed-in ones keep the account menu, which
                that block has no room for. */}
            {!user ? (
              <div className="action-item action-auth">
                <User size={20} />
                <span className="action-label">
                  <Link to="/login">{t('header.signIn')}</Link>
                  <Link to="/register">{t('header.register')}</Link>
                </span>
              </div>
            ) : null}

            <Link to="/wishlist" className="action-item" aria-label={t('header.wishlist')}>
              <span className="action-icon">
                <Heart size={20} />
                {wishCount > 0 ? (
                  // Keyed on the value so React remounts the badge and its
                  // pop animation replays whenever the count actually changes.
                  <span className="count" key={wishCount}>{wishCount}</span>
                ) : null}
              </span>
              <span className="action-label">{t('header.wishlist')}</span>
            </Link>

            <Link to="/cart" className="action-item" aria-label={t('header.cart')}>
              <span className="action-icon">
                <Cart size={20} />
                {cartCount > 0 ? <span className="count" key={cartCount}>{cartCount}</span> : null}
              </span>
              <span className="action-label">{t('header.cart')}</span>
            </Link>

            {user ? (
              <div className="user-menu" ref={menuRef}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <User size={19} />
                  <ChevronDown size={11} style={{ marginLeft: -4 }} />
                </button>

                {menuOpen ? (
                  <div className="user-dropdown" role="menu">
                    <div className="head">
                      <div className="bold small">{user.name}</div>
                      <div className="tiny muted truncate">{user.email}</div>
                    </div>
                    <Link to="/account" onClick={() => setMenuOpen(false)}><User size={15} /> {t('header.myAccount')}</Link>
                    <Link to="/orders" onClick={() => setMenuOpen(false)}><Package size={15} /> {t('header.myOrders')}</Link>
                    <Link to="/account/addresses" onClick={() => setMenuOpen(false)}><MapPin size={15} /> {t('header.addresses')}</Link>
                    <Link to="/account/settings" onClick={() => setMenuOpen(false)}><Settings size={15} /> {t('header.settings')}</Link>
                    <button type="button" onClick={handleLogout}><LogOut size={15} /> {t('header.signOut')}</button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="header-nav">
        <div className="container">
          {/* The filled pill from the design. It is a link rather than a
              dropdown: every department it would list is already in the row
              beside it, so a menu would only duplicate them. */}
          <NavLink to="/products" end className="cat-pill">
            <Grid size={15} />
            {t('header.allCategories')}
          </NavLink>
          {categories.map((c) => (
            <NavLink
              key={c._id}
              to={`/products?category=${c.slug}`}
              className={() =>
                `nav-link ${searchParams.get('category') === c.slug ? 'active' : ''}`
              }
            >
              {c.name}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
