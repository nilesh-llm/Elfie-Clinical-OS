import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        clinical: {
          50: "#eefbfa",
          100: "#d6f3f1",
          200: "#aee6e3",
          300: "#7cd1d0",
          400: "#44b3ba",
          500: "#248f9b",
          600: "#1d7380",
          700: "#1c5d69",
          800: "#1c4b55",
          900: "#193f47",
        },
      },
      boxShadow: {
        panel: "0 24px 48px rgba(13, 74, 86, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
