/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10233f',
        mist: '#f4f7fb',
        cyanbrand: '#1cc8c5',
        indigo: '#5e63ff',
      },
      boxShadow: {
        panel: '0 12px 40px rgba(16, 35, 63, 0.07)',
      },
    },
  },
  plugins: [],
};
