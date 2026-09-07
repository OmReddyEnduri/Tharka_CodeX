import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  // `vite preview` (what install-service.cjs runs, so this always-on
  // dashboard serves a real production build instead of an unminified dev
  // server) doesn't inherit the `server` block above - it needs its own.
  // No proxy needed here: apiClient.ts already talks to an absolute
  // getServerUrl(), never a relative /api path.
  preview: {
    host: "::",
    port: 5174,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
