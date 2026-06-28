import type { Config } from 'tailwindcss'

// AuraFlow brand kit — dark theme, purple accent, mono for data.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#030305',
        'bg-secondary': '#0a0a0f',
        'bg-card': '#0c0a12',
        'bg-elevated': '#141220',
        accent: '#8b5cf6',
        'accent-light': '#a78bfa',
        'accent-bright': '#c4b5fd',
        gold: '#d4af37',
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        'text-primary': '#faf5ff',
        'text-secondary': '#c4b5fd',
        'text-muted': '#7c7291',
        'text-dim': '#4a4458',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '16px', input: '12px', pill: '100px' },
    },
  },
  plugins: [],
}
export default config
