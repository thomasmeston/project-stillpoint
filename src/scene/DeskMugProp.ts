import * as THREE from 'three';

export function buildDeskMug(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DeskMug';

  const mugMat = new THREE.MeshStandardMaterial({
    color: '#3d4a5c',
    roughness: 0.72,
    metalness: 0.08,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#e8e4dc',
    roughness: 0.55,
    metalness: 0.05,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.038, 0.075, 16),
    mugMat,
  );
  body.position.y = 0.0375;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.044, 0.004, 8, 20),
    rimMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.074;
  rim.castShadow = true;
  group.add(rim);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI),
    mugMat,
  );
  handle.rotation.y = Math.PI / 2;
  handle.position.set(0.048, 0.04, 0);
  handle.castShadow = true;
  group.add(handle);

  const pens: Array<{ color: string; h: number; x: number; z: number; tilt: number; rot: number }> = [
    { color: '#1a1a22', h: 0.11, x: -0.012, z: 0.008, tilt: 0.08, rot: 0.15 },
    { color: '#c0392b', h: 0.095, x: 0.01, z: -0.006, tilt: -0.06, rot: -0.2 },
    { color: '#f1c40f', h: 0.085, x: 0.018, z: 0.012, tilt: 0.12, rot: 0.35 },
    { color: '#2ecc71', h: 0.1, x: -0.018, z: -0.01, tilt: -0.1, rot: -0.4 },
    { color: '#3498db', h: 0.088, x: 0.004, z: 0.016, tilt: 0.04, rot: 0.05 },
  ];

  for (let i = 0; i < pens.length; i++) {
    const pen = pens[i];
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.0045, pen.h, 8),
      new THREE.MeshStandardMaterial({ color: pen.color, roughness: 0.65, metalness: 0.1 }),
    );
    shaft.position.set(pen.x, 0.075 + pen.h * 0.45, pen.z);
    shaft.rotation.z = pen.tilt;
    shaft.rotation.y = pen.rot;
    shaft.castShadow = true;
    group.add(shaft);

    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.004, 0.012, 8),
      new THREE.MeshStandardMaterial({
        color: pen.color === '#1a1a22' ? '#2a2a30' : '#d4a017',
        roughness: 0.5,
        metalness: pen.color === '#1a1a22' ? 0.35 : 0.15,
      }),
    );
    tip.position.set(
      pen.x,
      0.075 + pen.h * 0.92,
      pen.z,
    );
    tip.rotation.copy(shaft.rotation);
    tip.castShadow = true;
    group.add(tip);
  }

  return group;
}
