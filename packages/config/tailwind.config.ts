import type { Config } from 'tailwindcss';

const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#06B6D4',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#22C55E',
          foreground: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
