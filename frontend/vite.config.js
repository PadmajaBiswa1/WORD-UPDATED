import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = (
    env.VITE_API_PROXY_TARGET
    || env.VITE_API_URL
    || process.env.VITE_API_PROXY_TARGET
    || process.env.VITE_API_URL
    || 'http://localhost:3001'
  )
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');


  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: apiTarget.replace(/^http/, 'ws'),
          ws: true,
        },
      },
    },
  };
});
