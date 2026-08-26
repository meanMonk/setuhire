import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT) || 3001,
    host: true,
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:3400",
        changeOrigin: true,
      },
    },
  },
});
