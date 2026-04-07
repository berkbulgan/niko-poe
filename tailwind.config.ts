// ABOUTME: Tailwind CSS configuration with PoE-inspired dark theme colors and typography.
// ABOUTME: Defines custom color palette matching Path of Exile item rarity and currency styling.

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
          'text-muted': '#5A5650',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
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
  ],
};

export default config;
