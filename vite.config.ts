import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true, // Allow access from external domains
    port: 3009, // Or 5173 if you prefer Vite default
    allowedHosts: ['localhost', 'nodeh.amkwebsolutions.com'],
  },
  preview: {
    host: true,
    port: 3009,
    allowedHosts: ['localhost', 'nodeh.amkwebsolutions.com'],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
