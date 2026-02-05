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
        accent: '#FFA726',
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6', // Added a default blue for admin/info
        neutral: {
          // Providing a scale for neutral colors based on standard gray
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#37474f', // Main text color as per guide
          800: '#1f2937',
          900: '#11182c',
        },
        text: '#37474F',
        background: '#F5F7FA',
        rides: {
          primary: '#00897B', // Warm Teal
          hover: '#00796B',
          bg: '#E0F2F1',
        },
      },
    },
  },
  plugins: [],
};
//