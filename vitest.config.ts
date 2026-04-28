import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    css: false,
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: { "@": path.resolve(__dirname, "./src") },
        },
        test: {
          name: "unit",
          globals: true,
          environment: "jsdom",
          setupFiles: [path.resolve(__dirname, "src/__tests__/setup.ts")],
          include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
          exclude: ["src/**/__tests__/**/*.integration.test.{ts,tsx}"],
          css: false,
        },
      },
      {
        resolve: {
          alias: { "@": path.resolve(__dirname, "./src") },
        },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/__tests__/**/*.integration.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
