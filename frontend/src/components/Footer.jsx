import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from './Icons';

const shopLinks = [
  { to: '/products?sort=best_selling', label: 'Best Sellers' },
  { to: '/products?sort=newest', label: 'New Arrivals' },
  { to: '/products?featured=true', label: 'Featured' },
  { to: '/products?category=electronics', label: 'Electronics' },
  { to: '/products?category=fashion', label: 'Fashion' },
];

const helpLinks = [
  { to: '/orders', label: 'Track My Order' },
  { to: '/account', label: 'My Account' },
  { to: '/cart', label: 'Shopping Cart' },
  { to: '/wishlist', label: 'Wishlist' },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="row gap-8 mb-16">
              <span className="brand-mark">A</span>
              <div>
                <div className="brand-name" style={{ color: '#fff' }}>AuraMart</div>
                <div className="tiny" style={{ color: 'var(--ink-400)' }}>Better Products, Brighter Life</div>
              </div>
            </div>
            <p style={{ fontSize: '0.86rem', maxWidth: '38ch' }}>
              A modern commerce platform with a fast storefront, a full admin panel and a native
              Android app — all running on one API.
            </p>
            <div className="stack gap-8 mt-16 small">
              <span className="row gap-8"><MapPin size={14} /> Mannerheimintie 1, Helsinki</span>
              <span className="row gap-8"><Phone size={14} /> +358 40 000 0000</span>
              <span className="row gap-8"><Mail size={14} /> help@auramart.com</span>
            </div>
          </div>

          <div>
            <h4>Shop</h4>
            <ul className="stack gap-8">
              {shopLinks.map((l) => (
                <li key={l.label}><Link to={l.to}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Help</h4>
            <ul className="stack gap-8">
              {helpLinks.map((l) => (
                <li key={l.label}><Link to={l.to}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>We accept</h4>
            <div className="chips" style={{ gap: 8 }}>
              {['Visa', 'Mastercard', 'PayPal', 'Apple Pay', 'COD'].map((m) => (
                <span
                  key={m}
                  className="tiny"
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: 'var(--ink-800)',
                    color: 'var(--ink-300)',
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
            <h4 className="mt-24">Free shipping</h4>
            <p className="small" style={{ color: 'var(--ink-400)' }}>
              On every order over $50. 30-day returns on everything.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} AuraMart. Demo project.</span>
          <span>Built with React, Express and MongoDB.</span>
        </div>
      </div>
    </footer>
  );
}
