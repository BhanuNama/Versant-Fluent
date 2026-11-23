/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: {
          DEFAULT: '#3B5BDB',
          hover: '#364FC7',
          light: '#EDF2FF',
          dark: '#748FFC',
        },
        lavender: {
          50: '#FBF9FE',
          100: '#F3EEFF',
          200: '#E9DEFF',
          300: '#D6C2FE',
          500: '#845EC2',
        },
        success: '#2F9E44',
        warning: '#F08C00',
        error: '#E03131',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Newsreader', 'Inter', 'serif'],
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        card: '0 10px 30px -4px rgba(124, 58, 237, 0.06), 0 4px 12px -2px rgba(0, 0, 0, 0.03)',
        floating: '0 20px 40px -10px rgba(79, 70, 229, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
