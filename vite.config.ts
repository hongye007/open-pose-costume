import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

function imageProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    followRedirects: false,
    timeout: 240_000,
    proxyTimeout: 240_000,
    rewrite: () => '/v1/images/edits',
    bypass(req) {
      // This is a local image-edit transport, never an arbitrary URL proxy.
      if (
        req.method !== 'POST' ||
        (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
      )
        return false;
    },
    configure(proxy) {
      proxy.on('proxyReq', (request) => request.removeHeader('cookie'));
      proxy.on('proxyRes', (response) => {
        delete response.headers['set-cookie'];
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '^/__opc-image/site/v1/images/edits$': imageProxy('https://atomflow.vip'),
      '^/__opc-image/api/v1/images/edits$': imageProxy('https://api.atomflow.vip'),
    },
  },
});
