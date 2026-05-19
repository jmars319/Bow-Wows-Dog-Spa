import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function adminHistoryFallback() {
  return {
    name: 'admin-history-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url || '').split('?')[0] || '/';
        const isAdminRoute = path === '/admin' || path.startsWith('/admin/');
        const looksLikeAsset = /\.[a-zA-Z0-9]+$/.test(path);
        const isViteInternal = path.startsWith('/admin/@') || path.startsWith('/admin/src/');
        if (isAdminRoute && !looksLikeAsset && !isViteInternal) {
          req.url = '/admin/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3316';

  return {
    plugins: [adminHistoryFallback(), react()],
    base: '/admin/',
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
    },
    server: {
      port: 3406,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
