import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import {
  sharedUniforms,
  createStudioBackdropMesh,
} from './materials/studioMaterials.js';
import { LIGHTING_BASELINE, CAMERA_VIEWS } from './scene/lightingConfig.js';
import { createIslandBase } from './scene/createIslandBase.js';
import { createBoutiqueBuilding } from './scene/createBoutiqueBuilding.js';
import { createOutdoorPatio } from './scene/createOutdoorPatio.js';
import { createBotanicalGarden } from './scene/createBotanicalGarden.js';
import { createWinterSnow } from './scene/createWinterSnow.js';
import { createSeasonalParticles } from './scene/createSeasonalParticles.js';
import { SEASON_ORDER, SEASON_PRESETS } from './scene/seasonPresets.js';
import { AssemblyController } from './core/assemblyController.js';

const urlParams = new URLSearchParams(window.location.search);
const prefersReducedMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const skipIntroParam = urlParams.get('noIntro') === '1' || prefersReducedMotion;
const querySeason = urlParams.get('season');
const initialSeason = SEASON_PRESETS[querySeason] ? querySeason : 'summer';

const stageEl = document.getElementById('stage');

// 1. Renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
} catch (err) {
  const banner = document.createElement('div');
  banner.style.cssText =
    'position:fixed;inset:auto 16px 16px;padding:12px 16px;border-radius:10px;' +
    'background:#7f1d1d;color:#fff;font:13px/1.6 system-ui,sans-serif;z-index:99';
  banner.textContent = '无法初始化 WebGL 渲染器，请在浏览器设置中启用硬件加速。';
  document.body.appendChild(banner);
  throw err;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping; // Managed in EffectPass with AgX
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false;
stageEl.appendChild(renderer.domElement);

// 2. Scene & PMREM Studio Environment
const scene = new THREE.Scene();

const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
const envRT = pmrem.fromScene(roomEnv, 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = LIGHTING_BASELINE.envIntensity;
roomEnv.dispose();

const initPreset = SEASON_PRESETS[initialSeason];
sharedUniforms.uBackdropTop.value.copy(initPreset.backdropTop);
sharedUniforms.uBackdropMid.value.copy(initPreset.backdropMid);
sharedUniforms.uBackdropBottom.value.copy(initPreset.backdropBottom);
sharedUniforms.uHaloColor.value.copy(initPreset.haloColor);
sharedUniforms.uHaloStrength.value = initPreset.haloStrength;

const backdropMesh = createStudioBackdropMesh();
scene.add(backdropMesh);

// 3. Camera & OrbitControls
const camera = new THREE.PerspectiveCamera(
  34,
  stageEl.clientWidth / Math.max(1, stageEl.clientHeight),
  0.15,
  140
);
camera.position.copy(CAMERA_VIEWS.overview.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CAMERA_VIEWS.overview.target);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 6.5;
controls.maxDistance = 46;
controls.minPolarAngle = 0.16;
controls.maxPolarAngle = Math.PI * 0.48;
controls.update();

// 4. Studio Lighting
const dirLight = new THREE.DirectionalLight(initPreset.sunColor, initPreset.sunIntensity);
dirLight.position.copy(LIGHTING_BASELINE.sunDir).multiplyScalar(22);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 2;
dirLight.shadow.camera.far = 52;
const sd = 12.5;
dirLight.shadow.camera.left = -sd;
dirLight.shadow.camera.right = sd;
dirLight.shadow.camera.top = sd;
dirLight.shadow.camera.bottom = -sd;
dirLight.shadow.bias = -0.00035;
dirLight.shadow.normalBias = 0.022;
scene.add(dirLight);
scene.add(dirLight.target);

const fillLight = new THREE.DirectionalLight(initPreset.fillColor, initPreset.fillIntensity);
fillLight.position.copy(LIGHTING_BASELINE.fillDir).multiplyScalar(18);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(
  initPreset.hemiSkyColor,
  initPreset.hemiGroundColor,
  initPreset.hemiIntensity
);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(initPreset.ambientColor, initPreset.ambientIntensity);
scene.add(ambientLight);

// 5. Build Four Seasons Forest Boutique Scene + Winter Snow + Seasonal Particles
const dioramaRoot = new THREE.Group();
dioramaRoot.name = 'FourSeasonsDioramaRoot';
scene.add(dioramaRoot);

const island = createIslandBase();
dioramaRoot.add(island.group);

const building = createBoutiqueBuilding();
dioramaRoot.add(building.group);

const patio = createOutdoorPatio();
dioramaRoot.add(patio.group);

const botanical = createBotanicalGarden({ outlineCurve: island.outlineCurve });
dioramaRoot.add(botanical.group);

const winterSnow = createWinterSnow({ island, botanical, patio });
dioramaRoot.add(winterSnow.group);

const seasonalParticles = createSeasonalParticles({
  initialSeason,
  initiallyEnabled: !prefersReducedMotion,
});
scene.add(seasonalParticles.mesh);

const baseLedEmissive = building.warmLedMat.emissiveIntensity;
const baseBollardEmissive = island.bollardBulbMat.emissiveIntensity;
const baseInteriorWallEmissive = building.interiorWallMat.emissiveIntensity;

// 6. Layered Assembly Animation (`AssemblyController`)
const assembly = new AssemblyController();

// Layer 0: Island base, steps, boulders, patio slate pad & bollards
assembly.add(island.assemblyGroups.baseMound, 0, { liftY: 0.72, driftXZ: 0.04, tiltAmp: 0.02, duration: 0.56 });
assembly.add(island.assemblyGroups.patioPad, 0, { liftY: 0.52, driftXZ: 0.06, tiltAmp: 0.03 });
assembly.add(island.assemblyGroups.pathAndSteps, 0, { liftY: 0.54, driftXZ: 0.08, tiltAmp: 0.03 });
assembly.add(island.assemblyGroups.boulders, 0, { liftY: 0.68, driftXZ: 0.14, tiltAmp: 0.06 });
assembly.add(island.assemblyGroups.bollards, 0, { liftY: 0.65, driftXZ: 0.10, tiltAmp: 0.05 });

// Layer 1: 1F architecture shell, storefront interior & furnishings
assembly.add(building.floor1Group, 1, { liftY: 0.96, driftXZ: 0.05, tiltAmp: 0.03, duration: 0.58 });

// Layer 2: 2F staggered white stucco volumes + 2F planter flora
assembly.add(building.floor2Group, 2, { liftY: 1.08, driftXZ: 0.05, tiltAmp: 0.03, duration: 0.58 });
assembly.add(botanical.assemblyPieces.planterFloraGroup, 2, { liftY: 0.58, driftXZ: 0.08, tiltAmp: 0.05, duration: 0.46 });

// Layer 3: Outdoor patio furniture, trees, evergreens, understory shrubs & sculpted winter snow
assembly.add(patio.group, 3, { liftY: 0.92, driftXZ: 0.12, tiltAmp: 0.05, duration: 0.52 });
botanical.assemblyPieces.treeRootShadows.forEach((rs) =>
  assembly.add(rs, 3, { liftY: 0.35, driftXZ: 0.04, tiltAmp: 0.01, duration: 0.42 })
);
botanical.assemblyPieces.trees.forEach((tr) =>
  assembly.add(tr, 3, { liftY: 1.15, driftXZ: 0.16, tiltAmp: 0.06, duration: 0.56 })
);
botanical.assemblyPieces.conifers.forEach((sp) =>
  assembly.add(sp, 3, { liftY: 1.10, driftXZ: 0.14, tiltAmp: 0.05, duration: 0.54 })
);
botanical.assemblyPieces.cypresses.forEach((cy) =>
  assembly.add(cy, 3, { liftY: 0.95, driftXZ: 0.12, tiltAmp: 0.05, duration: 0.50 })
);
botanical.assemblyPieces.ferns.forEach((fn) =>
  assembly.add(fn, 3, { liftY: 0.52, driftXZ: 0.10, tiltAmp: 0.06, duration: 0.42 })
);
botanical.assemblyPieces.hostas.forEach((hs) =>
  assembly.add(hs, 3, { liftY: 0.52, driftXZ: 0.10, tiltAmp: 0.06, duration: 0.42 })
);
botanical.assemblyPieces.shrubs.forEach((sh) =>
  assembly.add(sh, 3, { liftY: 0.56, driftXZ: 0.12, tiltAmp: 0.07, duration: 0.44 })
);
assembly.add(botanical.assemblyPieces.leafLitterMesh, 3, { liftY: 0.36, driftXZ: 0.04, tiltAmp: 0.02, duration: 0.42 });

// Register winter snow carriers AFTER trees/building so snow settles right with them without fighting season visibility!
assembly.add(winterSnow.assemblyCarriers.groundCarrier, 3, { liftY: 0.65, driftXZ: 0.04, tiltAmp: 0.02, duration: 0.50 });
assembly.add(winterSnow.assemblyCarriers.building1FCarrier, 3, { liftY: 0.72, driftXZ: 0.04, tiltAmp: 0.02, duration: 0.50 });
assembly.add(winterSnow.assemblyCarriers.building2FCarrier, 3, { liftY: 0.80, driftXZ: 0.04, tiltAmp: 0.02, duration: 0.50 });
assembly.add(winterSnow.assemblyCarriers.treesPatioCarrier, 3, { liftY: 0.88, driftXZ: 0.06, tiltAmp: 0.03, duration: 0.52 });

assembly.finalize({ layerGap: 0.28, stagger: 0.015 });

const assemblyBtn = document.getElementById('assembly-action');
assembly.onStateChange = ({ active }) => {
  if (assemblyBtn) {
    assemblyBtn.textContent = active ? '跳过动画' : '重播入场';
  }
};

if (skipIntroParam) {
  assembly.skip();
} else {
  assembly.play();
}

// 7. Season Interpolation Engine
const seasonBadgeEl = document.getElementById('season-badge');
const seasonButtons = Array.from(document.querySelectorAll('[data-season]'));

let currentSeasonKey = initialSeason;
let activeTransition = {
  from: initPreset,
  to: initPreset,
  progress: 1.0,
  duration: 0.68,
};

function lerpCanopyPalette(palA, palB, t) {
  const cO = new THREE.Color(palA.outer).lerp(new THREE.Color(palB.outer), t);
  const cM = new THREE.Color(palA.mid).lerp(new THREE.Color(palB.mid), t);
  const cD = new THREE.Color(palA.deep).lerp(new THREE.Color(palB.deep), t);
  return { outer: `#${cO.getHexString()}`, mid: `#${cM.getHexString()}`, deep: `#${cD.getHexString()}` };
}

function captureBlendedSnapshot(a, b, t) {
  const lerpHex = (hxA, hxB) => `#${new THREE.Color(hxA).lerp(new THREE.Color(hxB), t).getHexString()}`;
  return {
    key: `snap_${Date.now()}`,
    sunColor: a.sunColor.clone().lerp(b.sunColor, t),
    sunIntensity: THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t),
    fillColor: a.fillColor.clone().lerp(b.fillColor, t),
    fillIntensity: THREE.MathUtils.lerp(a.fillIntensity, b.fillIntensity, t),
    hemiSkyColor: a.hemiSkyColor.clone().lerp(b.hemiSkyColor, t),
    hemiGroundColor: a.hemiGroundColor.clone().lerp(b.hemiGroundColor, t),
    hemiIntensity: THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t),
    ambientColor: a.ambientColor.clone().lerp(b.ambientColor, t),
    ambientIntensity: THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, t),
    backdropTop: a.backdropTop.clone().lerp(b.backdropTop, t),
    backdropMid: a.backdropMid.clone().lerp(b.backdropMid, t),
    backdropBottom: a.backdropBottom.clone().lerp(b.backdropBottom, t),
    haloColor: a.haloColor.clone().lerp(b.haloColor, t),
    haloStrength: THREE.MathUtils.lerp(a.haloStrength, b.haloStrength, t),
    interiorBoost: THREE.MathUtils.lerp(a.interiorBoost, b.interiorBoost, t),
    snowWeight: THREE.MathUtils.lerp(a.snowWeight, b.snowWeight, t),
    autumnLitterWeight: THREE.MathUtils.lerp(a.autumnLitterWeight, b.autumnLitterWeight, t),
    canopyPalettes: a.canopyPalettes.map((palA, i) => lerpCanopyPalette(palA, b.canopyPalettes[i] || palA, t)),
    coniferTint: a.coniferTint.clone().lerp(b.coniferTint, t),
    cypressTint: a.cypressTint.clone().lerp(b.cypressTint, t),
    fernTint: a.fernTint.clone().lerp(b.fernTint, t),
    hostaTint: a.hostaTint.clone().lerp(b.hostaTint, t),
    planterLeafTint: a.planterLeafTint.clone().lerp(b.planterLeafTint, t),
    planterBloomPrimary: a.planterBloomPrimary.clone().lerp(b.planterBloomPrimary, t),
    planterBloomSecondary: a.planterBloomSecondary.clone().lerp(b.planterBloomSecondary, t),
    vineTint: a.vineTint.clone().lerp(b.vineTint, t),
    bouquetTint: a.bouquetTint.clone().lerp(b.bouquetTint, t),
    patioFlowerTint: a.patioFlowerTint.clone().lerp(b.patioFlowerTint, t),
    shrubPalette: {
      leaf: lerpHex(a.shrubPalette.leaf, b.shrubPalette.leaf),
      hydrangea: lerpHex(a.shrubPalette.hydrangea, b.shrubPalette.hydrangea),
      hydrangeaAlt: lerpHex(a.shrubPalette.hydrangeaAlt, b.shrubPalette.hydrangeaAlt),
      pinkMound: lerpHex(a.shrubPalette.pinkMound, b.shrubPalette.pinkMound),
      spike: lerpHex(a.shrubPalette.spike, b.shrubPalette.spike),
      yellow: lerpHex(a.shrubPalette.yellow, b.shrubPalette.yellow),
    },
  };
}

