import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from './Icons';
import { useI18n } from '../i18n';
import { currency } from '../utils/format';

const shopLinks = [
  { to: '/products?sort=best_selling', labelKey: 'footer.bestSellers' },
  { to: '/products?sort=newest', labelKey: 'footer.newArrivals' },
  { to: '/products?featured=true', labelKey: 'footer.featured' },
  { to: '/products?category=electronics', labelKey: 'footer.electronics' },
  { to: '/products?category=fashion', labelKey: 'footer.fashion' },
];

const helpLinks = [
  { to: '/orders', labelKey: 'footer.trackMyOrder' },
  { to: '/account', labelKey: 'footer.myAccount' },
  { to: '/cart', labelKey: 'footer.shoppingCart' },
  { to: '/wishlist', labelKey: 'footer.wishlist' },
];

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="row gap-8 mb-16">
              <span className="brand-mark">A</span>
              <div>
                <div className="brand-name" style={{ color: '#fff' }}>{t('brand.name')}</div>
                <div className="tiny" style={{ color: 'var(--ink-400)' }}>{t('brand.tagline')}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.86rem', maxWidth: '38ch' }}>
              {t('footer.blurb')}
            </p>
            <div className="stack gap-8 mt-16 small">
              <span className="row gap-8"><MapPin size={14} /> Mannerheimintie 1, Helsinki</span>
              <span className="row gap-8"><Phone size={14} /> +358 40 000 0000</span>
              <span className="row gap-8"><Mail size={14} /> help@auramart.com</span>
            </div>
          </div>

          <div>
            <h4>{t('footer.shop')}</h4>
            <ul className="stack gap-8">
              {shopLinks.map((l) => (
                <li key={l.labelKey}><Link to={l.to}>{t(l.labelKey)}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>{t('footer.help')}</h4>
            <ul className="stack gap-8">
              {helpLinks.map((l) => (
                <li key={l.labelKey}><Link to={l.to}>{t(l.labelKey)}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>{t('footer.weAccept')}</h4>
            <div className="chips" style={{ gap: 8 }}>
              {['Visa', 'Mastercard', 'PayPal', 'Apple Pay', t('payment.cod')].map((m) => (
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
            <h4 className="mt-24">{t('footer.freeShipping')}</h4>
            <p className="small" style={{ color: 'var(--ink-400)' }}>
              {t('footer.freeShippingNote', { amount: currency(50) })}
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <span>{t('footer.builtWith')}</span>
        </div>
      </div>
    </footer>
  );
}
