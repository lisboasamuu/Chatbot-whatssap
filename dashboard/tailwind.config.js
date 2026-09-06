/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#0F195C',
          700: '#334DAF',
          500: '#7096D1',
          300: '#B0D4FE',
          100: '#E8F2FE',
          50: '#F9FBFF',
        },
      },
      boxShadow: {
        soft: '0 12px 35px rgba(15, 25, 92, 0.08)',
        panel: '0 18px 50px rgba(15, 25, 92, 0.12)',
      },
    },
  },
  plugins: [],
};
