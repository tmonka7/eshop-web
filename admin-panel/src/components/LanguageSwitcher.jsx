import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Globe } from './Icons';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store';
import { authApi } from '../api';

/**
 * Panel language picker.
 *
 * Switching is instant and local; it also persists the choice on the staff
 * account so the same person sees the same language on another machine. A
 * failed save is silent — the panel has already switched.
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
      const res = await authApi.updateLanguage(tag);
      if (res?.data && setUser) setUser(res.data);
    } catch (_err) {
      // Best-effort: the switch itself already applied locally.
    }
  }

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-sm lang-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.changeLanguage')}
        title={t('common.changeLanguage')}
      >
        <Globe size={15} />
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
