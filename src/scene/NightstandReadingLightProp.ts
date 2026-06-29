import * as THREE from 'three';

/** Compact clip-style reading lamp for the bedroom nightstand top. */
export function buildNightstandReadingLight(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'NightstandReadingLight';

  const metalMat = new THREE.MeshStandardMaterial({
    color: '#3d3d45',
    roughness: 0.5,
    metalness: 0.5,
  });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.018, 14),
    metalMat,
  );
  base.position.y = 0.009;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.007, 0.07, 8),
    metalMat,
  );
  arm.position.set(0, 0.05, 0.012);
  arm.rotation.x = -0.55;
  arm.castShadow = true;
  group.add(arm);

  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.03, 0.028, 12, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#2a2520',
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
  );
  shade.position.set(0, 0.1, 0.028);
  shade.rotation.x = -0.35;
  shade.castShadow = true;
  group.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 10, 10),
    new THREE.MeshStandardMaterial({
      color: '#fff6dd',
      emissive: '#ffcc70',
      emissiveIntensity: 1.1,
      roughness: 0.3,
      metalness: 0.02,
    }),
  );
  bulb.position.set(0, 0.095, 0.03);
  bulb.name = 'NightstandReadingLightBulb';
  group.add(bulb);

  return group;
}
