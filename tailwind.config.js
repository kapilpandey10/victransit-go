/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Calm early-years palette
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        sand: {
          50: '#fdfcf9',
          100: '#faf7ef',
          200: '#f4ecdb',
          300: '#ebdcc0',
          400: '#ddc79a',
          500: '#cdae74',
        },
        clay: {
          400: '#e08a5f',
          500: '#d1734a',
          600: '#b85a35',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.12)',
        lift: '0 12px 40px -12px rgba(15,118,110,0.35)',
      },
      minHeight: {
        touch: '44px',
      },
      spacing: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}