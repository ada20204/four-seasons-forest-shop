import * as THREE from 'three';

/**
 * Lighting & camera angle presets anchored visually to 基准图.png and multi-angle concepts.
 */
export const LIGHTING_BASELINE = {
  // Key sunlight from upper-front-right so front overhanging white volume casts diagonal shadow onto recessed left white wall
  sunDir: new THREE.Vector3(0.62, 0.74, 0.48).normalize(),
  sunColor: new THREE.Color('#fff2dc'),
  sunIntensity: 2.78,
  // Soft bounce fill from opposite upper-left
  fillDir: new THREE.Vector3(-0.70, 0.52, 0.35).normalize(),
  fillColor: new THREE.Color('#dfeafa'),
  fillIntensity: 0.62,
  // Studio sky/ground hemisphere
  hemiSkyColor: new THREE.Color('#f4f7ff'),
  hemiGroundColor: new THREE.Color('#96836e'),
  hemiIntensity: 0.92,
  ambientColor: new THREE.Color('#f6efe5'),
  ambientIntensity: 0.34,
  // Linear HDR studio cyclorama colors calibrated below bloomThreshold (3.15) so AgX maps to luminous warm cream ivory
  backdropTop: new THREE.Color().setRGB(2.35, 2.15, 1.88),
  backdropMid: new THREE.Color().setRGB(2.25, 2.02, 1.72),
  backdropBottom: new THREE.Color().setRGB(1.95, 1.68, 1.38),
  haloColor: new THREE.Color().setRGB(2.88, 2.74, 2.52),
  haloStrength: 0.56,
  aoColor: new THREE.Color('#2c241d'),
  bloomIntensity: 0.28,
  bloomThreshold: 3.15,
  envIntensity: 0.42,
};

export const CAMERA_VIEWS = {
  overview: {
    label: '默认三分之四',
    pos: new THREE.Vector3(2.3, 8.2, 26.2),
    target: new THREE.Vector3(-0.25, 3.85, -0.25),
  },
  leftFront: {
    label: '左前方',
    pos: new THREE.Vector3(-11.0, 7.2, 23.2),
    target: new THREE.Vector3(-0.35, 3.85, -0.25),
  },
  rightFront: {
    label: '右前方',
    pos: new THREE.Vector3(14.4, 7.2, 20.6),
    target: new THREE.Vector3(0.25, 3.85, -0.25),
  },
  highSide: {
    label: '高位侧面',
    pos: new THREE.Vector3(15.8, 14.2, 16.5),
    target: new THREE.Vector3(0.25, 3.55, -0.25),
  },
  rear: {
    label: '背面',
    pos: new THREE.Vector3(-5.2, 9.8, -24.2),
    target: new THREE.Vector3(0.0, 3.85, -0.50),
  },
  interior: {
    label: '橱窗近景',
    pos: new THREE.Vector3(1.05, 2.40, 9.25),
    target: new THREE.Vector3(0.52, 2.28, -0.50),
  },
};
