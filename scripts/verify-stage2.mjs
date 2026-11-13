import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR =
  process.env.VERIFY_OUT_DIR ||
  path.resolve(import.meta.dirname, '../.verify-stage2');
const PREVIEW_PORT = process.env.VERIFY_PORT || '4175';
const PREVIEW_URL = process.env.PREVIEW_URL || `http://127.0.0.1:${PREVIEW_PORT}/forest-shop/`;
const WD_PORT = 4447;
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

async function exec(sessionId, script, args = []) {
  return wd('POST', `/session/${sessionId}/execute/sync`, { script, args });
}

async function snap(sessionId, filename) {
  const b64 = await wd('GET', `/session/${sessionId}/screenshot`);
  const outPath = path.join(OUT_DIR, filename);
  await fs.writeFile(outPath, Buffer.from(b64, 'base64'));
  console.log('Saved:', outPath);
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const previewProc = spawn(
    process.execPath,
    [
      path.resolve(import.meta.dirname, '../node_modules/vite/bin/vite.js'),
      'preview',
      '--port',
      String(PREVIEW_PORT),
      '--host',
      '127.0.0.1',
      '--strictPort',
    ],
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

    await exec(
      sessionId,
      `
      window.__VERIFY_ERRORS__ = [];
      window.addEventListener('error', (e) => window.__VERIFY_ERRORS__.push(e.message || String(e)));
      window.addEventListener('unhandledrejection', (e) => window.__VERIFY_ERRORS__.push(String(e.reason)));
    `
    );

    // Wait briefly so WebGL & first frame settle, then verify mid-assembly + finish/skip
    await new Promise((r) => setTimeout(r, 900));
    await exec(sessionId, `window.__STAGE2__.replayAssembly();`);
    await new Promise((r) => setTimeout(r, 1150));
    const midAssemblyState = await exec(sessionId, `return window.__STAGE2__.getAssemblyState();`);
    await snap(sessionId, 'assembly-mid.png');

    await exec(sessionId, `window.__STAGE2__.finishAssembly();`);
    await new Promise((r) => setTimeout(r, 350));
    const finishedState = await exec(sessionId, `return window.__STAGE2__.getAssemblyState();`);
    if (!finishedState.completed || finishedState.active) {
      throw new Error(`Assembly finish check failed: ${JSON.stringify(finishedState)}`);
    }

    // 1. Capture all 4 seasons from default overview & inspect particle counts + wardrobe changes
    const particleCounts = {};
    const wardrobes = {};
    for (const season of ['summer', 'spring', 'autumn', 'winter']) {
      await exec(
        sessionId,
        `window.__STAGE2__.setView('overview', true); window.__STAGE2__.setSeason(arguments[0], true);`,
        [season]
      );
      await new Promise((r) => setTimeout(r, 550));
      particleCounts[season] = await exec(sessionId, `return window.__STAGE2__.getParticleCount();`);
      wardrobes[season] = await exec(sessionId, `return window.__STAGE2__.getWardrobeState();`);
      if (particleCounts[season] <= 0) {
        throw new Error(`Expected active particles for ${season}, got ${particleCounts[season]}`);
      }
      await snap(sessionId, `${season}-overview.png`);
    }

    if (
      wardrobes.spring.dressHex === wardrobes.summer.dressHex ||
      wardrobes.autumn.capeVisible !== true ||
      wardrobes.winter.capeVisible !== true ||
      wardrobes.summer.capeVisible !== false ||
      wardrobes.spring.capeVisible !== false
    ) {
      throw new Error(`Seasonal wardrobe validation failed: ${JSON.stringify(wardrobes)}`);
    }

    // 1b. Capture Spring & Autumn storefront interior close-ups to verify seasonal couture showcase
    for (const season of ['spring', 'autumn']) {
      await exec(
        sessionId,
        `window.__STAGE2__.setSeason(arguments[0], true); window.__STAGE2__.setView('interior', true);`,
        [season]
      );
      await new Promise((r) => setTimeout(r, 450));
      await snap(sessionId, `${season}-interior.png`);
    }
    await exec(sessionId, `window.__STAGE2__.setSeason('winter', true);`);

    // Verify toggling particles OFF -> 0, then ON -> restored
    await exec(sessionId, `window.__STAGE2__.setParticlesEnabled(false);`);
    await new Promise((r) => setTimeout(r, 150));
    const offCount = await exec(sessionId, `return window.__STAGE2__.getParticleCount();`);
    await exec(sessionId, `window.__STAGE2__.setParticlesEnabled(true);`);
    await new Promise((r) => setTimeout(r, 200));
    const restoredCount = await exec(sessionId, `return window.__STAGE2__.getParticleCount();`);
    if (offCount !== 0 || restoredCount <= 0) {
      throw new Error(`Particle toggle check failed: off=${offCount}, restored=${restoredCount}`);
    }

    // 2. Capture Winter close-ups & rear/left/side angles to verify snow pillows & warm interior
    for (const view of ['leftFront', 'highSide', 'rear', 'interior']) {
      await exec(sessionId, `window.__STAGE2__.setView(arguments[0], true);`, [view]);
      await new Promise((r) => setTimeout(r, 450));
      await snap(sessionId, `winter-${view}.png`);
    }

    // 2b. Day -> Dusk -> Moonlit Night celestial & atmospheric verification
    await exec(
      sessionId,
      `
      window.__STAGE2__.setView('overview', true);
      window.__STAGE2__.setSeason('summer', true);
      window.__STAGE2__.setTimeOfDay('golden', true);
    `
    );
    await new Promise((r) => setTimeout(r, 550));
    await snap(sessionId, 'summer-golden.png');

    await exec(sessionId, `window.__STAGE2__.setTimeOfDay('night', true);`);
    await new Promise((r) => setTimeout(r, 650));
    const summerNightCheck = await exec(
      sessionId,
      `
      return {
        time: window.__STAGE2__.getTimeOfDay(),
        theme: window.__STAGE2__.getTheme(),
        fireflies: window.__STAGE2__.getFireflyCount(),
      };
    `
    );
    if (summerNightCheck.fireflies <= 0 || summerNightCheck.theme !== 'theme-night') {
      throw new Error(`Summer night check failed: ${JSON.stringify(summerNightCheck)}`);
    }
    await snap(sessionId, 'summer-night.png');

    await exec(sessionId, `window.__STAGE2__.setSeason('winter', true);`);
    await new Promise((r) => setTimeout(r, 550));
    await snap(sessionId, 'winter-night.png');

    await exec(sessionId, `window.__STAGE2__.setView('interior', true);`);
    await new Promise((r) => setTimeout(r, 450));
    await snap(sessionId, 'winter-night-interior.png');

    await exec(
      sessionId,
      `window.__STAGE2__.setTimeOfDay('day', true); window.__STAGE2__.setView('overview', true);`
    );

    // 3. Desktop orbit drag & wheel zoom checks
    await exec(sessionId, `window.__STAGE2__.setView('overview', true);`);
    await new Promise((r) => setTimeout(r, 300));
    const camBeforeDrag = await exec(sessionId, `return window.__STAGE2__.getCamera();`);
    await wd('POST', `/session/${sessionId}/actions`, {
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            { type: 'pointerMove', duration: 0, x: 720, y: 460 },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 220, x: 890, y: 420 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    });
    await new Promise((r) => setTimeout(r, 350));
    const camAfterDrag = await exec(sessionId, `return window.__STAGE2__.getCamera();`);
    const dragDelta = Math.hypot(
      camAfterDrag.pos[0] - camBeforeDrag.pos[0],
      camAfterDrag.pos[1] - camBeforeDrag.pos[1],
      camAfterDrag.pos[2] - camBeforeDrag.pos[2]
    );
    if (dragDelta < 0.1) {
      throw new Error(`Orbit drag check failed: camera delta ${dragDelta}`);
    }

    await wd('POST', `/session/${sessionId}/actions`, {
      actions: [
        {
          type: 'wheel',
          id: 'wheel',
          actions: [{ type: 'scroll', x: 720, y: 460, deltaX: 0, deltaY: -360, duration: 150 }],
        },
      ],
    });
    await new Promise((r) => setTimeout(r, 350));
    const camAfterZoom = await exec(sessionId, `return window.__STAGE2__.getCamera();`);
    const zoomDelta = Math.hypot(
      camAfterZoom.pos[0] - camAfterDrag.pos[0],
      camAfterZoom.pos[1] - camAfterDrag.pos[1],
      camAfterZoom.pos[2] - camAfterDrag.pos[2]
    );
    if (zoomDelta < 0.1) {
      throw new Error(`Wheel zoom check failed: zoom delta ${zoomDelta}`);
    }

    // 4. Mobile responsive verification (390x844) + real DOM UI button click
    await wd('POST', `/session/${sessionId}/window/rect`, { width: 390, height: 844 });
    await exec(
      sessionId,
      `window.__STAGE2__.setView('overview', true); window.__STAGE2__.setSeason('summer', true);`
    );
    await new Promise((r) => setTimeout(r, 550));
    await snap(sessionId, 'mobile-summer.png');

    await exec(sessionId, `document.querySelector('[data-season="winter"]').click();`);
    await new Promise((r) => setTimeout(r, 900));
    await snap(sessionId, 'mobile-winter.png');

    await exec(sessionId, `document.getElementById('toggle-cycle').click();`);
    await new Promise((r) => setTimeout(r, 420));
    const cycleMidProgress = await exec(
      sessionId,
      `return { on: window.__STAGE2__.getAutoCycle(), p: window.__STAGE2__.getTimeProgress() };`
    );
    if (!cycleMidProgress.on || cycleMidProgress.p <= 0) {
      throw new Error(`Auto-cycle DOM toggle failed: ${JSON.stringify(cycleMidProgress)}`);
    }

    await exec(sessionId, `document.querySelector('[data-time="night"]').click();`);
    await new Promise((r) => setTimeout(r, 1550));
    await snap(sessionId, 'mobile-winter-night.png');

    const mobileMetrics = await exec(
      sessionId,
      `
      const hud = document.querySelector('.hud-panel');
      const rect = hud.getBoundingClientRect();
      return {
        season: window.__STAGE2__.getSeason(),
        time: window.__STAGE2__.getTimeOfDay(),
        autoCycle: window.__STAGE2__.getAutoCycle(),
        theme: window.__STAGE2__.getTheme(),
        hudHeight: Math.round(rect.height),
        hudRatio: Number((rect.height / window.innerHeight).toFixed(3)),
        hudOverflowX: rect.width > window.innerWidth,
        errors: window.__VERIFY_ERRORS__ || [],
        stats: window.__STAGE2__.getStats(),
      };
    `
    );

    const report = {
      midAssemblyActive: midAssemblyState.active,
      particleCounts,
      wardrobes,
      offCount,
      restoredCount,
      summerNightCheck,
      cycleMidProgress,
      dragDelta: Number(dragDelta.toFixed(3)),
      zoomDelta: Number(zoomDelta.toFixed(3)),
      mobileMetrics,
    };
    console.log('STAGE2_REPORT:', JSON.stringify(report, null, 2));

    if (mobileMetrics.errors.length > 0) {
      throw new Error(`Runtime errors detected: ${JSON.stringify(mobileMetrics.errors)}`);
    }
    if (mobileMetrics.season !== 'winter') {
      throw new Error(`Mobile DOM click season failed: got ${mobileMetrics.season}`);
    }
    if (mobileMetrics.time !== 'night' || mobileMetrics.autoCycle !== false) {
      throw new Error(`Mobile DOM click night failed: ${JSON.stringify(mobileMetrics)}`);
    }
    if (mobileMetrics.hudOverflowX) {
      throw new Error('Mobile HUD overflows horizontally');
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
