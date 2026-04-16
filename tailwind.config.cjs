/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{tsx,ts,html}"],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: {
          DEFAULT: "#3B82F6",
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        // Profit
        profit: {
          DEFAULT: "#10B981",
          dim: "rgba(16, 185, 129, 0.15)",
          border: "rgba(16, 185, 129, 0.3)",
        },
        // Loss
        loss: {
          DEFAULT: "#F43F5E",
          dim: "rgba(244, 63, 94, 0.15)",
          border: "rgba(244, 63, 94, 0.3)",
        },
        // Warning
        warn: {
          DEFAULT: "#F59E0B",
          dim: "rgba(245, 158, 11, 0.15)",
          border: "rgba(245, 158, 11, 0.3)",
        },
        // Neutral surface
        navy: {
          950: "#030712",
          900: "#060B18",
          800: "#0D1629",
          700: "#111C35",
          600: "#172140",
          500: "#1E2D52",
          400: "#2A3F6F",
          300: "#3D5590",
          200: "#5B77B8",
          100: "#8AA3D4",
          50:  "#C4D2EC",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "glow-blue": "glowBlue 2s ease-in-out infinite",
        "glow-red": "glowRed 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        glowBlue: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(59, 130, 246, 0)" },
        },
        glowRed: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(244, 63, 94, 0.5)" },
          "50%": { boxShadow: "0 0 0 10px rgba(244, 63, 94, 0)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        "glow-blue": "0 0 20px rgba(59, 130, 246, 0.4)",
        "glow-red": "0 0 20px rgba(244, 63, 94, 0.4)",
        "glow-green": "0 0 20px rgba(16, 185, 129, 0.4)",
      },
    },
  },
  plugins: [],
};