function applySeasonVisuals(presetA, presetB, t) {
  const blend = THREE.MathUtils.clamp(t, 0, 1);

  dirLight.color.lerpColors(presetA.sunColor, presetB.sunColor, blend);
  dirLight.intensity = THREE.MathUtils.lerp(presetA.sunIntensity, presetB.sunIntensity, blend);
  fillLight.color.lerpColors(presetA.fillColor, presetB.fillColor, blend);
  fillLight.intensity = THREE.MathUtils.lerp(presetA.fillIntensity, presetB.fillIntensity, blend);
  hemiLight.color.lerpColors(presetA.hemiSkyColor, presetB.hemiSkyColor, blend);
  hemiLight.groundColor.lerpColors(presetA.hemiGroundColor, presetB.hemiGroundColor, blend);
  hemiLight.intensity = THREE.MathUtils.lerp(presetA.hemiIntensity, presetB.hemiIntensity, blend);
  ambientLight.color.lerpColors(presetA.ambientColor, presetB.ambientColor, blend);
  ambientLight.intensity = THREE.MathUtils.lerp(presetA.ambientIntensity, presetB.ambientIntensity, blend);

  sharedUniforms.uBackdropTop.value.lerpColors(presetA.backdropTop, presetB.backdropTop, blend);
  sharedUniforms.uBackdropMid.value.lerpColors(presetA.backdropMid, presetB.backdropMid, blend);
  sharedUniforms.uBackdropBottom.value.lerpColors(presetA.backdropBottom, presetB.backdropBottom, blend);
  sharedUniforms.uHaloColor.value.lerpColors(presetA.haloColor, presetB.haloColor, blend);
  sharedUniforms.uHaloStrength.value = THREE.MathUtils.lerp(presetA.haloStrength, presetB.haloStrength, blend);

  const boost = THREE.MathUtils.lerp(presetA.interiorBoost, presetB.interiorBoost, blend);
  building.warmLights.forEach(({ light, baseIntensity }) => {
    light.intensity = baseIntensity * boost;
  });
  building.windowGlowMats.forEach(({ mat, baseIntensity }) => {
    mat.emissiveIntensity = baseIntensity * (1 + (boost - 1) * 0.85);
  });
  building.warmLedMat.emissiveIntensity = baseLedEmissive * (1 + (boost - 1) * 0.45);
  building.interiorWallMat.emissiveIntensity = baseInteriorWallEmissive + Math.max(0, boost - 1) * 0.44;
  island.bollardLights.forEach(({ light, baseIntensity }) => {
    light.intensity = baseIntensity * boost;
  });
  island.bollardBulbMat.emissiveIntensity = baseBollardEmissive * (1 + (boost - 1) * 0.75);

  building.bouquetMat.color.lerpColors(presetA.bouquetTint, presetB.bouquetTint, blend);
  building.indoorLeafMat.color.lerpColors(presetA.planterLeafTint, presetB.planterLeafTint, blend);
  patio.flowerMat.color.lerpColors(presetA.patioFlowerTint, presetB.patioFlowerTint, blend);

  botanical.updateSeasonTransition(presetA, presetB, blend);
  winterSnow.setSnowWeight(THREE.MathUtils.lerp(presetA.snowWeight, presetB.snowWeight, blend));
}

