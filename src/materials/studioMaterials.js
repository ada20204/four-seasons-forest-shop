import * as THREE from 'three';

/**
 * Shared shader uniforms updated dynamically by Lighting/Season/Backdrop controllers.
 */
export const sharedUniforms = {
  uTime: { value: 0 },
  uBackdropTop: { value: new THREE.Color('#fdf5ea') },
  uBackdropMid: { value: new THREE.Color('#faeedf') },
  uBackdropBottom: { value: new THREE.Color('#f1dfc8') },
  uHaloColor: { value: new THREE.Color('#fffaf2') },
  uHaloStrength: { value: 0.42 },
  uHaloCenter: { value: new THREE.Vector2(0.50, 0.50) },
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function makeRng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finalizeTexture(canvas, { srgb = true, repeat = [1, 1], anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Warm architectural cream stucco micro-plaster albedo & bump/roughness textures.
 */
export function createStuccoTextures() {
  const size = 256;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const actx = albedoC.getContext('2d');
  const bctx = bumpC.getContext('2d');
  const rng = makeRng(4411);

  actx.fillStyle = '#efe9df';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.6 + rng() * 2.1;
    const tone = 228 + Math.floor(rng() * 22);
    actx.fillStyle = `rgba(${tone}, ${tone - 5}, ${tone - 12}, 0.25)`;
    actx.fillRect(x, y, r, r);

    const b = 108 + Math.floor(rng() * 44);
    bctx.fillStyle = `rgba(${b}, ${b}, ${b}, 0.35)`;
    bctx.fillRect(x, y, r, r);
  }

  return {
    map: finalizeTexture(albedoC, { srgb: true, repeat: [3, 3] }),
    bumpMap: finalizeTexture(bumpC, { srgb: false, repeat: [3, 3] }),
  };
}

/**
 * Stacked dark charcoal slate split-stone masonry (for 1F right pier, side & rear walls).
 */
export function createStackedStoneTextures() {
  const w = 512;
  const h = 512;
  const albedoC = makeCanvas(w, h);
  const bumpC = makeCanvas(w, h);
  const actx = albedoC.getContext('2d');
  const bctx = bumpC.getContext('2d');
  const rng = makeRng(9917);

  // Dark mortar bed
  actx.fillStyle = '#1f2227';
  actx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#202020';
  bctx.fillRect(0, 0, w, h);

  const rows = 14;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    let x = (r % 2) * -48;
    while (x < w) {
      const bw = 72 + Math.floor(rng() * 68);
      const pad = 2.2;
      const v = 46 + Math.floor(rng() * 22);
      const warm = Math.floor(rng() * 6);
      actx.fillStyle = `rgb(${v + warm}, ${v + 2}, ${v + 6})`;
      actx.fillRect(x + pad, y + pad, bw - pad * 2, rowH - pad * 2);

      // Subtle highlight edge along top of stone block
      actx.fillStyle = `rgba(255, 255, 255, ${0.04 + rng() * 0.05})`;
      actx.fillRect(x + pad, y + pad, bw - pad * 2, 3);

      const bv = 150 + Math.floor(rng() * 80);
      bctx.fillStyle = `rgb(${bv}, ${bv}, ${bv})`;
      bctx.fillRect(x + pad, y + pad, bw - pad * 2, rowH - pad * 2);

      x += bw;
    }
  }

  // Micro stone grain noise
  for (let i = 0; i < 3200; i++) {
    const px = rng() * w;
    const py = rng() * h;
    const s = 1 + rng() * 2;
    actx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    actx.fillRect(px, py, s, s);
  }

  return {
    map: finalizeTexture(albedoC, { srgb: true, repeat: [2.4, 1.4] }),
    bumpMap: finalizeTexture(bumpC, { srgb: false, repeat: [2.4, 1.4] }),
  };
}

/**
 * Warm cedar woodgrain texture (vertical slats, interior oak floor, bistro furniture).
 */
export function createWoodTextures({
  baseHex = '#a65c29',
  grainHex = '#7c3f18',
  repeat = [1, 1],
} = {}) {
  const w = 256;
  const h = 512;
  const albedoC = makeCanvas(w, h);
  const bumpC = makeCanvas(w, h);
  const actx = albedoC.getContext('2d');
  const bctx = bumpC.getContext('2d');
  const rng = makeRng(7231);

  actx.fillStyle = baseHex;
  actx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 240; i++) {
    const x = rng() * w;
    const width = 0.8 + rng() * 2.8;
    actx.globalAlpha = 0.14 + rng() * 0.24;
    actx.fillStyle = grainHex;
    actx.fillRect(x, 0, width, h);

    bctx.globalAlpha = 0.28;
    bctx.fillStyle = rng() > 0.5 ? '#a8a8a8' : '#585858';
    bctx.fillRect(x, 0, width, h);
  }
  actx.globalAlpha = 1;
  bctx.globalAlpha = 1;

  return {
    map: finalizeTexture(albedoC, { srgb: true, repeat }),
    bumpMap: finalizeTexture(bumpC, { srgb: false, repeat }),
  };
}

