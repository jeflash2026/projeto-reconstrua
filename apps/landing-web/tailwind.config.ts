import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './sections/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        carbon: '#050505',
        graphite: '#101010',
        signal: '#C1121F',
        ember: '#E63946',
        gilt: '#D4AF37',
      },
    },
  },
};

export default config;
