/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: '#faf9f6',
        'cream-2': '#f2f0ea',
        ink: '#21201c',
        'ink-soft': '#5c594f',
        line: '#e4e1d8',
        blue: { DEFAULT: '#185FA5', light: '#378ADD', tint: '#e6f1fb' },
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
