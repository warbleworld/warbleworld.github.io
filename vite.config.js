// Vite build configuration.
// Vite has two jobs: a dev server with instant reload while you work,
// and a production build that bundles + minifies everything for deploy.
import { defineConfig } from "vite";

export default defineConfig({
  // The folder containing index.html. Everything the browser loads lives here.
  root: "site",

  // Files in site/public/ are copied to the output untouched, keeping their
  // paths (site/public/images/x.webp is served at /images/x.webp).
  // This is for assets referenced at RUNTIME (cards.json, images built into
  // HTML strings) that the bundler can't see by following imports.
  publicDir: "public",

  build: {
    // Output folder, relative to `root` — so this means <repo>/dist.
    outDir: "../dist",
    // Wipe dist/ before each build so stale files never linger.
    emptyOutDir: true,
    // The compatibility contract: Vite only emits JavaScript/CSS syntax
    // that Safari 15 (our iOS 15 minimum spec) understands.
    target: "safari15",
  },
});
