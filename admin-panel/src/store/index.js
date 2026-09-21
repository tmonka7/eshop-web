import { create } from 'zustand';
import { authApi } from '../api';
import { tokenStore } from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle',

  async bootstrap() {
    if (!tokenStore.access && !tokenStore.refresh) {
      set({ status: 'ready' });
      return;
    }
    set({ status: 'loading' });
    try {
      const res = await authApi.me();
      // The panel is staff-only: a customer token must not open it.
      if (res.data.role === 'customer') {
        tokenStore.clear();
        set({ user: null, status: 'ready' });
        return;
      }
      set({ user: res.data, status: 'ready' });
    } catch (_err) {
      tokenStore.clear();
      set({ user: null, status: 'ready' });
    }
  },

  async login(email, password) {
    const res = await authApi.login({ email, password });
    if (res.data.user.role === 'customer') {
      throw new Error('This account does not have admin access');
    }
    tokenStore.set(res.data);
    set({ user: res.data.user });
    return res.data.user;
  },

  async logout() {
    try {
      await authApi.logout(tokenStore.refresh);
    } catch (_err) {
      // Local sign-out proceeds regardless.
    }
    tokenStore.clear();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
  isReady: () => get().status === 'ready',
}));

let nextToastId = 1;

export const useToastStore = create((set, get) => ({
  toasts: [],
  push(message, type = 'success', ttl = 3200) {
    const id = nextToastId;
    nextToastId += 1;
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => get().dismiss(id), ttl);
  },
  success: (m) => get().push(m, 'success'),
  error: (m) => get().push(m, 'error'),
  info: (m) => get().push(m, 'info'),
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const useUiStore = create((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}));
