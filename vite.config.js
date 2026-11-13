import { defineConfig } from 'vite';

/**
 * Rewrites subpath-stripped proxy requests (`/` and `/assets/...`) to `/forest-shop/...`
 * so both `.../forest-shop` (no trailing slash) and `.../forest-shop/` load assets cleanly
 * behind Tailscale Serve (`--set-path=/forest-shop/ -> http://127.0.0.1:4174/`), and disables
 * caching on the HTML shell so new builds take effect immediately.
 */
function subpathProxyCompatPlugin() {
  const handle = (req, res, next) => {
    if (req.url === '/' || req.url.startsWith('/?')) {
      req.url = req.url === '/' ? '/forest-shop/' : `/forest-shop/${req.url.slice(1)}`;
    } else if (req.url === '/forest-shop' || req.url.startsWith('/forest-shop?')) {
      req.url = req.url === '/forest-shop' ? '/forest-shop/' : `/forest-shop/${req.url.slice('/forest-shop'.length)}`;
    } else if (req.url.startsWith('/assets/')) {
      req.url = `/forest-shop${req.url}`;
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
    name: 'tailscale-subpath-compat',
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
    configureServer(server) {
      server.middlewares.use(handle);
    },
  };
}

export default defineConfig({
  base: '/forest-shop/',
  plugins: [subpathProxyCompatPlugin()],
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
    chunkSizeWarningLimit: 1800,
  },
});
