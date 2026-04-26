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
        // Increase the chunk size warning limit and add manual chunking
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                // Split vendor code into smaller chunks to avoid large single-file bundles
                manualChunks(id: string) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler'))
                            return 'vendor.react';
                        if (id.includes('lodash')) return 'vendor.lodash';
                        return 'vendor';
                    }
                },
            },
        },
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
