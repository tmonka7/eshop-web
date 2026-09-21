import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Dashboard, Boxes, Package, Users, Layers, Megaphone, Star2, Image, Chart, Settings,
  LogOut, Menu, Globe, AlertTriangle,
} from './Icons';
import { Toasts } from './ui';
import { useAuthStore, useUiStore } from '../store';

const NAV = [
  {
    section: 'Overview',
    items: [{ to: '/', end: true, icon: <Dashboard size={17} />, label: 'Dashboard' }],
  },
  {
    section: 'Catalog',
    items: [
      { to: '/products', icon: <Boxes size={17} />, label: 'Products' },
      { to: '/categories', icon: <Layers size={17} />, label: 'Categories' },
      { to: '/inventory', icon: <AlertTriangle size={17} />, label: 'Inventory' },
    ],
  },
  {
    section: 'Sales',
    items: [
      { to: '/orders', icon: <Package size={17} />, label: 'Orders' },
      { to: '/customers', icon: <Users size={17} />, label: 'Customers' },
    ],
  },
  {
    section: 'Engagement',
    items: [
      { to: '/promotions', icon: <Megaphone size={17} />, label: 'Promotions' },
      { to: '/reviews', icon: <Star2 size={17} />, label: 'Reviews' },
      { to: '/content', icon: <Image size={17} />, label: 'Content' },
    ],
  },
  {
    section: 'Insights',
    items: [
      { to: '/reports', icon: <Chart size={17} />, label: 'Reports' },
      { to: '/settings', icon: <Settings size={17} />, label: 'Settings' },
    ],
  },
];

const TITLES = {
  '/': 'Dashboard',
  '/products': 'Products Management',
  '/categories': 'Categories',
  '/inventory': 'Inventory',
  '/orders': 'Orders Management',
  '/customers': 'Customers',
  '/promotions': 'Promotions',
  '/reviews': 'Reviews',
  '/content': 'Content',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const closeSidebar = useUiStore((s) => s.closeSidebar);

  const title = TITLES[pathname]
    || TITLES[`/${pathname.split('/')[1]}`]
    || 'Admin';

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
            <div className="name">AuraMart</div>
            <div className="sub">Admin Panel</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="sidebar-section">{group.section}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  {item.icon}
                  {item.label}
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
            <Globe size={17} /> View storefront
          </a>
          <button type="button" className="sidebar-link" style={{ width: '100%' }} onClick={handleLogout}>
            <LogOut size={17} /> Sign out
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
            aria-label="Toggle navigation"
          >
            <Menu size={19} />
          </button>
          <h1>{title}</h1>
          <span className="spacer" />
          <div className="row gap-8">
            <div className="right" style={{ lineHeight: 1.3 }}>
              <div className="small bold">{user?.name}</div>
              <div className="tiny muted">{user?.role}</div>
            </div>
            <span className="avatar-circle">{(user?.name || 'A').charAt(0)}</span>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
