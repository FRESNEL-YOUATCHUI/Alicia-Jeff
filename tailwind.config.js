/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rose: {
          poudre: '#F4D4D8',
          saumon: '#E8A89A',
          profonde: '#D98A8A',
          poudreclaire: '#FBEDED',
        },
        champagne: {
          50: '#FBF6EF',
          100: '#F6EEDF',
          200: '#EEDDC4',
          300: '#E2CAA6',
        },
        creme: '#FBF7F1',
        vegetal: {
          100: '#EAF0E6',
          300: '#B9CDB0',
          500: '#7E9B72',
          700: '#5C7751',
        },
        encre: '#3A2E2F',
      },
      fontFamily: {
        script: ['"Great Vibes"', 'cursive'],
        serif: ['"Cormorant Garamond"', 'serif'],
        sans: ['"Jost"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(-120vh) translateX(40px) rotate(360deg)', opacity: '0' },
        },
        sway: {
          '0%, 100%': { transform: 'translateX(-8px) rotate(-4deg)' },
          '50%': { transform: 'translateX(8px) rotate(4deg)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '15%': { transform: 'scale(1.08)' },
          '30%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.05)' },
          '60%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        heartOpen: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '40%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(8)', opacity: '0' },
        },
        petalBurst: {
          '0%': { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translate(var(--bx), var(--by)) scale(0.2) rotate(720deg)', opacity: '0' },
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        floatUp: 'floatUp 12s linear infinite',
        sway: 'sway 6s ease-in-out infinite',
        heartbeat: 'heartbeat 2.4s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
        fadeUp: 'fadeUp 0.9s ease-out both',
        fadeIn: 'fadeIn 1.2s ease-out both',
        heartOpen: 'heartOpen 1.4s ease-in forwards',
        petalBurst: 'petalBurst 1.6s ease-out forwards',
        spinSlow: 'spinSlow 24s linear infinite',
      },
    },
  },
  plugins: [],
};
