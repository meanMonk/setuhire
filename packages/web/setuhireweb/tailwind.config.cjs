/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
        },
        accent: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          400: "#34D399",
          600: "#059669",
          700: "#047857",
        },
        secondary: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
        },
        warning: {
          100: "#FEF9C3",
          500: "#CA8A04",
          700: "#A16207",
        },
        danger: {
          100: "#FEE2E2",
          500: "#DC2626",
          700: "#B91C1C",
        },
        surface: {
          bg: "#FFFBF5",
          card: "#FFFFFF",
          border: "#F0E4D4",
        },
        ink: {
          900: "#1C1917",
          600: "#57534E",
          400: "#A8A29E",
          200: "#E7E5E4",
        },
        sidebar: {
          bg: "#0F172A",
          text: "#94A3B8",
          "text-muted": "#64748B",
          hover: "rgba(255,255,255,0.05)",
          active: "rgba(234,88,12,0.15)",
          border: "rgba(255,255,255,0.1)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Poppins", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 25, 23, 0.04), 0 1px 3px rgba(28, 25, 23, 0.06)",
      },
    },
  },
  plugins: [],
};
