import { defineConfig } from "vitest/config";

// Scope this suite to the shipped procedure browser. App.test.tsx is the retained
// unmounted full-simulator prototype and is not an oracle for the alerts dashboard.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/pages/ProceduresPage.test.tsx"],
    passWithNoTests: false,
  },
});
