import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07070a', 900: '#0d0d12', 850: '#121218', 800: '#17171f', 700: '#22222c', 600: '#2e2e3a', 500: '#4a4a58' },
        bone: { DEFAULT: '#ece9e2', muted: '#a3a1ab', dim: '#6f6d78' },
        blood: { DEFAULT: '#ff5a1f', soft: '#ff7a45', deep: '#c2410c' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
      },
      boxShadow: { glow: '0 0 0 1px rgba(255,90,31,.35), 0 8px 30px -8px rgba(255,90,31,.35)' },
    },
  },
  plugins: [],
} satisfies Config
