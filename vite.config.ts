import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// 通常のビルド（Vercel で公開） … dist/
// 1ファイル版（メールに添付して送れる） … `vite build --mode single` で dist-single/index.html
export default defineConfig(({ mode }) =>
  mode === "single"
    ? {
        plugins: [viteSingleFile()],
        define: { __SINGLE_FILE__: "true" },
        build: { outDir: "dist-single", emptyOutDir: true },
      }
    : {
        define: { __SINGLE_FILE__: "false" },
        build: { outDir: "dist", emptyOutDir: true },
      },
);