function syncSeasonUI(key) {
  const preset = SEASON_PRESETS[key];
  seasonButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.season === key);
  });
  if (seasonBadgeEl && preset) {
    seasonBadgeEl.textContent = preset.badge;
  }
}

function setSeason(key, instant = false) {
  const nextPreset = SEASON_PRESETS[key];
  if (!nextPreset) return;

  currentSeasonKey = key;
  syncSeasonUI(key);
  seasonalParticles.setSeason(key);

  if (instant || prefersReducedMotion) {
    activeTransition = { from: nextPreset, to: nextPreset, progress: 1.0, duration: 0.68 };
    applySeasonVisuals(nextPreset, nextPreset, 1.0);
    return;
  }

  const fromSnapshot =
    activeTransition.progress >= 1.0
      ? activeTransition.to
      : captureBlendedSnapshot(
          activeTransition.from,
          activeTransition.to,
          1 - Math.pow(1 - activeTransition.progress, 3)
        );

  activeTransition = {
    from: fromSnapshot,
    to: nextPreset,
    progress: 0.0,
    duration: 0.68,
  };
}

// Initialize initial season visuals synchronously before first render
applySeasonVisuals(initPreset, initPreset, 1.0);
syncSeasonUI(initialSeason);

// 8. Postprocessing Pipeline (N8AO + Selective Bloom + AgX ToneMapping + SMAA)
const supportsHalfFloat =
  renderer.capabilities.isWebGL2 ||
  Boolean(renderer.getContext().getExtension('EXT_color_buffer_half_float'));

