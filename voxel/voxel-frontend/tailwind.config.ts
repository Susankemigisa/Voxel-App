import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        dm: ['DM Sans', 'sans-serif'],
      },
      colors: {
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#0b9488',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        voxel: {
          bg:      '#0a0f1e',
          surface: '#111827',
          card:    '#1a2236',
          border:  '#1f2d45',
          teal:    '#0b9488',
          teal2:   '#14b8a6',
          accent:  '#f97316',
          muted:   '#64748b',
          text:    '#e2e8f0',
          subtle:  '#94a3b8',
        }
      },
      backgroundImage: {
        'mesh-teal': 'radial-gradient(at 27% 37%, hsla(215,98%,61%,0.08) 0px, transparent 50%), radial-gradient(at 97% 21%, hsla(172,98%,50%,0.12) 0px, transparent 50%), radial-gradient(at 52% 99%, hsla(215,98%,61%,0.05) 0px, transparent 50%)',
        'glow-teal': 'radial-gradient(ellipse at center, rgba(11,148,136,0.15) 0%, transparent 70%)',
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'bounce-slow':  'bounce 2s infinite',
        'fade-in':      'fadeIn 0.5s ease-out forwards',
        'slide-up':     'slideUp 0.4s ease-out forwards',
        'waveform':     'waveform 1.2s ease-in-out infinite',
        'ring-pulse':   'ringPulse 2s ease-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' },                     to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        waveform:  { '0%,100%': { transform: 'scaleY(0.3)' },   '50%': { transform: 'scaleY(1)' } },
        ringPulse: { '0%': { transform: 'scale(1)', opacity: '0.8' }, '100%': { transform: 'scale(1.8)', opacity: '0' } },
      },
      boxShadow: {
        'teal-glow':  '0 0 30px rgba(11,148,136,0.3)',
        'teal-soft':  '0 0 15px rgba(11,148,136,0.15)',
        'card':       '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
export default config
