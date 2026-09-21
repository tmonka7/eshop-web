import { create } from 'zustand';
import { cartApi } from '../api';

const GUEST_KEY = 'auramart.guestCart';

const emptyTotals = { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 };

const readGuestCart = () => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
  } catch (_err) {
    return [];
  }
};

const writeGuestCart = (items) => localStorage.setItem(GUEST_KEY, JSON.stringify(items));

/**
 * The cart lives on the server for signed-in shoppers and in localStorage for
 * guests. `merge()` folds the guest cart into the account cart at sign-in.
 */
export const useCartStore = create((set, get) => ({
  items: [],
  totals: emptyTotals,
  coupon: null,
  rules: { freeShippingThreshold: 50, flatRate: 9.99, taxRate: 0.1 },
  notices: [],
  loading: false,
  guest: [],

  // Kept as plain state (not a getter) because the server's cart payload carries
  // an `itemCount` field of its own and is spread straight into the store.
  itemCount: 0,

  loadGuest() {
    const guest = readGuestCart();
    set({ guest, items: guest, ...derive(guest, get().rules) });
  },

  async load(isAuthenticated) {
    if (!isAuthenticated) {
      get().loadGuest();
      return;
    }
    set({ loading: true });
    try {
      const res = await cartApi.get();
      set({ ...res.data, loading: false });
    } catch (_err) {
      set({ loading: false });
    }
  },

  async add(product, quantity = 1, variant = null, isAuthenticated = false) {
    if (isAuthenticated) {
      const res = await cartApi.addItem({ productId: product._id, quantity, variant });
      set(res.data);
      return res.message;
    }

    const guest = readGuestCart();
    const key = variant?.value || '';
    const existing = guest.find((g) => g.productId === product._id && (g.variant?.value || '') === key);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock);
    } else {
      guest.push({
        _id: `${product._id}:${key}`,
        productId: product._id,
        quantity: Math.min(quantity, product.stock),
        variant: variant || { name: '', value: '' },
        price: product.price,
        product: {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          image: product.images?.[0] || '',
          price: product.price,
          comparePrice: product.comparePrice,
          stock: product.stock,
          freeShipping: product.freeShipping,
        },
      });
    }
    writeGuestCart(guest);
    set({ guest, items: guest, ...derive(guest, get().rules) });
    return 'Added to cart';
  },

  async update(itemId, quantity, isAuthenticated) {
    if (isAuthenticated) {
      const res = await cartApi.updateItem(itemId, quantity);
      set(res.data);
      return;
    }
    let guest = readGuestCart();
    guest = quantity <= 0
      ? guest.filter((g) => g._id !== itemId)
      : guest.map((g) => (g._id === itemId ? { ...g, quantity } : g));
    writeGuestCart(guest);
    set({ guest, items: guest, ...derive(guest, get().rules) });
  },

  async remove(itemId, isAuthenticated) {
    if (isAuthenticated) {
      const res = await cartApi.removeItem(itemId);
      set(res.data);
      return;
    }
    const guest = readGuestCart().filter((g) => g._id !== itemId);
    writeGuestCart(guest);
    set({ guest, items: guest, ...derive(guest, get().rules) });
  },

  async clear(isAuthenticated) {
    if (isAuthenticated) {
      const res = await cartApi.clear();
      set(res.data);
      return;
    }
    writeGuestCart([]);
    set({ guest: [], items: [], totals: emptyTotals, itemCount: 0 });
  },

  async applyCoupon(code) {
    const res = await cartApi.applyCoupon(code);
    set(res.data);
    return res.message;
  },

  async removeCoupon() {
    const res = await cartApi.removeCoupon();
    set(res.data);
  },

  /** Push the guest cart to the server right after a successful sign-in. */
  async merge() {
    const guest = readGuestCart();
    if (guest.length) {
      const res = await cartApi.merge(
        guest.map((g) => ({ productId: g.productId, quantity: g.quantity, variant: g.variant })),
      );
      writeGuestCart([]);
      set({ ...res.data, guest: [] });
    } else {
      await get().load(true);
    }
  },

  reset: () => set({ items: [], totals: emptyTotals, coupon: null, notices: [], itemCount: 0 }),
}));

/** Builds the same `{ totals, itemCount }` shape the server returns for a cart. */
function derive(items, rules) {
  return {
    totals: computeGuestTotals(items, rules),
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
  };
}

/** Mirrors the server's pricing service so guest totals match the real ones. */
function computeGuestTotals(items, rules) {
  const subtotal = round2(items.reduce((s, i) => s + i.price * i.quantity, 0));
  const everyFree = items.length > 0 && items.every((i) => i.product?.freeShipping);
  const shipping = subtotal === 0 || everyFree || subtotal >= rules.freeShippingThreshold
    ? 0
    : round2(rules.flatRate);
  const tax = round2(subtotal * rules.taxRate);
  return { subtotal, discount: 0, shipping, tax, total: round2(subtotal + shipping + tax) };
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
