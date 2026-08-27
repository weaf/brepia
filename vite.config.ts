import { sentryVitePlugin } from '@sentry/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import fs from 'node:fs';
import http from 'node:http';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const appBase = '/cadam';
const normalizedAppBase = appBase.replace(/\/$/, '');
const disableHmr = process.env.PCAD_DISABLE_HMR === '1';

function supabaseProxyPlugin(): Plugin {
  return {
    name: 'supabase-proxy',
    configureServer(server) {
      const agent = new http.Agent({ keepAlive: true });
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (
          !req.url.startsWith('/auth') &&
          !req.url.startsWith('/rest') &&
          !req.url.startsWith('/storage')
        ) {
          return next();
        }

        const targetPath = req.url;
        const bodyChunks: Buffer[] = [];
        req.on('data', (chunk) => bodyChunks.push(chunk));
        req.on('end', () => {
          const body = Buffer.concat(bodyChunks);
          const options = {
            hostname: 'localhost',
            port: 54321,
            path: targetPath,
            method: req.method,
            headers: {
              ...req.headers,
              host: 'localhost:54321',
              connection: 'keep-alive',
            },
            agent,
            timeout: 30000,
          };
          const proxyReq = http.request(options, (proxyRes) => {
            const statusCode = proxyRes.statusCode ?? 502;
            const chunks: Buffer[] = [];
            proxyRes.on('data', (chunk) => chunks.push(chunk));
            proxyRes.on('end', () => {
              if (res.destroyed || res.writableEnded) return;
              const responseBody = Buffer.concat(chunks);
              res.writeHead(statusCode, proxyRes.headers);
              res.end(responseBody);
            });
          });
          proxyReq.on('timeout', () => {
            proxyReq.destroy();
            if (res.destroyed || res.writableEnded) return;
            res.statusCode = 504;
            res.end('Supabase proxy timeout');
          });
          proxyReq.on('error', (err) => {
            // Backgrounding a browser can abort an in-flight request. That is a
            // normal client-lifecycle event and must not cascade into another
            // write on a response socket that is already gone.
            if (res.destroyed || res.writableEnded) return;
            console.error(
              '[supabase-proxy]',
              req.method,
              targetPath,
              err.message,
            );
            res.statusCode = 502;
            res.end(`Supabase proxy error: ${err.message}`);
          });
          if (body.length > 0) proxyReq.write(body);
          proxyReq.end();
        });
      });
    },
  };
}

function serveOpenScadWasmInDev(): Plugin {
  return {
    name: 'serve-openscad-wasm-in-dev',
    configureServer(server) {
      const wasmPath = path.resolve(
        __dirname,
        'src/vendor/openscad-wasm/openscad.wasm',
      );

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const url = new URL(req.url, 'http://localhost');
        if (
          url.pathname !==
          `${normalizedAppBase}/src/vendor/openscad-wasm/openscad.wasm`
        ) {
          return next();
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/wasm');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(wasmPath)
          .on('error', (error) => next(error))
          .pipe(res);
      });
    },
  };
}

const stableViteClient = String.raw`
const styleSheets = new Map();

export function updateStyle(id, content) {
  let style = styleSheets.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(style);
    styleSheets.set(id, style);
  }
  style.textContent = content;
}

export function removeStyle(id) {
  const style = styleSheets.get(id);
  if (!style) return;
  style.remove();
  styleSheets.delete(id);
}

export function createHotContext() {
  const data = {};
  return {
    get data() {
      return data;
    },
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const parsed = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject +
    (parsed.search ? '&' + parsed.search.slice(1) : '') + parsed.hash;
}

export class ErrorOverlay extends HTMLElement {}
`;

// Vite injects @vite/client even when server.hmr=false. The real client opens a
// dev WebSocket, renders the full-screen error overlay, and deliberately calls
// location.reload() after a lost server connection becomes reachable again.
// Mobile/desktop app switching can briefly suspend networking, which makes that
// behavior hostile to long-running CAD/AI sessions. Stable mode intercepts the
// client module itself and serves only the small compatibility surface required
// by Vite's dev CSS/module transforms, with no WebSocket, overlay, or reload.
function stableViteClientPlugin(): Plugin {
  return {
    name: 'stable-vite-client',
    apply: 'serve',
    configureServer(server) {
      if (!disableHmr) return;

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (!pathname.endsWith('/@vite/client')) return next();

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(stableViteClient);
      });
    },
  };
}

export default defineConfig({
  base: appBase,
  plugins: [
    stableViteClientPlugin(),
    serveOpenScadWasmInDev(),
    supabaseProxyPlugin(),
    tanstackStart({
      router: {
        basepath: normalizedAppBase,
        semicolons: true,
      },
      spa: {
        enabled: true,
        maskPath: normalizedAppBase,
      },
    }),
    nitro({
      baseURL: normalizedAppBase,
      inlineDynamicImports: true,
    }),
    react(),
    sentryVitePlugin({
      org: 'adamcad',
      project: 'adamcad',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,

    outDir: 'dist/cadam',
    emptyOutDir: true,

    sourcemap: true,
  },
  environments: {
    client: {
      build: {
        outDir: 'dist/cadam',
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (
                id.includes('/node_modules/react/') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('/node_modules/@tanstack/react-router/') ||
                id.includes('/node_modules/@tanstack/react-start/') ||
                id.includes('/node_modules/lucide-react/')
              ) {
                return 'vendor';
              }
            },
          },
        },
      },
    },
    server: {
      build: {
        outDir: 'dist/server',
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
  server: {
    port: 3000,
    open: false,
    host: true,
    hmr: disableHmr ? false : undefined,
    allowedHosts: ['alpine.0r4cl3.se', 'db.noty.se'],
  },
  optimizeDeps: {
    exclude: ['@zip.js/zip.js', 'three', 'three-stdlib', '@sentry/vite-plugin'],
  },
});
