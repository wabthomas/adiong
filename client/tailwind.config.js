/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefaf5',
          100: '#d6f3e7',
          200: '#b0e6d2',
          300: '#7dd2b7',
          400: '#45b697',
          500: '#219a7d',
          600: '#0e7c66',
          700: '#0d6353',
          800: '#0e4f43',
          900: '#0d4138',
          950: '#06251f'
        },
        accent: {
          50: '#fff9eb',
          100: '#ffeecc',
          200: '#ffd999',
          300: '#ffbe55',
          400: '#ff9f1a',
          500: '#f5a524',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f'
        },
        ink: {
          50: '#f4f7f6',
          100: '#e2eae8',
          200: '#c3d3cf',
          300: '#9ab3ad',
          400: '#6c8f88',
          500: '#4d716b',
          600: '#3d5a55',
          700: '#334a46',
          800: '#2b3c39',
          900: '#142320',
          950: '#0b1917'
        },
        cream: '#f7f5f0'
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 8px 30px -6px rgb(11 25 23 / 0.10)',
        lift: '0 20px 50px -12px rgb(11 25 23 / 0.18)'
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' }
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
        marquee: 'marquee 30s linear infinite'
      }
    }
  },
  plugins: []
};
