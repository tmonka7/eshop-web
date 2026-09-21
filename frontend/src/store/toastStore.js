import { create } from 'zustand';

let nextId = 1;

export const useToastStore = create((set, get) => ({
  toasts: [],

  push(message, type = 'success', ttl = 3200) {
    const id = nextId;
    nextId += 1;
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => get().dismiss(id), ttl);
    return id;
  },

  success: (message) => get().push(message, 'success'),
  error: (message) => get().push(message, 'error'),
  info: (message) => get().push(message, 'info'),

  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** Convenience helper for use outside React components. */
export const toast = {
  success: (m) => useToastStore.getState().success(m),
  error: (m) => useToastStore.getState().error(m),
  info: (m) => useToastStore.getState().info(m),
};