const composer = new EffectComposer(renderer, {
  frameBufferType: supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
});

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

let n8aoPass = null;
try {
  n8aoPass = new N8AOPostPass(scene, camera, stageEl.clientWidth, stageEl.clientHeight);
  n8aoPass.configuration.aoRadius = 1.45;
  n8aoPass.configuration.distanceFalloff = 1.05;
  n8aoPass.configuration.intensity = 1.95;
  n8aoPass.configuration.color.copy(LIGHTING_BASELINE.aoColor);
  n8aoPass.configuration.halfRes = true;
  n8aoPass.configuration.gammaCorrection = false;
  composer.addPass(n8aoPass);
} catch (aoErr) {
  console.warn('N8AOPostPass unavailable, falling back without AO:', aoErr);
  n8aoPass = null;
}

const bloomEffect = new BloomEffect({
  mipmapBlur: true,
  luminanceThreshold: LIGHTING_BASELINE.bloomThreshold,
  luminanceSmoothing: 0.24,
  intensity: LIGHTING_BASELINE.bloomIntensity,
});
const toneMappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
const smaaEffect = new SMAAEffect();
const effectPass = new EffectPass(camera, bloomEffect, toneMappingEffect, smaaEffect);
composer.addPass(effectPass);

// 9. Camera View Presets & Smooth Tweening
let viewTween = null;
const viewButtons = Array.from(document.querySelectorAll('[data-view]'));