/**
 * Crushed charcoal-slate garden gravel texture with multi-tone mineral pebble grain.
 */
export function createGravelTextures() {
  const size = 512;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const actx = albedoC.getContext('2d');
  const bctx = bumpC.getContext('2d');
  const rng = makeRng(80801);

  actx.fillStyle = '#2d3137';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#404040';
  bctx.fillRect(0, 0, size, size);

  // Draw dense overlapping small crushed angular pebbles
  for (let i = 0; i < 6200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 2.0 + rng() * 4.4;
    const ry = 1.6 + rng() * 3.6;
    const rot = rng() * Math.PI;
    const lum = 36 + Math.floor(rng() * 58);
    const cool = Math.floor(rng() * 8);

    // Subtle dark cast drop below pebble
    actx.fillStyle = 'rgba(12, 14, 17, 0.55)';
    actx.beginPath();
    actx.ellipse(x + 0.8, y + 1.0, rx, ry, rot, 0, Math.PI * 2);
    actx.fill();

    actx.fillStyle = `rgb(${lum}, ${lum + 2}, ${lum + 5 + cool})`;
    actx.beginPath();
    actx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    actx.fill();

    const bv = 120 + Math.floor(rng() * 125);
    bctx.fillStyle = `rgb(${bv}, ${bv}, ${bv})`;
    bctx.beginPath();
    bctx.ellipse(x, y, rx * 0.9, ry * 0.9, rot, 0, Math.PI * 2);
    bctx.fill();
  }

  return {
    map: finalizeTexture(albedoC, { srgb: true, repeat: [4.5, 4.5] }),
    bumpMap: finalizeTexture(bumpC, { srgb: false, repeat: [4.5, 4.5] }),
  };
}

/**
 * Warm pitted sandstone texture for curved stepping stones & entrance stairs.
 */
export function createSandstoneTextures() {
  const size = 256;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const actx = albedoC.getContext('2d');
  const bctx = bumpC.getContext('2d');
  const rng = makeRng(51234);

  actx.fillStyle = '#ddd0b8';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#909090';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1800; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1 + rng() * 5.5;
    actx.fillStyle = rng() > 0.35
      ? `rgba(198, 178, 144, ${0.12 + rng() * 0.22})`
      : `rgba(244, 237, 224, ${0.16 + rng() * 0.2})`;
    actx.beginPath();
    actx.arc(x, y, r, 0, Math.PI * 2);
    actx.fill();

    const b = 95 + Math.floor(rng() * 75);
    bctx.fillStyle = `rgba(${b},${b},${b},0.35)`;
    bctx.beginPath();
    bctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    bctx.fill();
  }

  // Tiny mineral pits
  for (let i = 0; i < 320; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.7 + rng() * 1.4;
    actx.fillStyle = 'rgba(130, 112, 86, 0.38)';
    actx.beginPath();
    actx.arc(x, y, r, 0, Math.PI * 2);
    actx.fill();
    bctx.fillStyle = 'rgb(40,40,40)';
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  return {
    map: finalizeTexture(albedoC, { srgb: true, repeat: [1, 1] }),
    bumpMap: finalizeTexture(bumpC, { srgb: false, repeat: [1, 1] }),
  };
}

/**
 * Granite/river boulder texture with warm sedimentary veins & moss-stone contrast.
 */
