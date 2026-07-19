import * as THREE from 'three';

function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Wound red yarn ball sitting on the floor. */
export function buildRedYarnBall(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RedYarnBall';

  const yarnMat = new THREE.MeshStandardMaterial({
    color: '#c4282a',
    roughness: 0.92,
    metalness: 0.02,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: '#9e1c22',
    roughness: 0.95,
    metalness: 0.0,
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), coreMat);
  core.position.y = 0.055;
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  // Wrapped strands (torus bands at varied angles).
  for (let i = 0; i < 14; i++) {
    const r = 0.042 + rand(i * 3) * 0.018;
    const tube = 0.006 + rand(i * 5) * 0.004;
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 20), yarnMat);
    band.position.y = 0.055;
    band.rotation.set(
      rand(i * 7) * Math.PI,
      rand(i * 11) * Math.PI,
      rand(i * 13) * Math.PI,
    );
    band.castShadow = true;
    group.add(band);
  }

  // Loose tail.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 0.04, 0.02),
    new THREE.Vector3(0.1, 0.01, 0.05),
    new THREE.Vector3(0.14, 0.008, 0.09),
  ]);
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 8, 0.004, 5, false),
    yarnMat,
  );
  tail.castShadow = true;
  group.add(tail);

  return group;
}

type ClutterKind =
  | 'button'
  | 'coin'
  | 'eraser'
  | 'die'
  | 'cork'
  | 'pebble'
  | 'bottle_cap'
  | 'paperclip'
  | 'matchbox'
  | 'spool';

const KINDS: ClutterKind[] = [
  'button',
  'coin',
  'eraser',
  'die',
  'cork',
  'pebble',
  'bottle_cap',
  'paperclip',
  'matchbox',
  'spool',
];

function makeClutterPiece(kind: ClutterKind, seed: number): THREE.Object3D {
  switch (kind) {
    case 'button': {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: ['#3a5a8a', '#8a3a4a', '#2a6a4a'][seed % 3],
        roughness: 0.55,
        metalness: 0.15,
      });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 14), mat);
      disc.position.y = 0.003;
      g.add(disc);
      return g;
    }
    case 'coin': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#c9a45a',
        roughness: 0.35,
        metalness: 0.75,
      });
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.0025, 16), mat);
      coin.position.y = 0.0015;
      return coin;
    }
    case 'eraser': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#e07070',
        roughness: 0.9,
        metalness: 0.0,
      });
      const eraser = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.018), mat);
      eraser.position.y = 0.006;
      return eraser;
    }
    case 'die': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#f2f0ea',
        roughness: 0.7,
        metalness: 0.05,
      });
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), mat);
      die.position.y = 0.011;
      return die;
    }
    case 'cork': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#c4a06a',
        roughness: 0.95,
        metalness: 0.0,
      });
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.03, 10), mat);
      cork.rotation.z = Math.PI / 2;
      cork.position.y = 0.012;
      return cork;
    }
    case 'pebble': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#7a7872',
        roughness: 0.98,
        metalness: 0.0,
      });
      const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), mat);
      pebble.scale.set(1.2, 0.55, 1.0);
      pebble.position.y = 0.008;
      return pebble;
    }
    case 'bottle_cap': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#4a7a9a',
        roughness: 0.45,
        metalness: 0.55,
      });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 14), mat);
      cap.position.y = 0.004;
      return cap;
    }
    case 'paperclip': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#b0b4b8',
        roughness: 0.35,
        metalness: 0.8,
      });
      const clip = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0022, 6, 16, Math.PI * 1.6), mat);
      clip.rotation.x = Math.PI / 2;
      clip.position.y = 0.002;
      return clip;
    }
    case 'matchbox': {
      const mat = new THREE.MeshStandardMaterial({
        color: '#8a4030',
        roughness: 0.85,
        metalness: 0.05,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.014, 0.028), mat);
      box.position.y = 0.007;
      return box;
    }
    case 'spool': {
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({
        color: '#d8c8a8',
        roughness: 0.8,
        metalness: 0.05,
      });
      const thread = new THREE.MeshStandardMaterial({
        color: '#5a6a8a',
        roughness: 0.9,
        metalness: 0.02,
      });
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.028, 10), wood);
      axle.rotation.z = Math.PI / 2;
      axle.position.y = 0.014;
      g.add(axle);
      const wind = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), thread);
      wind.rotation.z = Math.PI / 2;
      wind.position.y = 0.014;
      g.add(wind);
      return g;
    }
  }
}

/** Small scattered junk pile (~10 pieces) under the cork board. */
export function buildCorkBoardClutterPile(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CorkBoardClutter';

  for (let i = 0; i < KINDS.length; i++) {
    const piece = makeClutterPiece(KINDS[i], i + 1);
    piece.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const angle = rand(i * 17) * Math.PI * 2;
    const radius = 0.04 + rand(i * 19) * 0.14;
    piece.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    piece.rotation.y = rand(i * 23) * Math.PI * 2;
    if (KINDS[i] === 'die' || KINDS[i] === 'eraser') {
      piece.rotation.x = (rand(i * 29) - 0.5) * 0.4;
      piece.rotation.z = (rand(i * 31) - 0.5) * 0.4;
    }
    group.add(piece);
  }

  return group;
}
