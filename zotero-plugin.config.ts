import { defineConfig } from "zotero-plugin-scaffold";
// @ts-ignore
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      buildVersion: pkg.version,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"production"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `build/addon/chrome/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },
});
