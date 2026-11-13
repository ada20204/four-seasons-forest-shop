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

sharedUniforms.uBackdropTop.value.copy(LIGHTING_BASELINE.backdropTop);
sharedUniforms.uBackdropMid.value.copy(LIGHTING_BASELINE.backdropMid);
sharedUniforms.uBackdropBottom.value.copy(LIGHTING_BASELINE.backdropBottom);
sharedUniforms.uHaloColor.value.copy(LIGHTING_BASELINE.haloColor);
sharedUniforms.uHaloStrength.value = LIGHTING_BASELINE.haloStrength;

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
const dirLight = new THREE.DirectionalLight(
  LIGHTING_BASELINE.sunColor,
  LIGHTING_BASELINE.sunIntensity
);
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

const fillLight = new THREE.DirectionalLight(
  LIGHTING_BASELINE.fillColor,
  LIGHTING_BASELINE.fillIntensity
);
fillLight.position.copy(LIGHTING_BASELINE.fillDir).multiplyScalar(18);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(
  LIGHTING_BASELINE.hemiSkyColor,
  LIGHTING_BASELINE.hemiGroundColor,
  LIGHTING_BASELINE.hemiIntensity
);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(
  LIGHTING_BASELINE.ambientColor,
  LIGHTING_BASELINE.ambientIntensity
);
scene.add(ambientLight);

// 5. Build Stage 1 Hero Diorama
const dioramaRoot = new THREE.Group();
dioramaRoot.name = 'FourSeasonsDioramaRoot';
scene.add(dioramaRoot);

const { group: islandGroup } = createIslandBase();
dioramaRoot.add(islandGroup);

const { group: buildingGroup } = createBoutiqueBuilding();
dioramaRoot.add(buildingGroup);

const { group: patioGroup } = createOutdoorPatio();
dioramaRoot.add(patioGroup);

const { group: botanicalGroup } = createBotanicalGarden();
dioramaRoot.add(botanicalGroup);

// 6. Postprocessing Pipeline (N8AO + Selective Bloom + AgX ToneMapping + SMAA)
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

// 7. Camera View Presets & Smooth Tweening
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

  if (instant) {
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

viewButtons.forEach((btn) => {
  btn.addEventListener('click', () => setCameraView(btn.dataset.view, false));
});

const resetBtn = document.getElementById('reset-view');
if (resetBtn) {
  resetBtn.addEventListener('click', () => setCameraView('overview', false));
}

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const keyMap = {
    '1': 'overview',
    '2': 'leftFront',
    '3': 'rightFront',
    '4': 'highSide',
    '5': 'rear',
    '6': 'interior',
    r: 'overview',
    R: 'overview',
  };
  if (keyMap[e.key]) {
    setCameraView(keyMap[e.key], false);
  }
});

// 8. Responsive Resize Handling
function updateLayoutProjection() {
  const w = Math.max(1, stageEl.clientWidth);
  const h = Math.max(1, stageEl.clientHeight);
  camera.aspect = w / h;

  // Lift scene optically just slightly above bottom HUD bar without clipping canopy top
  if (w > 760) {
    camera.setViewOffset(w, h, 0, h * 0.025, w, h);
  } else {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
  if (n8aoPass) n8aoPass.setSize(w, h);
  backdropMesh.material.uniforms.uAspect.value = w / h;
}

updateLayoutProjection();
const resizeObserver = new ResizeObserver(updateLayoutProjection);
resizeObserver.observe(stageEl);

// 9. Animation Loop
let lastTime = performance.now();
let frameCount = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  sharedUniforms.uTime.value += dt;

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

// Debug / verification hook for headless multi-angle screenshot checks
window.__STAGE1__ = {
  setView: (key, instant = true) => setCameraView(key, instant),
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
