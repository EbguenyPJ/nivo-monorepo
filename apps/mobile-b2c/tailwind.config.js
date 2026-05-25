/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#0c0f1a',
          card: 'rgba(255,255,255,0.06)',
          elevated: 'rgba(255,255,255,0.1)',
          muted: 'rgba(255,255,255,0.03)',
        },
        glass: {
          light: 'rgba(255,255,255,0.08)',
          medium: 'rgba(255,255,255,0.12)',
          heavy: 'rgba(255,255,255,0.18)',
          border: 'rgba(255,255,255,0.1)',
        },
        warm: {
          50: '#faf8f6',
          100: '#f5f0eb',
          200: '#e8ddd3',
          800: '#2a2520',
          900: '#1a1714',
        },
      },
      borderRadius: {
        '3xl': 24,
        '4xl': 32,
      },
    },
  },
  plugins: [],
};
