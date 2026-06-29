import type { Config } from 'tailwindcss'

// KKR brand kit — navy + bright blue, gold accent, clean sans. Token names kept
// from the prior theme so the remap propagates without touching every component.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#001026', // deep navy base
        'bg-secondary': '#001A3A', // KKR primary navy
        'bg-card': '#04203f', // navy card
        'bg-elevated': '#062a52', // raised navy
        accent: '#00A3E0', // KKR bright blue
        'accent-light': '#33b8e8',
        'accent-bright': '#66caef',
        gold: '#C8A96E', // KKR premium gold
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        'text-primary': '#FFFFFF',
        'text-secondary': '#c7d6e6', // light blue-gray
        'text-muted': '#8aa0b8',
        'text-dim': '#5a708a',
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '12px', input: '8px', pill: '100px' },
    },
  },
  plugins: [],
}
export default config
