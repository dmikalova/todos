// Vite configuration for Vue.js frontend
// Run with: deno task build (from src/frontend/)

import vue from "@vitejs/plugin-vue";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],

  // PostCSS configuration for Tailwind CSS
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: "./tailwind.config.js" }),
        autoprefixer(),
      ],
    },
  },

  // Build output configuration - output to src/public/dist for Hono to serve
  build: {
    outDir: "../public/dist",
    emptyOutDir: true,
    // Generate source maps for debugging
    sourcemap: true,
  },

  // Development server configuration
  server: {
    port: 5173,
    // Proxy API requests to backend during development
    // Use ^/api/ to avoid matching /api.ts frontend file
    proxy: {
      "^/api/": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },

  // Resolve TypeScript path aliases
  resolve: {
    alias: {
      "@": "./",
    },
  },

  // Enable TypeScript and define global constants
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
});
