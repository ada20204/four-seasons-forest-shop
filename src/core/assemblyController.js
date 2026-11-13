import * as THREE from 'three';

function createRng(seed = 424242) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c1 = 1.18;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Layered miniature diorama assembly entrance controller:
 * Layer 0: Island base, stepping stones & boulders
 * Layer 1: 1F stone/cedar/glass boutique & interior
 * Layer 2: 2F staggered white stucco volumes & planter trough
 * Layer 3: Botanical trees, conifers, shrubs, patio & winter snow pillows
 */
export class AssemblyController {
  constructor() {
    this.pieces = [];
    this.rand = createRng(918273);
    this.total = 0;
    this.elapsed = 0;
    this.active = false;
    this.completed = false;
    this.onStateChange = null;
  }

  add(obj, layer = 0, { liftY = 0.85, driftXZ = 0.25, tiltAmp = 0.14, duration = 0.56 } = {}) {
    if (!obj) return obj;
    const r = this.rand;
    this.pieces.push({
      obj,
      layer,
      restPos: obj.position.clone(),
      restQuat: obj.quaternion.clone(),
      restScale: obj.scale.clone(),
      offset: new THREE.Vector3((r() - 0.5) * driftXZ, liftY + r() * 0.45, (r() - 0.5) * driftXZ),
      tilt: new THREE.Euler((r() - 0.5) * tiltAmp, (r() - 0.5) * tiltAmp * 1.4, (r() - 0.5) * tiltAmp),
      dur: duration + r() * 0.14,
      delay: 0,
    });
    return obj;
  }

  finalize({ layerGap = 0.44, stagger = 0.022 } = {}) {
    const groups = new Map();
    for (const p of this.pieces) {
      if (!groups.has(p.layer)) groups.set(p.layer, []);
      groups.get(p.layer).push(p);
    }
    const layers = [...groups.keys()].sort((a, b) => a - b);
    let t = 0.08;
    layers.forEach((layer) => {
      const list = groups.get(layer).sort((a, b) => a.restPos.y - b.restPos.y);
      list.forEach((p, i) => {
        p.delay = t + i * stagger;
      });
      t += Math.min(0.45, list.length * stagger) + layerGap;
    });

    let maxEnd = 0;
    for (const p of this.pieces) {
      maxEnd = Math.max(maxEnd, p.delay + p.dur);
    }
    this.total = maxEnd + 0.08;
    return this.total;
  }

  play() {
    this.elapsed = 0;
    this.active = true;
    this.completed = false;
    this.update(0);
    if (this.onStateChange) this.onStateChange({ active: true, completed: false });
  }

  skip() {
    this.elapsed = this.total;
    this.active = false;
    this.completed = true;
    for (const p of this.pieces) {
      p.obj.visible = true;
      p.obj.position.copy(p.restPos);
      p.obj.quaternion.copy(p.restQuat);
      p.obj.scale.copy(p.restScale);
    }
    if (this.onStateChange) this.onStateChange({ active: false, completed: true });
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;

    for (const p of this.pieces) {
      const raw = (this.elapsed - p.delay) / p.dur;
      const t = Math.min(1, Math.max(0, raw));
      if (t <= 0) {
        p.obj.visible = false;
        continue;
      }
      p.obj.visible = true;
      const ep = easeOutCubic(t);
      const es = easeOutBack(Math.min(1, t * 1.03));

      p.obj.position.set(
        p.restPos.x + p.offset.x * (1 - ep),
        p.restPos.y + p.offset.y * (1 - ep),
        p.restPos.z + p.offset.z * (1 - ep)
      );
      p.obj.scale.set(
        p.restScale.x * Math.max(0.001, es),
        p.restScale.y * Math.max(0.001, es),
        p.restScale.z * Math.max(0.001, es)
      );
      const qTilt = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(p.tilt.x * (1 - ep), p.tilt.y * (1 - ep), p.tilt.z * (1 - ep))
      );
      p.obj.quaternion.copy(p.restQuat).multiply(qTilt);
    }

    if (this.elapsed >= this.total) {
      this.skip();
    }
  }
}
