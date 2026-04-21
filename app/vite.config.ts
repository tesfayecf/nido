import path from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    root: ".",
    publicDir: 'public',
    cacheDir: './.cache',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: '.dist',
        emptyOutDir: true,
        sourcemap: true,
        target: 'es2020',
    },
    server: {
        port: 3000,
        host: true,
        open: true,
        proxy: {
            '/api': {
                target: process.env.VITE_BACKEND_ORIGIN ?? 'http://127.0.0.1:8080',
                changeOrigin: true,
            },
        },
    },
});
