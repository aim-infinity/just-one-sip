import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        target: 'es2019',
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1600,
        rollupOptions: {
            output: { manualChunks: { phaser: ['phaser'] } },
        },
        minify: 'terser',
        terserOptions: {
            compress: { passes: 2 },
            mangle: true,
            format: { comments: false },
        },
    },
});
