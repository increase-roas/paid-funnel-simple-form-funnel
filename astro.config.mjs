import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  session: false,
  adapter: cloudflare({
    imageService: "passthrough",
    persistState: process.env.CF_PERSIST ?? true,
    inspectorPort: process.env.INSPECTOR_PORT
      ? Number(process.env.INSPECTOR_PORT)
      : false,
  }),
  server: {
    host: true,
    port: 3000,
  },
  vite: {
    define: {
      "import.meta.env.FUNNEL_SHAPE": JSON.stringify(process.env.FUNNEL_SHAPE ?? "A"),
    },
    server: {
      allowedHosts: [".manus.computer"],
    },
    optimizeDeps: {
      exclude: ["astro/assets/services/noop"],
    },
    build: {
      minify: false,
    },
  },
});
