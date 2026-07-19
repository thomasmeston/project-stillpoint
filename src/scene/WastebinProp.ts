import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { publicUrl } from '../utils/publicUrl';

const BIN_URL = 'models/props/trashcan-small.glb';
const TYPEWRITER_URL = 'models/props/typewriter.glb';

/**
 * Quaternius "Trashcan Small" (CC0).
 * https://poly.pizza/m/i7HDuYDLkx
 */
export function loadWastebin(onReady: (group: THREE.Group) => void): void {
  const loader = new GLTFLoader();
  loader.load(
    publicUrl(BIN_URL),
    (gltf) => {
      const group = new THREE.Group();
      group.name = 'Wastebin';
      group.add(normalizeToGround(gltf.scene, 0.34));
      group.add(buildCrumpledPaperFill());
      onReady(group);
    },
    undefined,
    () => onReady(buildFallbackWastebin()),
  );
}

/**
 * Classic typewriter (Bruno Oliveira, CC-BY 3.0).
 * https://poly.pizza/m/4jHNmeamwP8
 */
export function loadTypewriter(
  onReady: (group: THREE.Group) => void,
  name = 'Typewriter',
): void {
  const loader = new GLTFLoader();
  loader.load(
    publicUrl(TYPEWRITER_URL),
    (gltf) => {
      const group = new THREE.Group();
      group.name = name;
      // Scale by footprint so it reads as a full desk machine (~42cm wide).
      group.add(normalizeToFootprint(gltf.scene, 0.42));
      onReady(group);
    },
    undefined,
    () => {
      const fallback = buildFallbackTypewriter();
      fallback.name = name;
      onReady(fallback);
    },
  );
}

function enableShadows(root: THREE.Object3D): void {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function normalizeToGround(model: THREE.Object3D, targetHeight: number): THREE.Object3D {
  enableShadows(model);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = targetHeight / (size.y || 1);
  model.scale.setScalar(scale);

  const scaled = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaled.getCenter(center);
  model.position.set(-center.x, -scaled.min.y, -center.z);
  return model;
}

/** Scale so the longest XZ span matches targetWidth, then sit on y=0. */
function normalizeToFootprint(model: THREE.Object3D, targetWidth: number): THREE.Object3D {
  enableShadows(model);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const footprint = Math.max(size.x, size.z) || 1;
  model.scale.setScalar(targetWidth / footprint);

  const scaled = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaled.getCenter(center);
  model.position.set(-center.x, -scaled.min.y, -center.z);
  return model;
}

/** Deterministic 0–1 noise from an integer seed. */
function paperRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeCrumpledBall(radius: number, seed: number, color: string): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = paperRand(seed * 17 + i * 3);
    const m = paperRand(seed * 31 + i * 5);
    v.multiplyScalar(0.72 + n * 0.38);
    v.x += (m - 0.5) * radius * 0.18;
    v.y += (paperRand(seed + i * 7) - 0.5) * radius * 0.18;
    v.z += (paperRand(seed + i * 11) - 0.5) * radius * 0.18;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Heap of crumpled paper balls filling a ~0.34m wastebin. */
function buildCrumpledPaperFill(): THREE.Group {
  const fill = new THREE.Group();
  fill.name = 'WastebinPaper';

  const colors = ['#f2ebe0', '#e8e0d0', '#d9d0c0', '#efe6d6', '#cfc6b4', '#e4dcc8'];

  // Packed placements: [x, y, z, radius, seed]
  const balls: Array<[number, number, number, number, number]> = [
    [0.0, 0.07, 0.0, 0.055, 1],
    [0.045, 0.09, 0.02, 0.048, 2],
    [-0.04, 0.085, -0.025, 0.05, 3],
    [0.02, 0.1, -0.045, 0.046, 4],
    [-0.03, 0.11, 0.04, 0.044, 5],
    [0.05, 0.14, -0.01, 0.042, 6],
    [-0.05, 0.15, 0.01, 0.043, 7],
    [0.01, 0.16, 0.04, 0.04, 8],
    [0.035, 0.18, 0.03, 0.038, 9],
    [-0.02, 0.19, -0.035, 0.041, 10],
    [0.0, 0.22, 0.0, 0.05, 11],
    [0.04, 0.24, -0.02, 0.037, 12],
    [-0.035, 0.25, 0.025, 0.039, 13],
    [0.015, 0.27, 0.035, 0.036, 14],
    [-0.01, 0.29, -0.02, 0.04, 15],
    [0.03, 0.31, 0.01, 0.035, 16],
    [-0.025, 0.32, -0.015, 0.034, 17],
    [0.005, 0.34, 0.02, 0.038, 18],
    [0.02, 0.36, -0.025, 0.033, 19],
    [-0.015, 0.37, 0.015, 0.032, 20],
  ];

  for (let i = 0; i < balls.length; i++) {
    const [x, y, z, r, seed] = balls[i];
    const ball = makeCrumpledBall(r, seed, colors[i % colors.length]);
    ball.position.set(x, y, z);
    ball.rotation.set(
      paperRand(seed) * Math.PI,
      paperRand(seed + 1) * Math.PI,
      paperRand(seed + 2) * Math.PI,
    );
    fill.add(ball);
  }

  return fill;
}

export function buildFallbackWastebin(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Wastebin';

  const binMat = new THREE.MeshStandardMaterial({
    color: '#4a5560',
    roughness: 0.75,
    metalness: 0.2,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#6a7580',
    roughness: 0.55,
    metalness: 0.35,
  });

  const bin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.1, 0.32, 16, 1, true),
    binMat,
  );
  bin.position.y = 0.16;
  bin.castShadow = true;
  bin.receiveShadow = true;
  group.add(bin);

  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), binMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.01;
  bottom.receiveShadow = true;
  group.add(bottom);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 20), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.32;
  rim.castShadow = true;
  group.add(rim);

  group.add(buildCrumpledPaperFill());
  return group;
}

export function buildFallbackTypewriter(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Typewriter';

  const metal = new THREE.MeshStandardMaterial({
    color: '#3a3a42',
    roughness: 0.45,
    metalness: 0.65,
  });
  const keys = new THREE.MeshStandardMaterial({
    color: '#1a1a1e',
    roughness: 0.7,
    metalness: 0.15,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.28), metal);
  body.position.y = 0.07;
  body.castShadow = true;
  group.add(body);

  const platen = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 12), metal);
  platen.rotation.z = Math.PI / 2;
  platen.position.set(0, 0.16, -0.05);
  platen.castShadow = true;
  group.add(platen);

  const keyDeck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.12), keys);
  keyDeck.position.set(0, 0.1, 0.07);
  keyDeck.castShadow = true;
  group.add(keyDeck);

  return group;
}