function syncViewButtonState(key) {
  viewButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === key);
  });
}

function setCameraView(key, instant = false) {
  const preset = CAMERA_VIEWS[key];
  if (!preset) return;
  syncViewButtonState(key);

  if (instant || prefersReducedMotion) {
    camera.position.copy(preset.pos);
    controls.target.copy(preset.target);
    controls.update();
    viewTween = null;
    return;
  }

  viewTween = {
    fromPos: camera.position.clone(),
    toPos: preset.pos.clone(),
    fromTarget: controls.target.clone(),
    toTarget: preset.target.clone(),
    t: 0,
    duration: 0.85,
  };
}

controls.addEventListener('start', () => {
  viewTween = null;
});

viewButtons.forEach((btn) => {
  btn.addEventListener('click', () => setCameraView(btn.dataset.view, false));
});

seasonButtons.forEach((btn) => {
  btn.addEventListener('click', () => setSeason(btn.dataset.season, false));
});

const resetBtn = document.getElementById('reset-view');
if (resetBtn) {
  resetBtn.addEventListener('click', () => setCameraView('overview', false));
}

const particlesBtn = document.getElementById('toggle-particles');
let particlesEnabled = !prefersReducedMotion;

function setParticlesEnabled(flag) {
  particlesEnabled = Boolean(flag);
  seasonalParticles.setEnabled(particlesEnabled);
  if (particlesBtn) {
    particlesBtn.textContent = particlesEnabled ? '飘落: 开' : '飘落: 关';
    particlesBtn.classList.toggle('is-on', particlesEnabled);
    particlesBtn.setAttribute('aria-pressed', String(particlesEnabled));
  }
}

setParticlesEnabled(particlesEnabled);

if (particlesBtn) {
  particlesBtn.addEventListener('click', () => setParticlesEnabled(!particlesEnabled));
}

