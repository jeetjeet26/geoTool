import type { Config } from 'tailwindcss';

const config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif']
      },
      colors: {
        brand: {
          DEFAULT: '#3B82F6',
          subtle: '#EFF6FF',
          bold: '#1D4ED8'
        },
        slate: {
          25: '#FBFBFD'
        }
      },
      boxShadow: {
        card: '0 8px 24px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;





