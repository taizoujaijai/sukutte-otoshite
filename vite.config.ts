import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Artifact として公開しやすいよう、JS・CSS・3Dモデルをすべて1つの HTML にまとめる
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5190 },
  preview: { port: 5191 },
});
