/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          100: '#f5f0e8',
          200: '#e8dcc8',
          300: '#c4b5a0',
          400: '#9b8970',
          500: '#7a6b54',
          600: '#5c4f3c',
          700: '#3d2c14',
          800: '#2d1f0e',
          900: '#1a1208',
        },
        parchment: {
          50: '#fdf8f0',
          100: '#faf3e6',
          200: '#f4e9d4',
          300: '#e8d3a9',
        },
        sepia: {
          100: '#f4e9d4',
          200: '#e8d3a9',
        },
        gold: {
          300: '#e8c07e',
          400: '#d4af37',
          500: '#b8960c',
          600: '#9b7c0a',
        },
        crimson: {
          200: '#f5b8b8',
          400: '#d43f3f',
          500: '#9b1c1c',
          600: '#7d1717',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Source Serif 4', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        manuscript: '0 2px 8px rgba(26, 18, 8, 0.08), 0 1px 3px rgba(26, 18, 8, 0.06)',
        raised: '0 4px 16px rgba(26, 18, 8, 0.12), 0 2px 6px rgba(26, 18, 8, 0.08)',
      },
    },
  },
  plugins: [],
}