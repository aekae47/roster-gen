/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        darkbg: '#0f172a',
        darkcard: '#1e293b'
      }
    },
  },
  plugins: [],
}
