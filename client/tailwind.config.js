export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eaf0f8',
          100: '#d4e0f2',
          200: '#a9c1e5',
          300: '#7a9fd4',
          400: '#4a78be',
          500: '#1e56a8',
          600: '#0f3a88',
          700: '#0c2e6e',
          800: '#0a2458',
          900: '#081c44',
          950: '#05102a'
        },
        accent: {
          50: '#fff6eb',
          100: '#ffe8cc',
          200: '#ffd199',
          300: '#ff9a3a',
          400: '#fc7a03',
          500: '#e86e02',
          600: '#c75e00',
          700: '#9a4900',
          800: '#7a3a00',
          900: '#5c2c00'
        },
        ink: {
          50: '#f4f6fa',
          100: '#e6eaf2',
          200: '#c5cddc',
          300: '#9aa8c0',
          400: '#6b7a96',
          500: '#4a5873',
          600: '#38455c',
          700: '#2c3648',
          800: '#222a38',
          900: '#121826',
          950: '#0a0e18'
        },
        cream: '#f6f7fb'
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 8px 30px -6px rgb(15 58 136 / 0.12)',
        lift: '0 20px 50px -12px rgb(15 58 136 / 0.20)'
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
