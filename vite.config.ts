import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    /*
      The API runs beside Vite (`server/dev.ts`, port 8787). Keeping the browser on
      same-origin `/api` in development and production means the repository does
      not need an environment-specific base URL, and the Firebase token is never
      sent cross-origin.
    */
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    /*
      GSAP must be a single copy.
      `gsap` and `gsap/ScrollTrigger` each carry their own reference to the core,
      and without this they can be bundled as two. Registering the plugin on one
      while a timeline runs on the other makes every `scrollTrigger:` option a
      no-op — silently, with no warning. Dedupe makes it one module regardless of
      how the imports are written.
    */
    dedupe: ["gsap"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});