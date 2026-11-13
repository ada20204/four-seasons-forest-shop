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
import {
  TIME_ORDER,
  TIME_PROGRESS,
  TIME_PRESETS,
  sampleTimeState,
} from './scene/timePresets.js';
import { AssemblyController } from './core/assemblyController.js';

const urlParams = new URLSearchParams(window.location.search);
const prefersReducedMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const skipIntroParam = urlParams.get('noIntro') === '1' || prefersReducedMotion;
const querySeason = urlParams.get('season');
const initialSeason = SEASON_PRESETS[querySeason] ? querySeason : 'summer';
const queryTime = urlParams.get('time');
const initialTimeKey = TIME_PRESETS[queryTime] ? queryTime : 'day';
const initialAutoCycle = urlParams.get('cycle') === '1' && !prefersReducedMotion;

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

// 7. Season & Day-to-Night Atmosphere Engine
const seasonBadgeEl = document.getElementById('season-badge');
const timeBadgeEl = document.getElementById('time-badge');
const seasonButtons = Array.from(document.querySelectorAll('[data-season]'));
const timeButtons = Array.from(document.querySelectorAll('[data-time]'));
const cycleBtn = document.getElementById('toggle-cycle');

let currentSeasonKey = initialSeason;
let currentSeasonSnapshot = initPreset;
let activeTransition = {
  from: initPreset,
  to: initPreset,
  progress: 1.0,
  duration: 0.68,
};

let currentTimeKey = initialTimeKey;
let timeProgress = TIME_PROGRESS[initialTimeKey];
let timeTransition = null;
let autoCycle = initialAutoCycle;
let autoCycleDir = initialTimeKey === 'night' ? -1 : 1;
let currentTimeState = sampleTimeState(timeProgress);

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

const _tempSun = new THREE.Color();
const _tempFill = new THREE.Color();
const _tempSky = new THREE.Color();
const _tempGround = new THREE.Color();
const _tempAmb = new THREE.Color();

function updateCelestialParallax() {
  const camAzimuth = Math.atan2(
    camera.position.x - controls.target.x,
    camera.position.z - controls.target.z
  );
  const azDelta = Math.sin(camAzimuth - 0.096);
  sharedUniforms.uMoonPos.value.set(
    THREE.MathUtils.clamp(currentTimeState.moonPos.x - azDelta * 0.055, 0.56, 0.89),
    currentTimeState.moonPos.y
  );
  sharedUniforms.uSunPos.value.set(
    THREE.MathUtils.clamp(currentTimeState.sunPos.x - azDelta * 0.045, 0.04, 0.90),
    currentTimeState.sunPos.y
  );
}

