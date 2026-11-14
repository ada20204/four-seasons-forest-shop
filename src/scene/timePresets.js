import * as THREE from 'three';

/**
 * Time-of-day lighting curve spanning high sunlit day -> golden sunset -> moonlit night.
 * Engineered to pair orthogonally with all 4 seasons while keeping tactile material depth.
 */
export const TIME_ORDER = ['day', 'golden', 'night'];

export const TIME_PROGRESS = {
  day: 0.0,
  golden: 0.48,
  night: 1.0,
};

export const TIME_PRESETS = {
  day: {
    key: 'day',
    label: '晴昼',
    badge: 'DAY · 晴昼',
    theme: 'day',
    sunDir: new THREE.Vector3(0.58, 0.86, 0.44).normalize(),
    fillDir: new THREE.Vector3(-0.7, 0.52, 0.35).normalize(),
    sunTint: new THREE.Color('#fff9f0'),
    sunMult: 1.08,
    fillTint: new THREE.Color('#eef4ff'),
    fillMult: 1.02,
    hemiSkyTint: new THREE.Color('#ffffff'),
    hemiGroundTint: new THREE.Color('#ffffff'),
    hemiMult: 1.02,
    ambientMult: 1.0,
    moonLightOverride: 0.0,
    skyOverride: 0.0,
    backdropMix: 0.0,
    skyTop: new THREE.Color().setRGB(2.35, 2.15, 1.88),
    skyMid: new THREE.Color().setRGB(2.25, 2.02, 1.72),
    skyBottom: new THREE.Color().setRGB(1.95, 1.68, 1.38),
    haloColor: new THREE.Color().setRGB(2.88, 2.74, 2.52),
    haloStrength: 0.56,
    moonMix: 0.0,
    moonPos: new THREE.Vector2(0.79, 0.81),
    sunOrbMix: 0.24,
    sunPos: new THREE.Vector2(0.76, 0.84),
    starStrength: 0.0,
    envMult: 1.08,
    aoColor: new THREE.Color('#2c241d'),
    aoIntensity: 1.95,
    bloomThreshold: 3.15,
    bloomIntensity: 0.28,
    interiorTarget: 1.0,
    bollardMult: 1.0,
    bollardBulbMult: 1.0,
    patioCandleWeight: 0.0,
    snowEmissiveScale: 1.0,
    fireflyWeight: 0.0,
    particleLightFactor: 1.0,
  },

  golden: {
    key: 'golden',
    label: '暮色',
    badge: 'DUSK · 暮色',
    theme: 'golden',
    sunDir: new THREE.Vector3(-0.86, 0.28, 0.44).normalize(),
    fillDir: new THREE.Vector3(0.72, 0.5, 0.42).normalize(),
    sunTint: new THREE.Color('#ff943c'),
    sunMult: 1.46,
    fillTint: new THREE.Color('#6882cf'),
    fillMult: 0.72,
    hemiSkyTint: new THREE.Color('#a476ab'),
    hemiGroundTint: new THREE.Color('#5a4346'),
    hemiMult: 0.44,
    ambientMult: 0.34,
    moonLightOverride: 0.34,
    skyOverride: 0.68,
    backdropMix: 0.94,
    skyTop: new THREE.Color().setRGB(0.18, 0.21, 0.5),
    skyMid: new THREE.Color().setRGB(0.74, 0.42, 0.54),
    skyBottom: new THREE.Color().setRGB(1.48, 0.72, 0.38),
    haloColor: new THREE.Color().setRGB(2.05, 1.08, 0.68),
    haloStrength: 0.48,
    moonMix: 0.0,
    moonPos: new THREE.Vector2(0.79, 0.81),
    sunOrbMix: 1.12,
    sunPos: new THREE.Vector2(0.16, 0.52),
    starStrength: 0.28,
    envMult: 0.38,
    aoColor: new THREE.Color('#191124'),
    aoIntensity: 2.12,
    bloomThreshold: 1.54,
    bloomIntensity: 0.42,
    interiorTarget: 2.08,
    bollardMult: 2.65,
    bollardBulbMult: 1.92,
    patioCandleWeight: 0.92,
    snowEmissiveScale: 0.36,
    fireflyWeight: 0.55,
    particleLightFactor: 0.86,
  },

  night: {
    key: 'night',
    label: '月夜',
    badge: 'NIGHT · 月夜',
    theme: 'night',
    sunDir: new THREE.Vector3(0.46, 0.86, 0.18).normalize(),
    fillDir: new THREE.Vector3(-0.56, 0.5, 0.64).normalize(),
    sunTint: new THREE.Color('#a8cbff'),
    sunMult: 0.66,
    fillTint: new THREE.Color('#4f73b0'),
    fillMult: 0.74,
    hemiSkyTint: new THREE.Color('#2c487c'),
    hemiGroundTint: new THREE.Color('#101726'),
    hemiMult: 0.4,
    ambientMult: 0.32,
    moonLightOverride: 0.92,
    skyOverride: 0.95,
    backdropMix: 1.0,
    skyTop: new THREE.Color().setRGB(0.008, 0.016, 0.048),
    skyMid: new THREE.Color().setRGB(0.016, 0.032, 0.084),
    skyBottom: new THREE.Color().setRGB(0.032, 0.058, 0.128),
    haloColor: new THREE.Color().setRGB(0.052, 0.095, 0.21),
    haloStrength: 0.38,
    moonMix: 1.0,
    moonPos: new THREE.Vector2(0.79, 0.81),
    sunOrbMix: 0.0,
    sunPos: new THREE.Vector2(0.06, 0.46),
    starStrength: 1.0,
    envMult: 0.2,
    aoColor: new THREE.Color('#040814'),
    aoIntensity: 2.2,
    bloomThreshold: 1.24,
    bloomIntensity: 0.48,
    interiorTarget: 2.48,
    bollardMult: 3.55,
    bollardBulbMult: 2.3,
    patioCandleWeight: 1.0,
    snowEmissiveScale: 0.04,
    fireflyWeight: 1.0,
    particleLightFactor: 0.72,
  },
};

