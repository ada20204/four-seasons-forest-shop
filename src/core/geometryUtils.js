import * as THREE from 'three';

/**
 * Merges a shared base BufferGeometry transformed by an array of Matrix4 matrices
 * into one unified static BufferGeometry, eliminating dozens of draw calls per flora clump.
 */
export function mergeTransformedGeometry(baseGeo, matrices) {
  const src = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo;
  const posAttr = src.attributes.position;
  const normAttr = src.attributes.normal;
  const uvAttr = src.attributes.uv;
  const vCount = posAttr.count;
  const totalVerts = vCount * matrices.length;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = uvAttr ? new Float32Array(totalVerts * 2) : null;

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();

  matrices.forEach((mat, mIdx) => {
    normalMat.getNormalMatrix(mat);
    const baseVert = mIdx * vCount;

    for (let i = 0; i < vCount; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mat);
      positions[(baseVert + i) * 3] = v.x;
      positions[(baseVert + i) * 3 + 1] = v.y;
      positions[(baseVert + i) * 3 + 2] = v.z;

      if (normAttr) {
        n.fromBufferAttribute(normAttr, i).applyMatrix3(normalMat).normalize();
        normals[(baseVert + i) * 3] = n.x;
        normals[(baseVert + i) * 3 + 1] = n.y;
        normals[(baseVert + i) * 3 + 2] = n.z;
      }

      if (uvs && uvAttr) {
        uvs[(baseVert + i) * 2] = uvAttr.getX(i);
        uvs[(baseVert + i) * 2 + 1] = uvAttr.getY(i);
      }
    }
  });

  if (src !== baseGeo) src.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (normAttr) merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return merged;
}
