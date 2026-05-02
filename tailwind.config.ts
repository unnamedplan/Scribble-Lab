import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Arial", "sans-serif"],
        body: ["var(--font-body)", "Arial", "sans-serif"],
      },
      colors: {
        ink: "#111111",
        paper: "#f6f6f1",
        bone: "#e9e3d5",
        signal: "#f04f2b",
        acid: "#b7ff2a",
        cyan: "#48d6ff",
      },
      boxShadow: {
        brutal: "8px 8px 0 #111111",
        soft: "0 22px 80px rgba(17, 17, 17, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
