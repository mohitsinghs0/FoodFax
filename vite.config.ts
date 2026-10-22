import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
function upiqrpayApiPlugin(): Plugin {
  return {
    name: 'upiqrpay-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/payment')) {
          try {
            const { handlePaymentRequest } = await import('./server/paymentHandler.ts');
            const handled = await handlePaymentRequest(req, res);
            if (handled) return;
          } catch (err) {
            console.error('[PaymentPlugin] Error handling request:', err);
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/payment')) {
          try {
            const { handlePaymentRequest } = await import('./server/paymentHandler.ts');
            const handled = await handlePaymentRequest(req, res);
            if (handled) return;
          } catch (err) {
            console.error('[PaymentPlugin] Error handling preview request:', err);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), upiqrpayApiPlugin()],
    resolve: {
      alias: {
        // Use import.meta.dirname instead of __dirname (Vite native config compatible)
        '@': import.meta.dirname,
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0', // Accessible on local network (Mac Mini LAN)
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
