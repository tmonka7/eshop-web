import { Cart, Truck, Shield, Refresh } from './Icons';
import { useI18n } from '../i18n';
import { currency } from '../utils/format';

/**
 * The brand panel beside the sign-in and registration forms.
 *
 * Purely decorative — it carries no control the form does not, so the
 * stylesheet drops it below 860px instead of stacking it above the fields.
 * That is also why it is `aria-hidden`: a screen reader hearing the store's
 * selling points before the password field gains nothing.
 */
export default function AuthAside() {
  const { t } = useI18n();

  const points = [
    { key: 'shipping', icon: <Truck size={16} />, label: t('header.freeShippingOver', { amount: currency(50) }) },
    { key: 'payment', icon: <Shield size={16} />, label: t('home.features.paymentTitle') },
    { key: 'returns', icon: <Refresh size={16} />, label: t('home.features.returnsText') },
  ];

  return (
    <aside className="auth-aside" aria-hidden="true">
      <span className="mark"><Cart size={22} /></span>
      <h2>{t('brand.tagline')}</h2>
      <p>{t('home.heroSubtitle')}</p>

      <ul className="points">
        {points.map((p) => (
          <li key={p.key}>
            {p.icon}
            {p.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
