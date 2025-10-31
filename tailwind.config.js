/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#1E3A8A',
        'brand-secondary': '#3B82F6',
        'brand-accent': '#F59E0B',
        'brand-light': '#F3F4F6',
        'brand-dark': '#111827',
      },
    },
  },
  plugins: [],
}
