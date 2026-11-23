import { create } from 'zustand';
import type { PublicUser } from '@fluentpath/shared';
import { api } from '../lib/api.ts';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  initialized: boolean;
  fetchUser: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
  loginGuest: () => Promise<PublicUser>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  fetchUser: async () => {
    try {
      set({ loading: true });
      const { user } = await api.getMe();
      if (!user) {
        localStorage.removeItem('fp_auth_token');
      }
      set({ user, initialized: true, loading: false });
    } catch {
      set({ user: null, initialized: true, loading: false });
    }
  },

  setUser: (user) => {
    if (!user) localStorage.removeItem('fp_auth_token');
    set({ user });
  },

  loginGuest: async () => {
    set({ loading: true });
    try {
      const { user, token } = await api.guest();
      if (token) {
        localStorage.setItem('fp_auth_token', token);
      }
      set({ user, loading: false, initialized: true });
      return user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } finally {
      localStorage.removeItem('fp_auth_token');
      set({ user: null });
    }
  },
}));
