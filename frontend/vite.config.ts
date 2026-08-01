import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // The dev backend serves /storage avatars and logos over plain http on
    // :8000, so it needs listing here exactly as connect-src does below.
    "img-src 'self' data: blob: https: http://localhost:8000 http://127.0.0.1:8000 https://cdn.razorpay.com https://*.razorpay.com https://*.stripe.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Speaking avatar prompts and Listening media are served from the dev
    // backend over plain http on :8000, so it needs listing here exactly as
    // img-src/connect-src do.
    "media-src 'self' blob: http://localhost:8000 http://127.0.0.1:8000",
    "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 ws://localhost:* ws://127.0.0.1:* https: https://*.razorpay.com https://*.razorpay.in https://*.stripe.com https://api.stripe.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://checkout.razorpay.com https://checkout-static.razorpay.com https://cdn.razorpay.com https://api.razorpay.com https://*.razorpay.com https://*.razorpay.in https://js.stripe.com https://*.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "frame-src 'self' https://checkout.razorpay.com https://checkout-static.razorpay.com https://api.razorpay.com https://*.razorpay.com https://*.razorpay.in https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
    "form-action 'self'",
  ].join('; '),

  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)',
}


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // xlsx is an optional, lazy-loaded export dependency; application chunks stay below this.
    chunkSizeWarningLimit: 750,
    sourcemap: false,
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
})
