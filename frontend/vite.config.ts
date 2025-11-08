import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from root directory (one level up)
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  
  return {
  server: {
    host: "::",
      port: parseInt(env.VITE_PORT || '3001'), // Default to 3001
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        }
      }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
    // Load .env from root directory
    envDir: path.resolve(__dirname, '..'),
  };
});
