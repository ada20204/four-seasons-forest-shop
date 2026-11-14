import { defineConfig } from 'vite';

/**
 * Normalize Vite base path so callers can supply `forest-shop`, `/forest-shop`,
 * `/forest-shop/`, or `/` consistently.
 */
export function normalizeBasePath(raw = '/forest-shop/') {
  let base = String(raw).trim() || '/';
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

/**
 * Rewrites subpath-stripped proxy requests (`/` and `/assets/...`) to `basePath`
 * so both `.../forest-shop` and `.../forest-shop/` load assets cleanly behind
 * reverse proxies such as Tailscale Serve (`--set-path=/forest-shop/`), and
 * disables caching on HTML shell responses so new builds apply immediately.
 */
function subpathProxyCompatPlugin(basePath) {
  const trimmedBase = basePath === '/' ? '/' : basePath.slice(0, -1);

  const handle = (req, res, next) => {
    if (basePath !== '/') {
      if (req.url === '/' || req.url.startsWith('/?')) {
        req.url = req.url === '/' ? basePath : `${basePath}${req.url.slice(1)}`;
      } else if (req.url === trimmedBase || req.url.startsWith(`${trimmedBase}?`)) {
        req.url =
          req.url === trimmedBase ? basePath : `${basePath}${req.url.slice(trimmedBase.length)}`;
      } else if (req.url.startsWith('/assets/')) {
        req.url = `${trimmedBase}${req.url}`;
      }
    }

    const isHtmlShell = req.url.endsWith('/') || req.url.includes('/index.html');
    if (isHtmlShell) {
      const origWriteHead = res.writeHead.bind(res);
      res.writeHead = (...args) => {
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        return origWriteHead(...args);
      };
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }

    next();
  };

  return {
    name: 'subpath-proxy-compat',
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
    configureServer(server) {
      server.middlewares.use(handle);
    },
  };
}

const basePath = normalizeBasePath(process.env.VITE_BASE_PATH ?? '/forest-shop/');

export default defineConfig({
  base: basePath,
  plugins: [subpathProxyCompatPlugin(basePath)],
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    // @dgreenheck/ez-tree inlines its procedural bark/leaf textures (~4.0 MB) inside its isolated vendor chunk
    chunkSizeWarningLimit: 4200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/examples/')) return 'vendor-three-addons';
          if (id.includes('/three/')) return 'vendor-three';
          if (id.includes('/postprocessing/') || id.includes('/n8ao/')) return 'vendor-postfx';
          if (id.includes('/@dgreenheck/ez-tree/')) return 'vendor-eztree';
          return 'vendor-misc';
        },
      },
    },
  },
});
