/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./web/**/*.{html,js}",
    "./web/*.html",
    "./web/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'indigo': {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Theme-aware colors
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        accent: 'var(--accent-color)',
        card: 'var(--bg-card)',
        'card-hover': 'var(--bg-card-hover)',
        'border-card': 'var(--border-card)',
        body: 'var(--bg-body)',
      }
    },
  },
  plugins: [],
}