function applyAtmosphere(seasonSnap = currentSeasonSnapshot, progress = timeProgress) {
  const time = sampleTimeState(progress);
  currentTimeState = time;
  const nightMix = THREE.MathUtils.smoothstep(progress, 0.42, 0.96);

  // Celestial key & bounce fill directions arch smoothly above the horizon
  dirLight.position.copy(time.sunDir).multiplyScalar(22);
  fillLight.position.copy(time.fillDir).multiplyScalar(18);

  _tempSun.copy(seasonSnap.sunColor).multiply(time.sunTint);
  dirLight.color.lerpColors(_tempSun, time.sunTint, time.moonLightOverride);
  dirLight.intensity = seasonSnap.sunIntensity * time.sunMult;

  _tempFill.copy(seasonSnap.fillColor).multiply(time.fillTint);
  fillLight.color.lerpColors(_tempFill, time.fillTint, time.moonLightOverride * 0.85);
  fillLight.intensity = seasonSnap.fillIntensity * time.fillMult;

  const skyBlend = Math.max(time.moonLightOverride, time.skyOverride * 0.65);
  _tempSky.copy(seasonSnap.hemiSkyColor).lerp(time.hemiSkyTint, skyBlend);
  _tempGround.copy(seasonSnap.hemiGroundColor).lerp(time.hemiGroundTint, Math.max(time.moonLightOverride, time.skyOverride * 0.7));
  hemiLight.color.copy(_tempSky);
  hemiLight.groundColor.copy(_tempGround);
  hemiLight.intensity = seasonSnap.hemiIntensity * time.hemiMult;

  _tempAmb.copy(seasonSnap.ambientColor).lerp(time.hemiSkyTint, time.moonLightOverride * 0.85);
  ambientLight.color.copy(_tempAmb);
  ambientLight.intensity = seasonSnap.ambientIntensity * time.ambientMult;

  // Sky cyclorama, sunset scatter, stars & moon
  sharedUniforms.uBackdropTop.value.copy(seasonSnap.backdropTop).lerp(time.skyTop, time.backdropMix);
  sharedUniforms.uBackdropMid.value.copy(seasonSnap.backdropMid).lerp(time.skyMid, time.backdropMix);
  sharedUniforms.uBackdropBottom.value.copy(seasonSnap.backdropBottom).lerp(time.skyBottom, time.backdropMix);
  sharedUniforms.uHaloColor.value.copy(seasonSnap.haloColor).lerp(time.haloColor, time.backdropMix);
  sharedUniforms.uHaloStrength.value = THREE.MathUtils.lerp(seasonSnap.haloStrength, time.haloStrength, time.backdropMix);
  sharedUniforms.uMoonMix.value = time.moonMix;
  sharedUniforms.uSunOrbMix.value = time.sunOrbMix;
  sharedUniforms.uStarStrength.value = time.starStrength;
  updateCelestialParallax();

  // Reflections, crevice AO contrast & selective bloom threshold
  scene.environmentIntensity = LIGHTING_BASELINE.envIntensity * time.envMult;
  if (typeof n8aoPass !== 'undefined' && n8aoPass) {
    n8aoPass.configuration.color.copy(time.aoColor);
    n8aoPass.configuration.intensity = time.aoIntensity;
  }
  if (typeof bloomEffect !== 'undefined' && bloomEffect) {
    bloomEffect.luminanceMaterial.threshold = time.bloomThreshold;
    bloomEffect.intensity = time.bloomIntensity;
  }

  // Balanced interior storefront warmth + exterior bollards + patio tabletop candle
  const seasonBoost = seasonSnap.interiorBoost;
  const lightingDrive =
    Math.max(seasonBoost, time.interiorTarget) +
    (seasonBoost - 1) * (0.18 * (1 - nightMix) + 0.25 * nightMix);

  building.warmLights.forEach(({ light, baseIntensity }) => {
    light.intensity = baseIntensity * lightingDrive;
  });
  building.windowGlowMats.forEach(({ mat, baseIntensity }) => {
    mat.emissiveIntensity = baseIntensity * (1 + (lightingDrive - 1) * 0.85);
  });
  building.warmLedMat.emissiveIntensity = baseLedEmissive * (1 + (lightingDrive - 1) * 0.45);
  building.interiorWallMat.emissiveIntensity =
    baseInteriorWallEmissive + THREE.MathUtils.clamp((lightingDrive - 1.0) * 0.22, 0.0, 0.36);

  const bollardDrive = Math.max(seasonBoost, time.bollardMult) + (seasonBoost - 1) * 0.18 * nightMix;
  island.bollardLights.forEach(({ light, baseIntensity }) => {
    light.intensity = baseIntensity * bollardDrive;
  });
  const bollardBulbDrive = Math.max(1 + (seasonBoost - 1) * 0.75, time.bollardBulbMult);
  island.bollardBulbMat.emissiveIntensity = baseBollardEmissive * bollardBulbDrive;

  patio.setCandleWeight(time.patioCandleWeight);

  // Botanicals & seasonal snow + fireflies
  building.bouquetMat.color.copy(seasonSnap.bouquetTint);
  building.indoorLeafMat.color.copy(seasonSnap.planterLeafTint);
  patio.flowerMat.color.copy(seasonSnap.patioFlowerTint);

  botanical.updateSeasonTransition(seasonSnap, seasonSnap, 1.0);
  winterSnow.setSnowWeight(seasonSnap.snowWeight);
  winterSnow.setNightWeight(nightMix);
  seasonalParticles.setAtmosphere({
    fireflyWeight: time.fireflyWeight,
    particleLightFactor: time.particleLightFactor,
  });
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

function syncTimeUI(key) {
  const preset = TIME_PRESETS[key];
  if (!preset) return;
  timeButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.time === key);
  });
  if (timeBadgeEl) {
    timeBadgeEl.textContent = preset.badge;
  }
  document.body.classList.remove('theme-day', 'theme-golden', 'theme-night');
  document.body.classList.add(`theme-${preset.theme}`);
}

function syncCycleUI(flag) {
  if (!cycleBtn) return;
  cycleBtn.textContent = flag ? '流转: 开' : '流转: 关';
  cycleBtn.classList.toggle('is-on', flag);
  cycleBtn.setAttribute('aria-pressed', String(flag));
}

function setAutoCycle(flag) {
  autoCycle = Boolean(flag);
  if (autoCycle) {
    timeTransition = null;
    if (timeProgress >= 0.99) autoCycleDir = -1;
    else if (timeProgress <= 0.01) autoCycleDir = 1;
  }
  syncCycleUI(autoCycle);
}

function setTimeOfDay(key, instant = false, { stopCycle = true } = {}) {
  if (TIME_PROGRESS[key] === undefined) return;
  if (stopCycle && autoCycle) {
    setAutoCycle(false);
  }
  currentTimeKey = key;
  syncTimeUI(key);

  const targetProgress = TIME_PROGRESS[key];
  if (instant || prefersReducedMotion) {
    timeProgress = targetProgress;
    timeTransition = null;
    applyAtmosphere(currentSeasonSnapshot, timeProgress);
    return;
  }

  const span = Math.abs(targetProgress - timeProgress);
  if (span < 0.001) {
    timeProgress = targetProgress;
    timeTransition = null;
    applyAtmosphere(currentSeasonSnapshot, timeProgress);
    return;
  }

  timeTransition = {
    fromProgress: timeProgress,
    toProgress: targetProgress,
    t: 0,
    duration: span > 0.7 ? 1.28 : 0.78,
  };
}