export function createBoulderTextures() {
  const size = 256;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const actx = albedoC.getContext('2d');
  const bctx = bumpC.getContext('2d');
  const rng = makeRng(65432);

  actx.fillStyle = '#8b7e70';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 2 + rng() * 14;
    const ry = 1.5 + rng() * 7;
    const rot = (rng() - 0.5) * 0.5;
    const v = 96 + Math.floor(rng() * 74);
    actx.fillStyle = `rgba(${v + 12}, ${v + 4}, ${v - 8}, 0.26)`;
    actx.beginPath();
    actx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    actx.fill();

    const bv = 70 + Math.floor(rng() * 130);
    bctx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.35)`;
    bctx.beginPath();
    bctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    bctx.fill();
  }

  return {
    map: finalizeTexture(albedoC, { srgb: true, repeat: [2, 2] }),
    bumpMap: finalizeTexture(bumpC, { srgb: false, repeat: [2, 2] }),
  };
}

/**
 * Tactile powder-snow granular bump/albedo micro-texture so winter snow cushions
 * look velvety and sculpted rather than flat white plastic.
 */
export function createSnowTextures() {
  const size = 256;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const actx = albedoC.getContext('2d');
  const bctx = bumpC.getContext('2d');
  const rng = makeRng(202612);

  actx.fillStyle = '#f2f5fa';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.8 + rng() * 5.2;
    const bright = rng() > 0.45 ? 255 : 228;
    const tintB = rng() > 0.5 ? 255 : 244;
    actx.fillStyle = `rgba(${bright}, ${Math.min(255, bright + 2)}, ${tintB}, 0.20)`;
    actx.beginPath();
    actx.arc(x, y, r, 0, Math.PI * 2);
    actx.fill();

    const bv = 104 + Math.floor(rng() * 88);
    bctx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.25)`;
    bctx.beginPath();
    bctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
    bctx.fill();
  }

  return {
    map: finalizeTexture(albedoC, { srgb: true, repeat: [3, 3] }),
    bumpMap: finalizeTexture(bumpC, { srgb: false, repeat: [3, 3] }),
  };
}

/**
 * High-resolution 512x512 lacy compound broadleaf foliage spray RGBA CanvasTexture.
 * Painted in neutral light greyscale so vertex colors + seasonal tinting shade cleanly.
 */
export function createBroadleafSprayTexture() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const rng = makeRng(202611);

  const drawLeaf = (cx, cy, len, wid, ang, lum) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);

    const g = ctx.createLinearGradient(0, -wid, len, wid);
    const v0 = Math.round(215 + lum * 40);
    const v1 = Math.round(165 + lum * 52);
    g.addColorStop(0, `rgba(${v1}, ${v1 + 6}, ${v1}, 0.98)`);
    g.addColorStop(0.55, `rgba(${v0}, ${v0}, ${v0}, 0.99)`);
    g.addColorStop(1, `rgba(255, 255, 255, 0.98)`);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.28, -wid, len * 0.72, -wid * 0.85, len, 0);
    ctx.bezierCurveTo(len * 0.72, wid * 0.85, len * 0.28, wid, 0, 0);
    ctx.closePath();
    ctx.fill();

    // Fine bright center vein
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = Math.max(1.2, wid * 0.11);
    ctx.beginPath();
    ctx.moveTo(len * 0.08, 0);
    ctx.lineTo(len * 0.88, 0);
    ctx.stroke();

    ctx.restore();
  };

  // Subtle branching twig lines connecting the cluster
  ctx.strokeStyle = 'rgba(115, 108, 92, 0.88)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const sprays = 6;
  for (let s = 0; s < sprays; s++) {
    const baseAng = (s / sprays) * Math.PI * 2 + (rng() - 0.5) * 0.45;
    const tipX = 256 + Math.cos(baseAng) * (105 + rng() * 35);
    const tipY = 256 + Math.sin(baseAng) * (105 + rng() * 35);
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    const leaflets = 7 + Math.floor(rng() * 4);
    for (let k = 0; k < leaflets; k++) {
      const t = 0.22 + (k / leaflets) * 0.82;
      const ox = THREE.MathUtils.lerp(256, tipX, t) + (rng() - 0.5) * 26;
      const oy = THREE.MathUtils.lerp(256, tipY, t) + (rng() - 0.5) * 26;
      const side = k % 2 === 0 ? 1 : -1;
      const lang = baseAng + side * (0.48 + rng() * 0.55);
      const len = (54 + rng() * 38) * (1.08 - t * 0.24);
      const wid = len * (0.30 + rng() * 0.09);
      drawLeaf(ox, oy, len, wid, lang, 0.35 + t * 0.6 + rng() * 0.25);
    }
  }

  // Center fill leaflets
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * 68;
    const len = 46 + rng() * 28;
    drawLeaf(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, len, len * 0.34, a + (rng() - 0.5), rng());
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Pinnately divided arching fern frond RGBA CanvasTexture (replaces solid green planes).
 */
