export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf4e7',
          100: '#fbe9cf',
          200: '#f7d39f',
          300: '#f3be6f',
          400: '#efa83f',
          500: '#eb920f',
          600: '#bc750c',
          700: '#8d5809',
          800: '#5e3a06',
          900: '#2f1d03',
        },
        secondary: {
          50: '#f2f7f2',
          100: '#e5efe5',
          200: '#cbdfcb',
          300: '#b2cfb2',
          400: '#98bf98',
          500: '#7eaf7e',
          600: '#658c65',
          700: '#4c694c',
          800: '#324632',
          900: '#192319',
        },
        accent: {
          50: '#fcf0f0',
          100: '#f9e1e1',
          200: '#f3c3c3',
          300: '#eda5a5',
          400: '#e78787',
          500: '#e16969',
          600: '#b45454',
          700: '#873f3f',
          800: '#5a2a2a',
          900: '#2d1515',
        },
        neutral: {
          50: '#f7f4f1',
          100: '#efe9e3',
          200: '#dfd3c7',
          300: '#cfbdab',
          400: '#bfa78f',
          500: '#af9173',
          600: '#8c745c',
          700: '#695745',
          800: '#463a2e',
          900: '#231d17',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      backgroundImage: {
        'hero-pattern': "url('https://images.unsplash.com/photo-1625607069402-d3841e051510?q=80&w=2070&auto=format&fit=crop')",
      }
    },
  },
  plugins: [],
}