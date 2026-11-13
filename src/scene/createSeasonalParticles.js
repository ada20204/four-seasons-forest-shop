import * as THREE from 'three';

function createRng(seed = 50505) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function createPetalTexture() {
  const c = makeCanvas(96, 96);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 96, 96);

  const grad = ctx.createRadialGradient(48, 54, 4, 48, 48, 40);
  grad.addColorStop(0, '#ffe8f0');
  grad.addColorStop(0.6, '#ffa7c7');
  grad.addColorStop(1, '#f27aa8');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(48, 18);
  ctx.bezierCurveTo(64, 10, 82, 30, 74, 58);
  ctx.bezierCurveTo(68, 76, 54, 84, 48, 86);
  ctx.bezierCurveTo(42, 84, 28, 76, 22, 58);
  ctx.bezierCurveTo(14, 30, 32, 10, 48, 18);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFireflyTexture() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);

  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0.0, 'rgba(255, 252, 224, 1.0)');
  grad.addColorStop(0.22, 'rgba(255, 220, 118, 0.92)');
  grad.addColorStop(0.55, 'rgba(255, 178, 56, 0.34)');
  grad.addColorStop(1.0, 'rgba(255, 160, 40, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLeafTexture(cLight, cDark) {
  const c = makeCanvas(96, 96);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 96, 96);

  const grad = ctx.createLinearGradient(20, 12, 76, 84);
  grad.addColorStop(0, cLight);
  grad.addColorStop(1, cDark);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(48, 10);
  ctx.bezierCurveTo(72, 24, 78, 56, 48, 86);
  ctx.bezierCurveTo(18, 56, 24, 24, 48, 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(48, 18);
  ctx.lineTo(48, 80);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSnowflakeTexture() {
  const c = makeCanvas(96, 96);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 96, 96);

  // Soft powder bokeh halo
  const halo = ctx.createRadialGradient(48, 48, 3, 48, 48, 44);
  halo.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  halo.addColorStop(0.35, 'rgba(246, 251, 255, 0.92)');
  halo.addColorStop(0.70, 'rgba(232, 242, 255, 0.42)');
  halo.addColorStop(1, 'rgba(225, 238, 255, 0.0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(48, 48, 44, 0, Math.PI * 2);
  ctx.fill();

  // Crisp subtle 6-point crystal star inside
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(48 - Math.cos(a) * 24, 48 - Math.sin(a) * 24);
    ctx.lineTo(48 + Math.cos(a) * 24, 48 + Math.sin(a) * 24);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const MODE_CONFIGS = {
  spring: {
    count: 130,
    fallMin: 0.45,
    fallMax: 0.82,
    swayAmp: 0.55,
    scaleMin: 0.09,
    scaleMax: 0.16,
    spinRate: 1.6,
    tint: '#ffffff',
  },
  summer: {
    count: 58,
    fallMin: 0.42,
    fallMax: 0.72,
    swayAmp: 0.45,
    scaleMin: 0.09,
    scaleMax: 0.15,
    spinRate: 1.3,
    tint: '#ffffff',
  },
  autumn: {
    count: 125,
    fallMin: 0.52,
    fallMax: 0.94,
    swayAmp: 0.65,
    scaleMin: 0.10,
    scaleMax: 0.19,
    spinRate: 1.9,
    tint: '#ffffff',
  },
  winter: {
    count: 165,
    fallMin: 0.56,
    fallMax: 1.05,
    swayAmp: 0.42,
    scaleMin: 0.08,
    scaleMax: 0.17,
    spinRate: 0.5,
    tint: '#ffffff',
  },
};

/**
 * Pooled seasonal falling particle system (sakura petals, summer leaves, autumn leaves, snowflakes).
 * Zero cross-season leftovers & bounded recycle loop without accumulation leaks.
 */
export function createSeasonalParticles({ initialSeason = 'summer', initiallyEnabled = true } = {}) {
  const MAX_COUNT = 170;
  const rng = createRng(779911);

  const textures = {
    spring: createPetalTexture(),
    summer: createLeafTexture('#a2dc52', '#5c9c2c'),
    autumn: createLeafTexture('#ffda4e', '#dd6d1c'),
    winter: createSnowflakeTexture(),
  };

  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: textures[initialSeason],
    color: new THREE.Color('#ffffff'),
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    alphaTest: 0.06,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX_COUNT);
  mesh.name = 'SeasonalFallingParticles';
  mesh.frustumCulled = false;

  // Warm additive golden fireflies for Summer Dusk/Night
  const MAX_FIREFLIES = 44;
  const fireflyMat = new THREE.MeshBasicMaterial({
    map: createFireflyTexture(),
    color: new THREE.Color('#ffea92'),
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fireflyMesh = new THREE.InstancedMesh(geo, fireflyMat, MAX_FIREFLIES);
  fireflyMesh.name = 'SummerEveningFireflies';
  fireflyMesh.frustumCulled = false;
  fireflyMesh.visible = false;

  const fireflies = Array.from({ length: MAX_FIREFLIES }, () => {
    const side = rng() > 0.4 ? -1 : 1;
    const x = side * (3.6 + rng() * 4.4);
    const z = (rng() - 0.5) * 9.5;
    const y = 0.65 + rng() * 4.2;
    return {
      bx: x,
      by: y,
      bz: z,
      phase: rng() * Math.PI * 2,
      speed: 0.45 + rng() * 0.7,
      radius: 0.25 + rng() * 0.55,
      blinkSpeed: 1.4 + rng() * 2.2,
      size: 0.17 + rng() * 0.16,
    };
  });

  const wrapper = new THREE.Group();
  wrapper.name = 'SeasonalAtmosphereParticles';
  wrapper.add(mesh, fireflyMesh);

  const particles = Array.from({ length: MAX_COUNT }, () => ({
    x: (rng() - 0.5) * 14.5,
    y: 0.6 + rng() * 10.2,
    z: (rng() - 0.5) * 11.5,
    speed: 0.55 + rng() * 0.45,
    phase: rng() * Math.PI * 2,
    swayFreq: 0.7 + rng() * 0.9,
    rotX: rng() * Math.PI * 2,
    rotY: rng() * Math.PI * 2,
    rotZ: rng() * Math.PI * 2,
    spinX: (rng() - 0.5) * 2.0,
    spinY: (rng() - 0.5) * 2.2,
    spinZ: (rng() - 0.5) * 1.6,
    sizeSeed: rng(),
  }));

  const dummy = new THREE.Object3D();
  let currentSeason = initialSeason;
  let enabled = initiallyEnabled;
  let fadeOpacity = 1.0;
  let fireflyWeight = 0.0;
  let lightFactor = 1.0;

  function respawn(p, startHigh = true) {
    p.x = (rng() - 0.5) * 15.2;
    p.z = (rng() - 0.5) * 12.2 - 0.4;
    p.y = startHigh ? 9.4 + rng() * 2.4 : 0.7 + rng() * 10.2;
    p.phase = rng() * Math.PI * 2;
  }

  function setSeason(season) {
    if (!MODE_CONFIGS[season]) return;
    currentSeason = season;
    mat.map = textures[season];
    applyParticleColor();
    mat.needsUpdate = true;

    // Cleanly reset all particles immediately on season change so previous leaves/petals never remain!
    particles.forEach((p) => respawn(p, false));
    fadeOpacity = 0.05;
    update(0.016, 0);
  }

  function applyParticleColor() {
    mat.color.set(MODE_CONFIGS[currentSeason].tint).multiplyScalar(lightFactor);
    if (currentSeason === 'winter' && lightFactor < 0.95) {
      mat.color.lerp(new THREE.Color('#c2dcff'), 1 - lightFactor);
    }
  }

  function setAtmosphere({ fireflyWeight: fw = 0, particleLightFactor = 1 } = {}) {
    fireflyWeight = THREE.MathUtils.clamp(fw, 0, 1);
    lightFactor = THREE.MathUtils.clamp(particleLightFactor, 0.4, 1.1);
    applyParticleColor();
  }

  function setEnabled(flag) {
    enabled = Boolean(flag);
    wrapper.visible = enabled;
  }

  function getActiveCount() {
    return enabled ? MODE_CONFIGS[currentSeason].count : 0;
  }

  function getFireflyCount() {
    return enabled && currentSeason === 'summer' && fireflyWeight > 0.02 ? MAX_FIREFLIES : 0;
  }

  function update(dt, timeSec = 0, cameraQuat = null) {
    wrapper.visible = enabled;
    if (!enabled) return;

    const cfg = MODE_CONFIGS[currentSeason];
    fadeOpacity = Math.min(1.0, fadeOpacity + dt * 2.4);
    mat.opacity = 0.94 * fadeOpacity;

    const activeCount = cfg.count;
    for (let i = 0; i < MAX_COUNT; i++) {
      const p = particles[i];
      if (i >= activeCount) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -50, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const fallSpeed = THREE.MathUtils.lerp(cfg.fallMin, cfg.fallMax, p.speed);
      p.y -= fallSpeed * dt;
      if (p.y < 0.28) {
        respawn(p, true);
      }

      const swayX = Math.sin(timeSec * p.swayFreq + p.phase) * cfg.swayAmp;
      const swayZ = Math.cos(timeSec * p.swayFreq * 0.8 + p.phase) * cfg.swayAmp * 0.65;

      p.rotX += p.spinX * cfg.spinRate * dt;
      p.rotY += p.spinY * cfg.spinRate * dt;
      p.rotZ += p.spinZ * cfg.spinRate * dt;

      // Soft spawn fade-in at sky ceiling & smooth fade-out just above gravel/snow floor
      const topFade = THREE.MathUtils.smoothstep(11.6 - p.y, 0.0, 1.4);
      const bottomFade = THREE.MathUtils.smoothstep(p.y, 0.28, 1.05);
      const baseScale = THREE.MathUtils.lerp(cfg.scaleMin, cfg.scaleMax, p.sizeSeed);
      const s = baseScale * topFade * bottomFade;

      dummy.position.set(p.x + swayX, p.y, p.z + swayZ);
      if (currentSeason === 'winter') {
        dummy.rotation.set(0, timeSec * 0.3 + p.phase, p.rotZ * 0.5);
      } else {
        dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      }
      dummy.scale.setScalar(Math.max(0.0001, s));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    const showFireflies = currentSeason === 'summer' && fireflyWeight > 0.02;
    fireflyMesh.visible = showFireflies;
    if (showFireflies) {
      fireflyMat.opacity = fireflyWeight * 0.92;
      for (let i = 0; i < MAX_FIREFLIES; i++) {
        const f = fireflies[i];
        const t = timeSec * f.speed + f.phase;
        dummy.position.set(
          f.bx + Math.sin(t) * f.radius,
          f.by + Math.sin(t * 1.4 + 0.6) * 0.28,
          f.bz + Math.cos(t * 0.85) * f.radius
        );
        if (cameraQuat) {
          dummy.quaternion.copy(cameraQuat);
        } else {
          dummy.rotation.set(0, 0, 0);
        }
        const blink = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * f.blinkSpeed + f.phase), 2);
        dummy.scale.setScalar(f.size * blink * fireflyWeight);
        dummy.updateMatrix();
        fireflyMesh.setMatrixAt(i, dummy.matrix);
      }
      fireflyMesh.instanceMatrix.needsUpdate = true;
    }
  }

  setSeason(initialSeason);
  setEnabled(initiallyEnabled);

  return {
    mesh: wrapper,
    setSeason,
    setEnabled,
    setAtmosphere,
    update,
    getActiveCount,
    getFireflyCount,
  };
}
