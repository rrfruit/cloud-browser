import { defineConfig, presetIcons, presetWind4 } from "unocss";

export default defineConfig({
  presets: [presetWind4(), presetIcons({})],
  content: {
    pipeline: {
      include: [
        // the default
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
        // 这里只写我需要的，当然你也可以定制，参考：https://unocss.dev/guide/extracting#extracting-from-build-tools-pipeline
        "src/router/index.ts",
      ],
      // exclude files
      // exclude: []
    },
  },
});
