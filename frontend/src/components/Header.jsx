import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Cart, Heart, User, Package, LogOut, Settings, MapPin, Phone, Mail, ChevronDown,
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
      <div className="header-top">
        <div className="container">
          <div className="row gap-16">
            <span className="row gap-6"><Phone size={13} /> +358 40 000 0000</span>
            <span className="row gap-6"><Mail size={13} /> help@auramart.com</span>
          </div>
          <div className="row gap-16">
            <Link to="/orders">{t('header.trackOrder')}</Link>
            <span>{t('header.freeShippingOver', { amount: currency(50) })}</span>
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
            <LanguageSwitcher />

            <Link to="/wishlist" className="icon-btn" aria-label={t('header.wishlist')}>
              <Heart size={19} />
              {wishCount > 0 ? <span className="count">{wishCount}</span> : null}
            </Link>

            <Link to="/cart" className="icon-btn" aria-label={t('header.cart')}>
              <Cart size={19} />
              {cartCount > 0 ? <span className="count">{cartCount}</span> : null}
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
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm" style={{ marginLeft: 6 }}>
                {t('header.signIn')}
              </Link>
            )}
          </div>
        </div>
      </div>

      <nav className="header-nav">
        <div className="container">
          <NavLink to="/products" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
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
