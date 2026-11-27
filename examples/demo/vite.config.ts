import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiPort = process.env.DEMO_API_PORT ?? "3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.DEMO_WEB_PORT ?? 5173),
    proxy: { "/api": `http://localhost:${apiPort}` },
  },
});
