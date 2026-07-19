import * as THREE from 'three';

/** US-style duplex wall outlet plate (local: plate in XY, faces +Z into room). */
export function buildWallOutlet(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WallOutlet';

  const plateMat = new THREE.MeshStandardMaterial({
    color: '#e8e4dc',
    roughness: 0.88,
    metalness: 0.05,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#2a2a30',
    roughness: 0.7,
    metalness: 0.15,
  });
  const screwMat = new THREE.MeshStandardMaterial({
    color: '#8a8a92',
    roughness: 0.45,
    metalness: 0.55,
  });

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.16, 0.012),
    plateMat,
  );
  plate.position.z = 0.006;
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  const addSocket = (y: number) => {
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.055, 0.01),
      darkMat,
    );
    recess.position.set(0, y, 0.012);
    group.add(recess);

    const slotW = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.006), darkMat);
    slotW.position.set(-0.012, y, 0.016);
    group.add(slotW);
    const slotN = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.006), darkMat);
    slotN.position.set(0.012, y, 0.016);
    group.add(slotN);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), darkMat);
    ground.position.set(0, y - 0.018, 0.016);
    group.add(ground);
  };

  addSocket(0.032);
  addSocket(-0.032);

  const screwTop = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 8), screwMat);
  screwTop.rotation.x = Math.PI / 2;
  screwTop.position.set(0, 0.068, 0.013);
  group.add(screwTop);
  const screwBot = screwTop.clone();
  screwBot.position.y = -0.068;
  group.add(screwBot);

  return group;
}
