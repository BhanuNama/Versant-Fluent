import { create } from 'zustand';
import type { PublicItem, SessionState } from '@fluentpath/shared';
import { api } from '../lib/api.ts';

interface TestStoreState {
  session: SessionState | null;
  currentItemIndex: number;
  itemDrafts: Record<string, string>;
  pastedFlags: Record<string, { pasted: boolean; pasteChars: number }>;
  loading: boolean;
  error: string | null;

  setSession: (session: SessionState | null) => void;
  setCurrentItemIndex: (index: number) => void;
  setDraft: (key: string, text: string) => void;
  recordPaste: (key: string, chars: number) => void;
  fetchSessionState: (sessionId: string) => Promise<void>;
  reset: () => void;
}

export const useTestStore = create<TestStoreState>((set, get) => ({
  session: null,
  currentItemIndex: 0,
  itemDrafts: {},
  pastedFlags: {},
  loading: false,
  error: null,

  setSession: (session) => {
    set((state) => {
      // If we don't have an active index or session changed to new part, compute initial index
      let nextIdx = state.currentItemIndex;
      if (!state.session || state.session.part !== session?.part) {
        nextIdx = 0;
        if (session) {
          const answeredSet = new Set(session.answered);
          const foundIdx = session.items.findIndex((it) => !answeredSet.has(it.id));
          if (foundIdx >= 0) nextIdx = foundIdx;
        }
      }
      return { session, currentItemIndex: nextIdx };
    });
  },

  setCurrentItemIndex: (currentItemIndex) => set({ currentItemIndex }),

  setDraft: (key, text) => {
    set((state) => ({
      itemDrafts: { ...state.itemDrafts, [key]: text },
    }));
  },

  recordPaste: (key, chars) => {
    set((state) => ({
      pastedFlags: {
        ...state.pastedFlags,
        [key]: { pasted: true, pasteChars: (state.pastedFlags[key]?.pasteChars || 0) + chars },
      },
    }));
  },

  fetchSessionState: async (sessionId: string) => {
    set({ loading: true, error: null });
    try {
      const state = await api.getSessionState(sessionId);
      get().setSession(state);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  reset: () => set({ session: null, currentItemIndex: 0, itemDrafts: {}, pastedFlags: {}, error: null }),
}));
