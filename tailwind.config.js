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
          300: '#4abe7a',
          400: '#3fad6a',
          500: '#36995d',
          600: '#2d7a4b',
        },
        crimson: {
          400: '#36995d',
          500: '#2d7a4b',
          600: '#25643e',
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