/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        dot: ['"DotGothic16"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      colors: {
        airas: {
          dark: '#0d1117',
          panel: 'rgba(22, 27, 34, 0.85)',
          border: 'rgba(255, 255, 255, 0.1)',
          cyan: '#38bdf8',
          accent: '#f59e0b',
          retro: '#fef08a',
        }
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
