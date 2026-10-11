import type { Config } from "tailwindcss";

/**
 * Design tokens for the team app. The public client websites style themselves from each
 * website's own brand colours (see SiteRenderer); everything here is the *tool* around them.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#15212e", soft: "#55657a", faint: "#90a0b3" },
        brand: { DEFAULT: "#0f5c55", dark: "#0a443f", light: "#e8f3f1", ring: "#2a8f84" },
        // Page background vs. card surface, so cards read as raised rather than outlined.
        surface: { DEFAULT: "#ffffff", sunken: "#f4f6f8", line: "#e3e8ee" },
        // One colour per state, used the same way on every screen.
        live: { DEFAULT: "#0b7a53", light: "#e6f5ee" },
        draft: { DEFAULT: "#9a6700", light: "#fdf5e3" },
        stop: { DEFAULT: "#b42318", light: "#fdecea" },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
      },
      borderRadius: { lg: "0.625rem", xl: "0.875rem", "2xl": "1.125rem" },
      boxShadow: {
        sm: "0 1px 2px rgba(21,33,46,.06), 0 1px 3px rgba(21,33,46,.04)",
        md: "0 2px 4px rgba(21,33,46,.05), 0 4px 12px rgba(21,33,46,.07)",
        lg: "0 8px 28px rgba(21,33,46,.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
