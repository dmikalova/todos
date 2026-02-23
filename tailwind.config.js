import forms from "@tailwindcss/forms";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/public/index.html"],
  theme: {
    extend: {
      colors: {
        // Material Design Lime color palette
        lime: {
          50: "#F9FBE7",
          100: "#F0F4C3",
          200: "#E6EE9C",
          300: "#DCE775",
          400: "#D4E157",
          500: "#CDDC39",
          600: "#84c424",
          700: "#65a30d",
          800: "#4d7c0f",
          900: "#3f6212",
        },
      },
    },
  },
  plugins: [forms],
};
