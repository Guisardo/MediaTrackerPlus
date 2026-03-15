import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lingui } from '@lingui/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import viteCompression from 'vite-plugin-compression';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    lingui(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: 'public/logo/*', dest: 'logo' },
        { src: 'public/image/*', dest: 'image' },
      ],
    }),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      filter: /\.(js|css)$/,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      filter: /\.(js|css)$/,
    }),
  ],
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 7000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7481',
        changeOrigin: true,
        secure: false,
      },
      '/img': {
        target: 'http://127.0.0.1:7481',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../server/public'),
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/, /rest-api/],
    },
  },
  optimizeDeps: {
    include: ['mediatracker-api'],
  },
});
