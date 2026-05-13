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
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#0f172a',
          card: '#1e293b',
          elevated: '#334155',
        },
      },
    },
  },
  plugins: [],
};
