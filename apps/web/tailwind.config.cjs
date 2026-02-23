const { radixThemePreset } = require("radix-themes-tw");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [radixThemePreset],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "Berkeley Mono",
          "JetBrains Mono",
          "Consolas",
          "Monaco",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
  darkMode: "class",
};
