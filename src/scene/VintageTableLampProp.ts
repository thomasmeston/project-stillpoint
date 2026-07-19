import * as THREE from 'three';

/** Short brass table lamp with a warm fabric shade (~45cm tall). */
export function buildVintageTableLamp(name = 'VintageTableLamp'): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  const brass = new THREE.MeshStandardMaterial({
    color: '#8a7040',
    roughness: 0.4,
    metalness: 0.7,
  });
  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#c9b896',
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#fff0c8',
    emissive: '#ffd080',
    emissiveIntensity: 0.55,
    roughness: 0.5,
    metalness: 0.02,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.035, 20), brass);
  base.position.y = 0.018;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 8, 20), brass);
  footRing.rotation.x = Math.PI / 2;
  footRing.position.y = 0.01;
  group.add(footRing);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 12), brass);
  column.position.y = 0.145;
  column.castShadow = true;
  group.add(column);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.04, 12), brass);
  neck.position.y = 0.27;
  neck.castShadow = true;
  group.add(neck);

  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.14, 20, 1, true), shadeMat);
  shade.position.y = 0.36;
  shade.castShadow = true;
  group.add(shade);

  const shadeTop = new THREE.Mesh(new THREE.CircleGeometry(0.065, 20), shadeMat);
  shadeTop.rotation.x = -Math.PI / 2;
  shadeTop.position.y = 0.43;
  group.add(shadeTop);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), glowMat);
  bulb.position.y = 0.34;
  bulb.name = `${name}Bulb`;
  group.add(bulb);

  return group;
}
