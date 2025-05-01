import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env variables based on mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: './',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: 'index.html'
      }
    },
    define: {
      // Make environment variables available to the client
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || '')
    }
  };
});