import { create } from 'zustand';

interface UiState {
  theme: 'light' | 'dark';
  reducedMotion: boolean;
  captionsEnabled: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setReducedMotion: (enabled: boolean) => void;
  toggleCaptions: () => void;
}

const savedTheme = (localStorage.getItem('fp_theme') as 'light' | 'dark') || 'light';
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

export const useUiStore = create<UiState>((set) => ({
  theme: savedTheme,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  captionsEnabled: false,

  setTheme: (theme) => {
    localStorage.setItem('fp_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },

  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('fp_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: next };
    });
  },

  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  toggleCaptions: () => set((state) => ({ captionsEnabled: !state.captionsEnabled })),
}));
