import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Vitest resolves the workspace packages straight to their TypeScript sources.
// There is no build step in the loop: a test failure points at the line you
// wrote, not at a line in dist/.
const pkg = (name: string) =>
  resolve(import.meta.dirname, `packages/${name}/src/index.ts`);

export default defineConfig({
  resolve: {
    alias: {
      "@ocean/mathx": pkg("mathx"),
      "@ocean/core-types": pkg("core-types"),
      "@ocean/topology": pkg("topology"),
      "@ocean/solver": pkg("solver"),
      "@ocean/genome": pkg("genome"),
      "@ocean/morphogen": pkg("morphogen"),
      "@ocean/sim": pkg("sim"),
      "@ocean/evolve": pkg("evolve"),
      "@ocean/devtools": pkg("devtools"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
