import { NavLink } from 'react-router-dom';
import { Home, Grid, Cart, Heart, User } from './Icons';
import { useCartStore } from '../store/cartStore';
import { useI18n } from '../i18n';

const linkClass = ({ isActive }) => (isActive ? 'active' : '');

export default function MobileNav() {
  const { t } = useI18n();
  const items = useCartStore((s) => s.items);
  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <nav className="mobile-nav" aria-label={t('mobileNav.primaryAria')}>
      <NavLink to="/" end className={linkClass}>
        <Home size={20} />
        <span>{t('mobileNav.home')}</span>
      </NavLink>
      <NavLink to="/products" className={linkClass}>
        <Grid size={20} />
        <span>{t('mobileNav.categories')}</span>
      </NavLink>
      <NavLink to="/cart" className={linkClass}>
        <Cart size={20} />
        {count > 0 ? <span className="count">{count}</span> : null}
        <span>{t('mobileNav.cart')}</span>
      </NavLink>
      <NavLink to="/wishlist" className={linkClass}>
        <Heart size={20} />
        <span>{t('mobileNav.wishlist')}</span>
      </NavLink>
      <NavLink to="/account" className={linkClass}>
        <User size={20} />
        <span>{t('mobileNav.account')}</span>
      </NavLink>
    </nav>
  );
}
