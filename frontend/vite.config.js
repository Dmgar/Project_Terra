import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El proxy de /api también en `vite preview`, para probar el build de producción contra la API local.
const apiProxy = { "/api": "http://localhost:5000" };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
});
