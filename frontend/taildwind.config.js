/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mindBlue: '#4f46e5',
        mindGlass: 'rgba(255, 255, 255, 0.7)',
      },
    },
  },
  plugins: [],
}