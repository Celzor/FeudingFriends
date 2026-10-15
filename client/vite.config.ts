import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 3011,
    strictPort: true,
    proxy: {
      "/socket.io": { target: "http://127.0.0.1:3010", ws: true },
      "/health": "http://127.0.0.1:3010",
    },
  },
});
