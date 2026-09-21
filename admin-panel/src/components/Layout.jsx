import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Dashboard, Boxes, Package, Users, Layers, Megaphone, Star2, Image, Chart, Settings,
  LogOut, Menu, Globe, AlertTriangle,
} from './Icons';
import { Toasts } from './ui';
import LanguageSwitcher from './LanguageSwitcher';
import { useAuthStore, useUiStore } from '../store';
import { useI18n } from '../i18n';
import { replayPageEnter, startMotion } from '../utils/motion';

// Section and item labels are catalogue keys, resolved at render time so the
// sidebar follows a language switch without a reload.
const NAV = [
  {
    sectionKey: 'nav.overview',
    items: [{ to: '/', end: true, icon: <Dashboard size={17} />, labelKey: 'nav.dashboard' }],
  },
  {
    sectionKey: 'nav.catalog',
    items: [
      { to: '/products', icon: <Boxes size={17} />, labelKey: 'nav.products' },
      { to: '/categories', icon: <Layers size={17} />, labelKey: 'nav.categories' },
      { to: '/inventory', icon: <AlertTriangle size={17} />, labelKey: 'nav.inventory' },
    ],
  },
  {
    sectionKey: 'nav.sales',
    items: [
      { to: '/orders', icon: <Package size={17} />, labelKey: 'nav.orders' },
      { to: '/customers', icon: <Users size={17} />, labelKey: 'nav.customers' },
    ],
  },
  {
    sectionKey: 'nav.engagement',
    items: [
      { to: '/promotions', icon: <Megaphone size={17} />, labelKey: 'nav.promotions' },
      { to: '/reviews', icon: <Star2 size={17} />, labelKey: 'nav.reviews' },
      { to: '/content', icon: <Image size={17} />, labelKey: 'nav.content' },
    ],
  },
  {
    sectionKey: 'nav.insights',
    items: [
      { to: '/reports', icon: <Chart size={17} />, labelKey: 'nav.reports' },
      { to: '/settings', icon: <Settings size={17} />, labelKey: 'nav.settings' },
    ],
  },
];

const TITLE_KEYS = {
  '/': 'dashboard.title',
  '/products': 'products.title',
  '/categories': 'categories.title',
  '/inventory': 'inventory.title',
  '/orders': 'orders.title',
  '/customers': 'customers.title',
  '/promotions': 'promotions.title',
  '/reviews': 'reviews.title',
  '/content': 'content.title',
  '/reports': 'reports.title',
  '/settings': 'settings.title',
};

export default function Layout() {
  const { pathname } = useLocation();
  const pageRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const closeSidebar = useUiStore((s) => s.closeSidebar);

  const titleKey = TITLE_KEYS[pathname] || TITLE_KEYS[`/${pathname.split('/')[1]}`];
  const title = titleKey ? t(titleKey) : t('app.panel');

  // Scroll-reveal plus the topbar's scrolled state. Started once for the whole
  // shell; it picks up nodes added by later navigations itself.
  useEffect(() => startMotion(), []);

  // Every navigation replays the page-level entrance.
  useEffect(() => {
    replayPageEnter(pageRef.current);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="mark">A</span>
          <div>
            <div className="name">{t('app.brand')}</div>
            <div className="sub">{t('app.panel')}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div key={group.sectionKey}>
              <div className="sidebar-section">{t(group.sectionKey)}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  {item.icon}
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <a
            className="sidebar-link"
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
          >
            <Globe size={17} /> {t('nav.storefront')}
          </a>
          <button type="button" className="sidebar-link" style={{ width: '100%' }} onClick={handleLogout}>
            <LogOut size={17} /> {t('nav.signOut')}
          </button>
        </div>
      </aside>

      {sidebarOpen ? <div className="backdrop" onClick={closeSidebar} role="presentation" /> : null}

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-ghost btn-icon sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={t('nav.toggleNavigation')}
          >
            <Menu size={19} />
          </button>
          <h1>{title}</h1>
          <span className="spacer" />
          <div className="row gap-8">
            <LanguageSwitcher />
            <div className="right" style={{ lineHeight: 1.3 }}>
              <div className="small bold">{user?.name}</div>
              <div className="tiny muted">{user?.role ? t(`roles.${user.role}`) : ''}</div>
            </div>
            <span className="avatar-circle">{(user?.name || 'A').charAt(0)}</span>
          </div>
        </header>

        <main className="page" ref={pageRef}>
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
