import { defineConfig } from "vitest/config";

export default defineConfig({
  server: { fs: { strict: false } },
  test: {
    dir: "src",
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    globals: true,
    setupFiles: ["./test/setupFiles.ts"],
    taskTitleValueFormatTruncate: Infinity,
    cache: false,
  },
});
