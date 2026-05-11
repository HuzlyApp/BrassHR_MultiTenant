/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0EA5A4",
        primaryDark: "#0B8C8C",
      },
      boxShadow: {
        card: "0 20px 50px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};

module.exports = config;