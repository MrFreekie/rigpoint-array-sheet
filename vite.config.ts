import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Strict Content Security Policy for the built app.
 * Added at build time only: the dev server needs an inline script for hot reload.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  // GitHub Pages serves the app from /<repo name>/.
  base: '/rigpoint-array-sheet/',
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      // A custom service worker (src/sw.ts): it also receives Android shares.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Never update mid-edit: the app shows "Update available, reload" instead.
      registerType: 'prompt',
      // Registered from the app (virtual:pwa-register/react), so no inline script is needed.
      injectRegister: false,
      injectManifest: {
        // .mjs is the PDF reader's worker: without it a PDF could not be opened offline.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'RigPoint Array Sheet',
        short_name: 'Array Sheet',
        description: 'Reads a Soundvision report PDF and shows the array and rigging information from it.',
        lang: 'en-GB',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b2545',
        theme_color: '#0b2545',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Double-click a saved file to open it in the installed app (Chrome and Edge desktop).
        // Not PDFs: the app should not take over every PDF on the computer.
        file_handlers: [{ action: './', accept: { 'application/json': ['.json'] } }],
        launch_handler: { client_mode: 'focus-existing' },
        // Share a saved file or a Soundvision PDF into the app from another Android app.
        share_target: {
          action: './share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'file', accept: ['application/json', '.json', 'application/pdf', '.pdf'] }] },
        },
      },
      devOptions: { enabled: false },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2023', sourcemap: true },
  // The service worker registration only exists in a build. Unit tests get an inert stand-in.
  resolve: process.env['VITEST']
    ? { alias: { 'virtual:pwa-register/react': fileURLToPath(new URL('./src/testing/pwa-register-stub.ts', import.meta.url)) } }
    : {},
  // The label placement behind the rigging plot searches many orders, so its tests take seconds when the whole suite runs in parallel.
  test: { include: ['src/**/*.test.{ts,tsx}'], testTimeout: 30_000 },
});