if (assemblyBtn) {
  assemblyBtn.addEventListener('click', () => {
    if (assembly.active) {
      assembly.skip();
    } else {
      assembly.play();
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const viewKeyMap = {
    '1': 'overview',
    '2': 'leftFront',
    '3': 'rightFront',
    '4': 'highSide',
    '5': 'rear',
    '6': 'interior',
    r: 'overview',
    R: 'overview',
  };
  if (viewKeyMap[e.key]) {
    setCameraView(viewKeyMap[e.key], false);
    return;
  }

  const seasonKeyMap = {
    q: 'spring',
    Q: 'spring',
    w: 'summer',
    W: 'summer',
    e: 'autumn',
    E: 'autumn',
    a: 'winter',
    A: 'winter',
  };
  if (seasonKeyMap[e.key]) {
    setSeason(seasonKeyMap[e.key], false);
    return;
  }

  if (e.key === 'ArrowRight' || e.key === ']') {
    const nextIdx = (SEASON_ORDER.indexOf(currentSeasonKey) + 1) % SEASON_ORDER.length;
    setSeason(SEASON_ORDER[nextIdx], false);
  } else if (e.key === 'ArrowLeft' || e.key === '[') {
    const prevIdx =
      (SEASON_ORDER.indexOf(currentSeasonKey) - 1 + SEASON_ORDER.length) % SEASON_ORDER.length;
    setSeason(SEASON_ORDER[prevIdx], false);
  } else if (e.key === 'p' || e.key === 'P') {
    setParticlesEnabled(!particlesEnabled);
  }
});

// 10. Responsive Resize Handling
function updateLayoutProjection() {
  const w = Math.max(1, stageEl.clientWidth);
  const h = Math.max(1, stageEl.clientHeight);
  const aspect = w / h;
  camera.aspect = aspect;

  // Adapt vertical FOV dynamically on portrait/narrow screens so horizontal canopies & umbrella stay unclipped
  if (aspect < 1.0) {
    const baseHalfTan = Math.tan(THREE.MathUtils.degToRad(34 * 0.5));
    const portraitHalfTan = baseHalfTan / Math.pow(Math.max(0.38, aspect), 0.74);
    camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(portraitHalfTan)), 34, 62);
    camera.setViewOffset(w, h, 0, h * 0.02, w, h);
  } else {
    camera.fov = 34;
    if (w > 760) {
      camera.setViewOffset(w, h, 0, h * 0.025, w, h);
    } else {
      camera.clearViewOffset();
    }
  }
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
  if (n8aoPass) n8aoPass.setSize(w, h);
  backdropMesh.material.uniforms.uAspect.value = aspect;
}

updateLayoutProjection();
const resizeObserver = new ResizeObserver(updateLayoutProjection);
resizeObserver.observe(stageEl);

// 11. Animation Loop
let lastTime = performance.now();
let frameCount = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  sharedUniforms.uTime.value += dt;

  if (assembly.active) {
    assembly.update(dt);
  }

  if (activeTransition.progress < 1.0) {
    activeTransition.progress = Math.min(
      1.0,
      activeTransition.progress + dt / activeTransition.duration
    );
    const ease = 1 - Math.pow(1 - activeTransition.progress, 3);
    applySeasonVisuals(activeTransition.from, activeTransition.to, ease);
  }

  seasonalParticles.update(dt, sharedUniforms.uTime.value);

  if (viewTween) {
    viewTween.t = Math.min(1, viewTween.t + dt / viewTween.duration);
    const ease = 1 - Math.pow(1 - viewTween.t, 3);
    camera.position.lerpVectors(viewTween.fromPos, viewTween.toPos, ease);
    controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, ease);
    if (viewTween.t >= 1) viewTween = null;
  }

  controls.update();
  renderer.info.reset();
  composer.render();
  frameCount++;
}

requestAnimationFrame(animate);

// Debug / verification hook for headless multi-season & multi-angle QA checks
window.__STAGE2__ = {
  setView: (key, instant = true) => setCameraView(key, instant),
  setSeason: (key, instant = true) => setSeason(key, instant),
  getSeason: () => currentSeasonKey,
  setParticlesEnabled,
  getParticlesEnabled: () => particlesEnabled,
  getParticleCount: () => seasonalParticles.getActiveCount(),
  replayAssembly: () => assembly.play(),
  finishAssembly: () => assembly.skip(),
  getAssemblyState: () => ({
    active: assembly.active,
    completed: assembly.completed,
    elapsed: assembly.elapsed,
    total: assembly.total,
  }),
  getCamera: () => ({
    pos: camera.position.toArray(),
    target: controls.target.toArray(),
  }),
  getStats: () => ({
    frameCount,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  }),
};
