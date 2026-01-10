import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true, // listen on 0.0.0.0 so other devices on LAN can access
    port: 5173,
    strictPort: true,
    https: true,
  },
});
