import { defineConfig } from "vitest/config";

// Project site: https://soul080.github.io/ftc-sim/
// Dev and tests stay at `/`. The production build prefixes assets with `/ftc-sim/`.
const pagesBase = "/ftc-sim/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? pagesBase : "/",
  server: { host: "0.0.0.0", port: 4317, strictPort: true },
  preview: { host: "0.0.0.0", port: 4317, strictPort: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
