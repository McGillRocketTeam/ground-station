// import reactScan from "@react-scan/vite-plugin-react-scan";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const proxy = {
  "/api": {
    target: "http://localhost:8090",
    ws: true,
  },
  "/rpc": "http://localhost:3000",
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    // reactScan(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy,
  },
  preview: {
    proxy,
  },
  envPrefix: ["VITE_", "YAMCS_", "MRT_", "MQTT_"],
});
