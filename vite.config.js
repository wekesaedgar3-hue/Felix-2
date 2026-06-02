import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl =
    env.BACKEND_URL ||
    `http://127.0.0.1:${env.BACKEND_PORT || env.PORT || 4000}`;

  return defineConfig({
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  });
};
