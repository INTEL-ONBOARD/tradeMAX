/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{tsx,ts,html}"],
  theme: {
    extend: {
      colors: {
        primary: "#5A189A",
        accent: "#FFD60A",
      },
    },
  },
  plugins: [],
};
