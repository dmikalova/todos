/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/index.html", "./src/**/*.{vue,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Material Design Lime color palette
        primary: {
          50: "#F9FBE7",
          100: "#F0F4C3",
          200: "#E6EE9C",
          300: "#DCE775",
          400: "#D4E157",
          500: "#CDDC39",
          600: "#C0CA33",
          700: "#AFB42B",
          800: "#9E9D24",
          900: "#827717",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Consolas",
          "Monaco",
          "monospace",
        ],
      },
      boxShadow: {
        // Material Design elevation shadows
        "elevation-1": "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        "elevation-2": "0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)",
        "elevation-3":
          "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)",
        "elevation-4":
          "0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)",
        "elevation-5":
          "0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)",
      },
    },
  },
  plugins: [
    // @tailwindcss/forms for better form styling
    require("@tailwindcss/forms"),
  ],
};
