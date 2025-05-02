import { defineConfig } from 'vite';

export default defineConfig({
  // Use absolute paths for production assets (e.g. /assets/...) instead of relative paths
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  },
  resolve: {
    extensions: ['.ts', '.js']
  }
});