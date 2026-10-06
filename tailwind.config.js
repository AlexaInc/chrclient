/** @type {import('tailwindcss').Config} */
module.exports = {
  // dark mode is driven by the in-app switch (Settings / side menu), not by
  // the OS: the operator flips it inside the app and it is remembered on the device
  darkMode: 'class',
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        sidebar: '#043622',
        'sidebar-card': '#09482d',
        'sidebar-card-border': '#065f46',
        surface: '#f4f7f6',
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
    },
  },
  plugins: [],
};
