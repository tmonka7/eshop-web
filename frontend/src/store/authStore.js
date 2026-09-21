import { create } from 'zustand';
import { authApi } from '../api';
import { tokenStore } from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle', // idle | loading | ready
  error: '',

  isAuthenticated: () => Boolean(get().user),
  isStaff: () => Boolean(get().user && get().user.role !== 'customer'),

  /** Called once on boot: restores the session from a stored refresh token. */
  async bootstrap() {
    if (!tokenStore.access && !tokenStore.refresh) {
      set({ status: 'ready' });
      return;
    }
    set({ status: 'loading' });
    try {
      const res = await authApi.me();
      set({ user: res.data, status: 'ready' });
    } catch (_err) {
      tokenStore.clear();
      set({ user: null, status: 'ready' });
    }
  },

  async login(email, password) {
    set({ error: '' });
    const res = await authApi.login({ email, password });
    tokenStore.set(res.data);
    set({ user: res.data.user });
    return res.data.user;
  },

  async register(payload) {
    set({ error: '' });
    const res = await authApi.register(payload);
    tokenStore.set(res.data);
    set({ user: res.data.user });
    return res.data.user;
  },

  async logout() {
    try {
      await authApi.logout(tokenStore.refresh);
    } catch (_err) {
      // The local session is cleared regardless of what the server says.
    }
    tokenStore.clear();
    set({ user: null });
  },

  setUser: (user) => set({ user }),

  /** Keeps the header heart icon in sync without a refetch. */
  toggleWishlistLocal(productId, inWishlist) {
    const { user } = get();
    if (!user) return;
    const ids = (user.wishlist || []).map((w) => (typeof w === 'string' ? w : w._id));
    const next = inWishlist
      ? [...new Set([...ids, productId])]
      : ids.filter((id) => id !== productId);
    set({ user: { ...user, wishlist: next } });
  },
}));