function setSeason(key, instant = false) {
  const nextPreset = SEASON_PRESETS[key];
  if (!nextPreset) return;

  currentSeasonKey = key;
  syncSeasonUI(key);
  seasonalParticles.setSeason(key);

  if (instant || prefersReducedMotion) {
    activeTransition = { from: nextPreset, to: nextPreset, progress: 1.0, duration: 0.68 };
    currentSeasonSnapshot = nextPreset;
    applyAtmosphere(currentSeasonSnapshot, timeProgress);
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

syncSeasonUI(initialSeason);
syncTimeUI(initialTimeKey);
syncCycleUI(initialAutoCycle);

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

// Initialize initial season & time-of-day visuals once postprocessing passes are ready
applyAtmosphere(currentSeasonSnapshot, timeProgress);

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

timeButtons.forEach((btn) => {
  btn.addEventListener('click', () => setTimeOfDay(btn.dataset.time, false));
});

if (cycleBtn) {
  cycleBtn.addEventListener('click', () => setAutoCycle(!autoCycle));
}

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
  } else if (e.key === '7') {
    setTimeOfDay('day', false);
  } else if (e.key === '8') {
    setTimeOfDay('golden', false);
  } else if (e.key === '9') {
    setTimeOfDay('night', false);
  } else if (e.key === 'l' || e.key === 'L') {
    setAutoCycle(!autoCycle);
  } else if (e.key === 'd' || e.key === 'D') {
    const nextTimeIdx = (TIME_ORDER.indexOf(currentTimeKey) + 1) % TIME_ORDER.length;
    setTimeOfDay(TIME_ORDER[nextTimeIdx], false);
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

  let atmosphereDirty = false;

  if (activeTransition.progress < 1.0) {
    activeTransition.progress = Math.min(
      1.0,
      activeTransition.progress + dt / activeTransition.duration
    );
    const ease = 1 - Math.pow(1 - activeTransition.progress, 3);
    currentSeasonSnapshot =
      activeTransition.progress >= 1.0
        ? activeTransition.to
        : captureBlendedSnapshot(activeTransition.from, activeTransition.to, ease);
    atmosphereDirty = true;
  }

  if (autoCycle) {
    timeProgress += autoCycleDir * (dt / 14.0);
    if (timeProgress >= 1.0) {
      timeProgress = 1.0;
      autoCycleDir = -1;
    } else if (timeProgress <= 0.0) {
      timeProgress = 0.0;
      autoCycleDir = 1;
    }
    const nearestKey = timeProgress < 0.24 ? 'day' : timeProgress < 0.74 ? 'golden' : 'night';
    if (nearestKey !== currentTimeKey) {
      currentTimeKey = nearestKey;
      syncTimeUI(nearestKey);
    }
    atmosphereDirty = true;
  } else if (timeTransition) {
    timeTransition.t = Math.min(1.0, timeTransition.t + dt / timeTransition.duration);
    const t = timeTransition.t;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    timeProgress = THREE.MathUtils.lerp(timeTransition.fromProgress, timeTransition.toProgress, ease);
    if (timeTransition.t >= 1.0) {
      timeTransition = null;
    }
    atmosphereDirty = true;
  }

  if (atmosphereDirty) {
    applyAtmosphere(currentSeasonSnapshot, timeProgress);
  }

  seasonalParticles.update(dt, sharedUniforms.uTime.value, camera.quaternion);

  if (viewTween) {
    viewTween.t = Math.min(1, viewTween.t + dt / viewTween.duration);
    const ease = 1 - Math.pow(1 - viewTween.t, 3);
    camera.position.lerpVectors(viewTween.fromPos, viewTween.toPos, ease);
    controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, ease);
    if (viewTween.t >= 1) viewTween = null;
  }

  controls.update();
  updateCelestialParallax();
  renderer.info.reset();
  composer.render();
  frameCount++;
}

requestAnimationFrame(animate);

// Debug / verification hook for headless multi-season, day/night & multi-angle QA checks
window.__STAGE2__ = {
  setView: (key, instant = true) => setCameraView(key, instant),
  setSeason: (key, instant = true) => setSeason(key, instant),
  getSeason: () => currentSeasonKey,
  setTimeOfDay: (key, instant = true) => setTimeOfDay(key, instant),
  getTimeOfDay: () => currentTimeKey,
  getTimeProgress: () => timeProgress,
  setAutoCycle: (flag) => setAutoCycle(flag),
  getAutoCycle: () => autoCycle,
  setParticlesEnabled,
  getParticlesEnabled: () => particlesEnabled,
  getParticleCount: () => seasonalParticles.getActiveCount(),
  getFireflyCount: () => seasonalParticles.getFireflyCount(),
  getTheme: () => Array.from(document.body.classList).find((c) => c.startsWith('theme-')) || 'theme-day',
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
