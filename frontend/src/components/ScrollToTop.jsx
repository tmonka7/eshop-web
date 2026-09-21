import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Router keeps scroll position between routes; reset it on every navigation. */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, search]);
  return null;
}
