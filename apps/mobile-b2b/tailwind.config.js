/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0ea5e9',
          light: '#22d3ee',
          dark: '#0284c7',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          border: 'rgba(255,255,255,0.10)',
          input: 'rgba(255,255,255,0.08)',
          'input-border': 'rgba(255,255,255,0.12)',
        },
        surface: {
          DEFAULT: '#020617',
          raised: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};
