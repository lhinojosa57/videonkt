/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
        parchment: {
          50: '#ffffff',
          100: '#fefdfb',
          200: '#faf7f2',
          300: '#f5f0e8',
        },
        sepia: {
          100: '#f3f4f6',
          200: '#e5e7eb',
        },
        gold: {
          300: '#f5d06a',
          400: '#d4af37',
          500: '#b8960c',
          600: '#9a7a00',
        },
        crimson: {
          400: '#c53030',
          500: '#9b1c1c',
          600: '#7b1414',
        },
        tesla: {
          400: '#4abe7a',
          500: '#2e8b3a',
          600: '#1f6b2a',
        },
      },
      boxShadow: {
        manuscript: '0 2px 8px rgba(63, 173, 106, 0.08)',
        raised: '0 4px 16px rgba(63, 173, 106, 0.12)',
      },
    },
  },
  plugins: [],
}