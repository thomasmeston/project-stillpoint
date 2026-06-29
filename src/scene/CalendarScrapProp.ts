import * as THREE from 'three';

/** Torn calendar page scrap — March 17 circled, for the bed pickup clue. */
export function buildCalendarScrap(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CalendarScrap';

  const paperMat = new THREE.MeshStandardMaterial({
    color: '#e8dcc8',
    roughness: 0.92,
    metalness: 0.02,
  });

  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.003, 0.12),
    paperMat,
  );
  sheet.position.y = 0.0015;
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  group.add(sheet);

  const tear = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.0032, 0.034),
    paperMat,
  );
  tear.position.set(0.072, 0.0016, -0.038);
  tear.rotation.y = 0.35;
  tear.castShadow = true;
  group.add(tear);

  const gridMat = new THREE.MeshStandardMaterial({
    color: '#c8baa8',
    roughness: 0.95,
    metalness: 0,
  });

  for (let row = 0; row < 4; row++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.0004, 0.001),
      gridMat,
    );
    line.position.set(0, 0.003, -0.035 + row * 0.022);
    group.add(line);
  }

  for (let col = 0; col < 5; col++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.001, 0.0004, 0.075),
      gridMat,
    );
    line.position.set(-0.045 + col * 0.022, 0.003, 0);
    group.add(line);
  }

  const circleMat = new THREE.MeshStandardMaterial({
    color: '#b84040',
    roughness: 0.88,
    metalness: 0,
  });
  const circled = new THREE.Mesh(
    new THREE.TorusGeometry(0.011, 0.0012, 6, 16),
    circleMat,
  );
  circled.rotation.x = Math.PI / 2;
  circled.position.set(0.022, 0.0035, -0.012);
  group.add(circled);

  const marginMat = new THREE.MeshStandardMaterial({
    color: '#4a4038',
    roughness: 0.9,
    metalness: 0,
  });
  const scribble = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.0005, 0.003),
    marginMat,
  );
  scribble.position.set(0.05, 0.0035, 0.028);
  group.add(scribble);

  return group;
}