function lerpPresetSegment(a, b, rawT) {
  const t = THREE.MathUtils.clamp(rawT, 0, 1);

  const sunDir = new THREE.Vector3().lerpVectors(a.sunDir, b.sunDir, t);
  // Keep celestial key gracefully arched above the horizon mid-sweep
  sunDir.y = Math.max(0.28, sunDir.y + Math.sin(t * Math.PI) * 0.16);
  sunDir.normalize();

  const fillDir = new THREE.Vector3().lerpVectors(a.fillDir, b.fillDir, t).normalize();

  return {
    sunDir,
    fillDir,
    sunTint: a.sunTint.clone().lerp(b.sunTint, t),
    sunMult: THREE.MathUtils.lerp(a.sunMult, b.sunMult, t),
    fillTint: a.fillTint.clone().lerp(b.fillTint, t),
    fillMult: THREE.MathUtils.lerp(a.fillMult, b.fillMult, t),
    hemiSkyTint: a.hemiSkyTint.clone().lerp(b.hemiSkyTint, t),
    hemiGroundTint: a.hemiGroundTint.clone().lerp(b.hemiGroundTint, t),
    hemiMult: THREE.MathUtils.lerp(a.hemiMult, b.hemiMult, t),
    ambientMult: THREE.MathUtils.lerp(a.ambientMult, b.ambientMult, t),
    moonLightOverride: THREE.MathUtils.lerp(a.moonLightOverride, b.moonLightOverride, t),
    skyOverride: THREE.MathUtils.lerp(a.skyOverride, b.skyOverride, t),
    backdropMix: THREE.MathUtils.lerp(a.backdropMix, b.backdropMix, t),
    skyTop: a.skyTop.clone().lerp(b.skyTop, t),
    skyMid: a.skyMid.clone().lerp(b.skyMid, t),
    skyBottom: a.skyBottom.clone().lerp(b.skyBottom, t),
    haloColor: a.haloColor.clone().lerp(b.haloColor, t),
    haloStrength: THREE.MathUtils.lerp(a.haloStrength, b.haloStrength, t),
    moonMix: THREE.MathUtils.lerp(a.moonMix, b.moonMix, t),
    moonPos: a.moonPos.clone().lerp(b.moonPos, t),
    sunOrbMix: THREE.MathUtils.lerp(a.sunOrbMix, b.sunOrbMix, t),
    sunPos: a.sunPos.clone().lerp(b.sunPos, t),
    starStrength: THREE.MathUtils.lerp(a.starStrength, b.starStrength, t),
    envMult: THREE.MathUtils.lerp(a.envMult, b.envMult, t),
    aoColor: a.aoColor.clone().lerp(b.aoColor, t),
    aoIntensity: THREE.MathUtils.lerp(a.aoIntensity, b.aoIntensity, t),
    bloomThreshold: THREE.MathUtils.lerp(a.bloomThreshold, b.bloomThreshold, t),
    bloomIntensity: THREE.MathUtils.lerp(a.bloomIntensity, b.bloomIntensity, t),
    interiorTarget: THREE.MathUtils.lerp(a.interiorTarget, b.interiorTarget, t),
    bollardMult: THREE.MathUtils.lerp(a.bollardMult, b.bollardMult, t),
    bollardBulbMult: THREE.MathUtils.lerp(a.bollardBulbMult, b.bollardBulbMult, t),
    patioCandleWeight: THREE.MathUtils.lerp(a.patioCandleWeight, b.patioCandleWeight, t),
    snowEmissiveScale: THREE.MathUtils.lerp(a.snowEmissiveScale, b.snowEmissiveScale, t),
    fireflyWeight: THREE.MathUtils.lerp(a.fireflyWeight, b.fireflyWeight, t),
    particleLightFactor: THREE.MathUtils.lerp(a.particleLightFactor, b.particleLightFactor, t),
  };
}

/**
 * Evaluates normalized time progression `u in [0, 1]` along Day -> Golden -> Night.
 */
export function sampleTimeState(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  if (p <= TIME_PROGRESS.golden) {
    return lerpPresetSegment(TIME_PRESETS.day, TIME_PRESETS.golden, p / TIME_PROGRESS.golden);
  }
  return lerpPresetSegment(
    TIME_PRESETS.golden,
    TIME_PRESETS.night,
    (p - TIME_PROGRESS.golden) / (1 - TIME_PROGRESS.golden)
  );
}
