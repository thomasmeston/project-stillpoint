import * as THREE from 'three';

export function buildBedsideLamp(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BedsideLamp';

  const metalMat = new THREE.MeshStandardMaterial({
    color: '#3a3a42',
    roughness: 0.55,
    metalness: 0.45,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: '#2a2a30',
    roughness: 0.65,
    metalness: 0.35,
  });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20),
    metalMat,
  );
  base.position.y = 0.02;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, 1.55, 12),
    poleMat,
  );
  pole.position.y = 0.815;
  pole.castShadow = true;
  group.add(pole);

  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.038, 0.06, 12),
    metalMat,
  );
  socket.position.y = 1.62;
  socket.castShadow = true;
  group.add(socket);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 16),
    new THREE.MeshStandardMaterial({
      color: '#fff4d0',
      emissive: '#ffd080',
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.05,
    }),
  );
  bulb.position.y = 1.69;
  bulb.name = 'BedsideLampBulb';
  bulb.castShadow = true;
  group.add(bulb);

  const light = new THREE.PointLight('#ffd9a0', 0.9, 4.5);
  light.position.y = 1.69;
  light.name = 'BedsideLampLight';
  group.add(light);

  return group;
}
