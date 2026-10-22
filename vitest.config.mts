import { defineConfig } from "vitest/config";

export default defineConfig({
  // jsdom tests load every module through Vite's file check, and the base-replay gate's test runner lives outside the project.
  server: { fs: { strict: false } },
  test: {
    dir: "src",
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    globals: true,
    setupFiles: ["./test/setupFiles.ts"],
    taskTitleValueFormatTruncate: Infinity,
    // The base-replay gate rejects a run that writes into the checkout.
    cache: false,
  },
});
