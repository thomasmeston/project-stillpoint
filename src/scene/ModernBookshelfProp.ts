import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { publicUrl } from '../utils/publicUrl';

const SHELF_URL = 'models/props/bookcase-jeremy.glb';

const BOOK_COLORS = [
  '#3d4f6f',
  '#8a3a3a',
  '#2f5d45',
  '#6b4f2a',
  '#5a3d6e',
  '#2a5a6a',
  '#8a6a2a',
  '#4a4a52',
  '#7a3a55',
  '#3a6a5a',
  '#a05030',
  '#405060',
];

function enableShadows(root: THREE.Object3D): void {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Fill measured shelf bays with upright books.
 * Uses the wider horizontal axis as the row direction.
 */
function addBooksToShelf(shelf: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(shelf);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.x < 0.05 || size.y < 0.2 || size.z < 0.05) return;

  const booksRoot = new THREE.Group();
  booksRoot.name = 'BookshelfBooks';

  const alongX = size.x >= size.z;
  const rowLen = alongX ? size.x : size.z;
  const depthLen = alongX ? size.z : size.x;
  const shelves = 5;
  const sideMargin = rowLen * 0.08;
  const depthMargin = depthLen * 0.12;
  const usableRow = rowLen - sideMargin * 2;
  const usableDepth = depthLen - depthMargin * 2;
  const shelfSpanY = size.y * 0.82;
  const baseY = box.min.y + size.y * 0.06;

  for (let row = 0; row < shelves; row++) {
    const y = baseY + (shelfSpanY * (row + 0.1)) / shelves;
    let cursor = 0;
    let bookIndex = 0;
    while (cursor < usableRow - 0.015) {
      const thickness = 0.016 + rand(row * 40 + bookIndex * 3) * 0.024;
      const height = Math.min(
        0.1 + rand(row * 40 + bookIndex * 5) * 0.09,
        shelfSpanY / shelves * 0.85,
      );
      const depth = usableDepth * (0.6 + rand(row * 40 + bookIndex * 7) * 0.32);
      const color = BOOK_COLORS[(row * 3 + bookIndex) % BOOK_COLORS.length];
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(
          alongX ? thickness : depth,
          height,
          alongX ? depth : thickness,
        ),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.82,
          metalness: 0.05,
        }),
      );

      // Keep books toward the back of the bay so the open face reads clearly.
      if (alongX) {
        book.position.set(
          box.min.x + sideMargin + cursor + thickness / 2,
          y + height / 2,
          box.min.z + depthMargin + depth / 2 + (usableDepth - depth) * 0.05,
        );
      } else {
        book.position.set(
          box.min.x + depthMargin + depth / 2 + (usableDepth - depth) * 0.05,
          y + height / 2,
          box.min.z + sideMargin + cursor + thickness / 2,
        );
      }
      book.rotation.y = (rand(row * 40 + bookIndex * 11) - 0.5) * 0.06;
      book.castShadow = true;
      book.receiveShadow = true;
      booksRoot.add(book);
      cursor += thickness + 0.002;
      bookIndex += 1;
      if (bookIndex > 32) break;
    }
  }

  shelf.add(booksRoot);
}

/**
 * "Bookcase" by jeremy (CC-BY 3.0) with procedural books.
 * https://poly.pizza/m/fZAzX3YrGwd
 */
export function loadModernBookshelf(onReady: (group: THREE.Group) => void): void {
  const loader = new GLTFLoader();
  loader.load(
    publicUrl(SHELF_URL),
    (gltf) => {
      const group = new THREE.Group();
      group.name = 'ModernBookshelf';
      const model = gltf.scene;
      enableShadows(model);
      addBooksToShelf(model);
      group.add(model);
      onReady(group);
    },
    undefined,
    () => onReady(buildFallbackModernBookshelf()),
  );
}

function buildFallbackModernBookshelf(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ModernBookshelf';

  const frameMat = new THREE.MeshStandardMaterial({
    color: '#6a5238',
    roughness: 0.85,
    metalness: 0.05,
  });

  const w = 0.95;
  const h = 1.85;
  const d = 0.28;
  const thick = 0.04;

  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), frameMat);
  back.position.set(0, h / 2, -d / 2 + 0.01);
  group.add(back);

  for (const x of [-w / 2 + thick / 2, w / 2 - thick / 2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(thick, h, d), frameMat);
    side.position.set(x, h / 2, 0);
    group.add(side);
  }

  for (let i = 0; i < 5; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(w - thick * 2, 0.03, d - 0.02), frameMat);
    board.position.set(0, 0.08 + i * ((h - 0.16) / 4), 0);
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);
  }

  addBooksToShelf(group);
  enableShadows(group);
  return group;
}
