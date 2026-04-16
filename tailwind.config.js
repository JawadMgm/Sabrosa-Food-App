/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // This forces every normal text element to use Cinzel
        sans: ['Cinzel', 'serif'],
        // This forces all the special headings in your App.js to use Cinzel
        display: ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
}