import { defineConfig } from "vite";
import { resolve } from "path";
import monacoEditorPlugin from "vite-plugin-monaco-editor";

export default defineConfig({
  root: ".",
  base: "/",
  plugins: [
    monacoEditorPlugin({}),
  ],
  build: {
    outDir: "dist/web",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        config: resolve(__dirname, "config.html"),
      },
    },
  },
});
