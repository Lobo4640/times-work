import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E8C97A',
          dim: '#8B6914',
        },
        cyan: {
          active: '#00E5FF',
          dim: '#00B8D4',
          glow: 'rgba(0, 229, 255, 0.2)', // Formato corregido para transparencia
        },
        surface: {
          DEFAULT: '#0A0A0F',
          card: '#111118',
          elevated: '#1A1A24',
          border: '#2A2A38',
        },
      },
      fontFamily: {
        // Asegúrate de que coincidan con las variables de globals.css
        display: ['var(--font-display)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'tick': 'tick 1s steps(1) infinite',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { 
            textShadow: '0 0 20px rgba(0, 229, 255, 0.6), 0 0 40px rgba(0, 229, 255, 0.3)',
            opacity: '1' 
          },
          '50%': { 
            textShadow: '0 0 30px rgba(0, 229, 255, 0.8), 0 0 60px rgba(0, 229, 255, 0.5)',
            opacity: '0.85'
          },
        },
        'tick': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' }, // Un poco de opacidad para que no desaparezca del todo
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
export default config
