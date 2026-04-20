import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    root: ".",
    base: './.dist/',
    publicDir: 'public',
    cacheDir: './.cache',
    plugins: [react()],
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
    },
});
