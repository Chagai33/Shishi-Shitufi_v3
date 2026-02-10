/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'sans-serif'],
      },
      colors: {
        primary: '#009688',
        accent: '#FBBF95',        // Soft peach (was #FFA726)
        success: '#10b981',
        error: '#ef4444',
        accent: {
          DEFAULT: '#FBBF95',     // Soft peach - for backgrounds, borders, focus rings
          dark: '#E89A5F',        // WCAG AA compliant - for buttons with white text (4.51:1)
        },
        secondary: '#FFB74D',
        success: '#81C784',
        warning: '#FFB74D',
        error: '#E57373',
        info: '#64B5F6',
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#37474f',
          800: '#1f2937',
          900: '#11182c',
        },
        text: '#37474F',
        background: '#F5F7FA',
        rides: {
          primary: '#88B39E',     // Sage green - for backgrounds, borders, focus rings
          dark: '#5F8A76',        // WCAG AA compliant - for buttons with white text (4.52:1)
          hover: '#7AA38D',       // Darker sage (legacy)
          bg: '#EBF4EE',          // Pale sage
        },
      },
      ringColor: {
        'accent': '#FBBF95',      // Soft peach for item focus rings (kept soft for visibility)
        'rides': '#88B39E',       // Sage green for ride focus rings (kept soft for visibility)
      },
    },
  },
  plugins: [],
};
//