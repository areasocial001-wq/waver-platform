import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { spawnSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

/**
 * Esegue scripts/check-no-commercial.mjs in fase di build.
 * Se trova residui di pricing/abbonamenti/Stripe → la build fallisce.
 * In dev mode è solo un avviso (non blocca l'HMR).
 */
function noCommercialGuardPlugin() {
  return {
    name: "no-commercial-guard",
    apply: "build" as const,
    buildStart() {
      const res = spawnSync(
        "node",
        [path.resolve(__dirname, "scripts/check-no-commercial.mjs")],
        { stdio: "inherit" }
      );
      if (res.status !== 0) {
        this.error(
          "Build interrotta: rilevati residui commerciali nel frontend (vedi log sopra)."
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    noCommercialGuardPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
