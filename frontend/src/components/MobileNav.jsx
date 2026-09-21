import { NavLink } from 'react-router-dom';
import { Home, Grid, Cart, Heart, User } from './Icons';
import { useCartStore } from '../store/cartStore';

const linkClass = ({ isActive }) => (isActive ? 'active' : '');

export default function MobileNav() {
  const items = useCartStore((s) => s.items);
  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <nav className="mobile-nav" aria-label="Primary">
      <NavLink to="/" end className={linkClass}>
        <Home size={20} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/products" className={linkClass}>
        <Grid size={20} />
        <span>Categories</span>
      </NavLink>
      <NavLink to="/cart" className={linkClass}>
        <Cart size={20} />
        {count > 0 ? <span className="count">{count}</span> : null}
        <span>Cart</span>
      </NavLink>
      <NavLink to="/wishlist" className={linkClass}>
        <Heart size={20} />
        <span>Wishlist</span>
      </NavLink>
      <NavLink to="/account" className={linkClass}>
        <User size={20} />
        <span>Account</span>
      </NavLink>
    </nav>
  );
}
