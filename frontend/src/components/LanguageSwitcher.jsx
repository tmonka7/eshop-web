import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from './Icons';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { userApi } from '../api';

/**
 * Language picker.
 *
 * Switching is instant and local; for a signed-in shopper it also persists the
 * choice on the account so the storefront and the Android app agree on the next
 * device. A failed save is deliberately silent — the UI has already switched,
 * and the preference will be retried on the next change.
 */
export default function LanguageSwitcher({ compact = false }) {
  const { locale, setLocale, languages, t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = languages.find((l) => l.tag === locale) || languages[0];

  async function choose(tag) {
    setOpen(false);
    if (tag === locale) return;
    setLocale(tag);

    if (!user) return;
    try {
      const res = await userApi.updateLanguage(tag);
      if (res?.data) setUser(res.data);
    } catch (_err) {
      // Saving the preference is best-effort; the switch itself already applied.
    }
  }

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        type="button"
        className="icon-btn lang-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.changeLanguage')}
        title={t('common.changeLanguage')}
      >
        <span aria-hidden>{current.flag}</span>
        {!compact ? <span className="lang-name">{current.nativeName}</span> : null}
        <ChevronDown size={11} />
      </button>

      {open ? (
        <ul className="lang-menu" role="listbox" aria-label={t('common.languageLabel')}>
          {languages.map((l) => (
            <li key={l.tag}>
              <button
                type="button"
                role="option"
                aria-selected={l.tag === locale}
                className={l.tag === locale ? 'active' : ''}
                onClick={() => choose(l.tag)}
                lang={l.tag}
              >
                <span aria-hidden>{l.flag}</span>
                <span className="grow">{l.nativeName}</span>
                {l.tag === locale ? <Check size={13} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