export function createFernFrondTexture() {
  const w = 256;
  const h = 512;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Central rachis stem
  ctx.strokeStyle = '#4e7b2b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.98);
  ctx.lineTo(w * 0.5, h * 0.04);
  ctx.stroke();

  const pairs = 19;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1); // 0 bottom, 1 tip
    const y = THREE.MathUtils.lerp(h * 0.90, h * 0.07, t);
    const envelope = Math.sin(Math.pow(t, 0.58) * Math.PI * 0.96);
    const len = 14 + envelope * 102;
    const wid = 8 + envelope * 7;

    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(w * 0.5, y - (dir > 0 ? 5 : 0));
      ctx.rotate(dir * (-0.28 + t * 0.14));
      const g = ctx.createLinearGradient(0, 0, dir * len, 0);
      g.addColorStop(0, '#4f822d');
      g.addColorStop(0.65, '#76af3f');
      g.addColorStop(1, '#9fd055');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -wid * 0.45);
      ctx.quadraticCurveTo(dir * len * 0.55, -wid * 0.85, dir * len, 0);
      ctx.quadraticCurveTo(dir * len * 0.55, wid * 0.65, 0, wid * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Lacy clustered hydrangea / viburnum floret spray RGBA CanvasTexture (neutral white-cream base tintable by vertex/material color).
 */
export function createHydrangeaClusterTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const rng = makeRng(33991);

  const drawFloret = (cx, cy, r, rot, shade) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const v = Math.round(205 + shade * 50);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v - 2}, 0.97)`;
    for (let p = 0; p < 4; p++) {
      ctx.save();
      ctx.rotate((p / 4) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(r * 0.52, 0, r * 0.54, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255, 252, 232, 0.95)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  for (let i = 0; i < 36; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.65) * 98;
    const x = 128 + Math.cos(a) * d;
    const y = 128 + Math.sin(a) * d;
    const r = (9 + rng() * 9) * (1.0 - (d / 120) * 0.25);
    drawFloret(x, y, r, rng() * Math.PI * 2, rng());
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Tapered purple/lavender flower raceme spike RGBA CanvasTexture.
 */
export function createFlowerSpikeTexture() {
  const w = 128;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const rng = makeRng(81829);

  // Thin green flower stalk
  ctx.strokeStyle = '#5a8238';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 250);
  ctx.lineTo(64, 24);
  ctx.stroke();

  // Spiraling tiny tubular/bilabiate blossom buds tapering upward
  for (let i = 0; i < 42; i++) {
    const t = i / 41; // 0 bottom .. 1 tip
    const y = THREE.MathUtils.lerp(220, 26, t);
    const maxSpread = THREE.MathUtils.lerp(28, 6, Math.pow(t, 1.15));
    const x = 64 + (rng() - 0.5) * maxSpread * 2.0;
    const rx = (5.5 + rng() * 4.5) * (1.0 - t * 0.45);
    const ry = rx * 1.25;
    const tone = 195 + Math.floor(rng() * 60);
    ctx.fillStyle = `rgba(${tone}, ${Math.round(tone * 0.92)}, 255, 0.97)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (rng() - 0.5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Heart-shaped ivy leaf sprig RGBA texture for trailing 2F window planter tendrils.
 */
export function createIvySprigTexture() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const drawHeartLeaf = (cx, cy, s, rot, shade) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, shade > 0.5 ? '#84b848' : '#659835');
    g.addColorStop(1, '#4a7526');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.05, s * 0.25, -s * 0.85, -s * 0.72, 0, -s * 0.42);
    ctx.bezierCurveTo(s * 0.85, -s * 0.72, s * 1.05, s * 0.25, 0, s * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  ctx.strokeStyle = '#4f7a2c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(64, 118);
  ctx.stroke();

  drawHeartLeaf(44, 34, 22, -0.5, 0.8);
  drawHeartLeaf(84, 52, 20, 0.48, 0.4);
  drawHeartLeaf(46, 80, 18, -0.38, 0.7);
  drawHeartLeaf(76, 104, 15, 0.25, 0.9);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Conifer pine / cypress spiky needle twig spray RGBA texture.
 */
export function createConiferSprayTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const rng = makeRng(77312);

  // Radiating fine spruce/cypress needles along vertical/diagonal twigs
  for (let pass = 0; pass < 3; pass++) {
    const count = pass === 0 ? 180 : 220;
    for (let i = 0; i < count; i++) {
      const ty = 22 + rng() * 212;
      const spread = (1.0 - Math.abs(ty - 128) / 118) * 92 + 12;
      const tx = 128 + (rng() - 0.5) * spread * 1.45;
      const dir = tx >= 128 ? 1 : -1;
      const ang = -Math.PI / 2 + dir * (0.28 + rng() * 0.62) + (rng() - 0.5) * 0.25;
      const len = 14 + rng() * 20;

      const lum = pass === 0 ? 120 : pass === 1 ? 180 : 235;
      ctx.strokeStyle = `rgba(${lum}, ${Math.min(255, lum + 14)}, ${lum - 10}, 0.94)`;
      ctx.lineWidth = 2.0 + rng() * 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(ang) * len, ty + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft contact shadow ellipse shader placed beneath trees, boulders, furniture, and main island.
 */
export function createContactShadowMaterial({ opacity = 0.42, roundness = 0.8 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uOpacity: { value: opacity },
      uRoundness: { value: roundness },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uRoundness;
      varying vec2 vUv;
      void main() {
        vec2 p = ( vUv - 0.5 ) * 2.0;
        float dist = length( vec2( p.x, p.y / max( 0.25, uRoundness ) ) );
        float a = ( 1.0 - smoothstep( 0.10, 0.96, dist ) );
        a = a * a * uOpacity;
        gl_FragColor = vec4( 0.16, 0.14, 0.12, a );
      }
    `,
  });
}

/**
 * Clean physical storefront glass material revealing furnished store interior inside.
 */
export function createClearStorefrontGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fffaf2'),
    transparent: true,
    opacity: 0.10,
    roughness: 0.05,
    metalness: 0.04,
    ior: 1.5,
    reflectivity: 0.48,
    envMapIntensity: 0.58,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Studio seamless cyclorama gradient backdrop + subtle radial glow halo behind diorama.
 */
export function createStudioBackdropMesh() {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTop: sharedUniforms.uBackdropTop,
      uMid: sharedUniforms.uBackdropMid,
      uBottom: sharedUniforms.uBackdropBottom,
      uHaloColor: sharedUniforms.uHaloColor,
      uHaloStrength: sharedUniforms.uHaloStrength,
      uHaloCenter: sharedUniforms.uHaloCenter,
      uAspect: { value: 1.5 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4( position.xy, 0.9999, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;
      uniform vec3 uHaloColor;
      uniform float uHaloStrength;
      uniform vec2 uHaloCenter;
      uniform float uAspect;
      varying vec2 vUv;

      void main() {
        float y = clamp( vUv.y, 0.0, 1.0 );
        vec3 bg = mix( uBottom, uMid, smoothstep( 0.0, 0.45, y ) );
        bg = mix( bg, uTop, smoothstep( 0.45, 1.0, y ) );

        vec2 p = vUv - uHaloCenter;
        p.x *= uAspect;
        float dist = length( p );
        float glow = ( 1.0 - smoothstep( 0.06, 0.62, dist ) ) * uHaloStrength;
        vec3 col = mix( bg, uHaloColor, glow * 0.72 );

        gl_FragColor = vec4( col, 1.0 );
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
