import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR =
  process.env.VERIFY_OUT_DIR ||
  path.resolve(import.meta.dirname, '../.verify-stage1');
const PREVIEW_PORT = process.env.VERIFY_PORT || '4175';
const PREVIEW_URL = process.env.PREVIEW_URL || `http://127.0.0.1:${PREVIEW_PORT}/forest-shop/`;
const WD_PORT = 4446;
const WD_BASE = `http://127.0.0.1:${WD_PORT}`;

async function wd(method, endpoint, body) {
  const res = await fetch(`${WD_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`WebDriver ${method} ${endpoint} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.value;
}

async function waitForUrl(url, label) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const previewProc = spawn(
    process.execPath,
    [path.resolve(import.meta.dirname, '../node_modules/vite/bin/vite.js'), 'preview', '--port', String(PREVIEW_PORT), '--host', '127.0.0.1', '--strictPort'],
    {
      cwd: path.resolve(import.meta.dirname, '..'),
      stdio: 'ignore',
    }
  );

  const driverProc = spawn('/snap/bin/geckodriver', ['--port', String(WD_PORT)], {
    stdio: 'ignore',
  });

  let sessionId = null;
  try {
    await waitForUrl(PREVIEW_URL, 'vite preview');
    await waitForUrl(`${WD_BASE}/status`, 'geckodriver');

    const session = await wd('POST', '/session', {
      capabilities: {
        alwaysMatch: {
          browserName: 'firefox',
          'moz:firefoxOptions': {
            binary: '/snap/firefox/current/usr/lib/firefox/firefox',
            args: ['-headless', '--width=1440', '--height=960'],
            prefs: {
              'webgl.force-enabled': true,
              'layers.acceleration.force-enabled': true,
              'gfx.webrender.all': true,
            },
          },
        },
      },
    });
    sessionId = session.sessionId;
    await wd('POST', `/session/${sessionId}/window/rect`, { width: 1440, height: 960 });
    await wd('POST', `/session/${sessionId}/url`, { url: PREVIEW_URL });

    await wd('POST', `/session/${sessionId}/execute/sync`, {
      script: `
        window.__VERIFY_ERRORS__ = [];
        window.addEventListener('error', (e) => window.__VERIFY_ERRORS__.push(e.message || String(e)));
        window.addEventListener('unhandledrejection', (e) => window.__VERIFY_ERRORS__.push(String(e.reason)));
      `,
      args: [],
    });

    await new Promise((r) => setTimeout(r, 1800));

    const views = ['overview', 'leftFront', 'rightFront', 'highSide', 'rear', 'interior'];
    for (const v of views) {
      await wd('POST', `/session/${sessionId}/execute/sync`, {
        script: `window.__STAGE1__.setView(arguments[0], true);`,
        args: [v],
      });
      await new Promise((r) => setTimeout(r, 450));
      const b64 = await wd('GET', `/session/${sessionId}/screenshot`);
      const outPath = path.join(OUT_DIR, `stage1-${v}.png`);
      await fs.writeFile(outPath, Buffer.from(b64, 'base64'));
      console.log('Saved:', outPath);
    }

    // Verify orbit interaction via WebDriver pointer drag
    const camBefore = await wd('POST', `/session/${sessionId}/execute/sync`, {
      script: 'return window.__STAGE1__.getCamera();',
      args: [],
    });
    await wd('POST', `/session/${sessionId}/actions`, {
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            { type: 'pointerMove', duration: 0, x: 720, y: 480 },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 220, x: 880, y: 440 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    });
    await new Promise((r) => setTimeout(r, 350));
    const camAfterDrag = await wd('POST', `/session/${sessionId}/execute/sync`, {
      script: 'return window.__STAGE1__.getCamera();',
      args: [],
    });
    const dragDelta = Math.hypot(
      camAfterDrag.pos[0] - camBefore.pos[0],
      camAfterDrag.pos[1] - camBefore.pos[1],
      camAfterDrag.pos[2] - camBefore.pos[2]
    );
    if (dragDelta < 0.1) {
      throw new Error(`Orbit drag check failed: camera delta ${dragDelta}`);
    }

    const report = await wd('POST', `/session/${sessionId}/execute/sync`, {
      script: `
        return {
          errors: window.__VERIFY_ERRORS__ || [],
          stats: window.__STAGE1__.getStats(),
          dragDelta: arguments[0],
        };
      `,
      args: [Number(dragDelta.toFixed(3))],
    });
    console.log('REPORT:', JSON.stringify(report, null, 2));

    if (report.errors.length > 0) {
      throw new Error(`Runtime errors detected: ${JSON.stringify(report.errors)}`);
    }
  } finally {
    if (sessionId) {
      try {
        await wd('DELETE', `/session/${sessionId}`);
      } catch {
        // ignore
      }
    }
    driverProc.kill('SIGKILL');
    previewProc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
