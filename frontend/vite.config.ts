import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({
  base: '/',
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  ssr: {
    noExternal: ["react-router-dom"],
  },
  server: {
    host: '127.0.0.1',  // Force Vite to use IP address
    port: 5173,
    strictPort: true,   // Don't try other ports if 5173 is busy
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',  // Match Django server
        changeOrigin: true,
        secure: false,
      }
    },
    hmr: {
      overlay: false, // to disable the red overlay error
    },
  },
});
