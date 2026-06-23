import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["app/**/*.test.tsx", "happy-dom"],
      ["lib/**/*.test.tsx", "happy-dom"],
    ],
    setupFiles: ["./lib/test-utils/vitest-setup.ts"],
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "app/**/*.test.ts", "app/**/*.test.tsx"],
    pool: "threads",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "lib/test-utils/server-only-mock.ts"),
    },
  },
});
