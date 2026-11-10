// ABOUTME: Tailwind CSS configuration with PoE-inspired dark theme colors and typography.
// ABOUTME: PoE palette plus shadcn/ui CSS-variable colors (dark only) and radius tokens.

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
        poe: {
          bg: '#0C0C0E',
          panel: '#1A1A2E',
          'panel-light': '#252540',
          border: '#2A2A3E',
          gold: '#AF6025',
          currency: '#FFD700',
          chaos: '#D02020',
          divine: '#FF6B00',
          exalt: '#FFCC00',
          rare: '#FF0',
          magic: '#8888FF',
          unique: '#AF6025',
          gem: '#1BA29B',
          normal: '#C8C8C8',
          text: '#E8E4D9',
          'text-dim': '#8B8680',
          'text-muted': '#7F7A74',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: 'calc(var(--radius) - 2px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};

export default config;
