import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ARMY_MAN_GLB = './models/props/army-man.glb';
/** Match procedural cork-board pin height (~0.09 units). */
const ARMY_MAN_TARGET_HEIGHT = 0.09;

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCorkTexture(): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#b8926a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1 + Math.random() * 2.5;
      ctx.fillStyle = `rgba(${90 + Math.random() * 40}, ${60 + Math.random() * 30}, ${35 + Math.random() * 25}, ${0.12 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(70, 45, 25, 0.08)';
    for (let i = 0; i < 120; i += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.lineTo(Math.random() * w, Math.random() * h);
      ctx.stroke();
    }
  }, 256, 192);
}

function createNewspaperTexture(): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#e8e2d4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a2a2a';
    ctx.font = 'bold 14px serif';
    ctx.fillText('LOCAL', 8, 18);
    ctx.font = '10px serif';
    for (let y = 28; y < h - 8; y += 11) {
      const width = 0.55 + Math.random() * 0.4;
      ctx.fillRect(8, y, (w - 16) * width, 4);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }, 128, 96);
}

function createGumWrapperTexture(): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#e8ecef');
    grad.addColorStop(0.5, '#f5f7fa');
    grad.addColorStop(1, '#c5d0db');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120, 130, 140, 0.35)';
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(4 + i * 5, 0);
      ctx.lineTo(8 + i * 5, h);
      ctx.stroke();
    }
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(w * 0.35, h * 0.38, w * 0.3, h * 0.22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('mint', w * 0.42, h * 0.52);
  }, 96, 64);
}

export function buildCorkBoardFrame(boardW: number, boardH: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CorkBoardFrame';

  const frameMat = new THREE.MeshStandardMaterial({ color: '#6a4f32', roughness: 0.88, metalness: 0.05 });
  const frameDepth = 0.045;
  const frameBorder = 0.06;

  const top = new THREE.Mesh(new THREE.BoxGeometry(boardW + frameBorder * 2, frameBorder, frameDepth), frameMat);
  top.position.y = boardH / 2 + frameBorder / 2;
  group.add(top);

  const bottom = top.clone();
  bottom.position.y = -boardH / 2 - frameBorder / 2;
  group.add(bottom);

  const left = new THREE.Mesh(new THREE.BoxGeometry(frameBorder, boardH, frameDepth), frameMat);
  left.position.x = -boardW / 2 - frameBorder / 2;
  group.add(left);

  const right = left.clone();
  right.position.x = boardW / 2 + frameBorder / 2;
  group.add(right);

  const corkMat = new THREE.MeshStandardMaterial({
    map: createCorkTexture(),
    roughness: 0.96,
    metalness: 0.0,
  });
  const cork = new THREE.Mesh(new THREE.BoxGeometry(boardW, boardH, frameDepth * 0.65), corkMat);
  cork.position.z = -frameDepth * 0.08;
  cork.castShadow = true;
  cork.receiveShadow = true;
  group.add(cork);

  return group;
}

export function buildPlasticStraw(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cork_straw';

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.22, 10),
    new THREE.MeshStandardMaterial({
      color: '#f0f4f8',
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
    }),
  );
  body.rotation.z = Math.PI / 2;
  group.add(body);

  const stripeMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
  for (const x of [-0.05, 0, 0.05]) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.018, 10), stripeMat);
    stripe.rotation.z = Math.PI / 2;
    stripe.position.x = x;
    group.add(stripe);
  }

  return group;
}

export function buildGumWrapper(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.09),
    new THREE.MeshStandardMaterial({
      map: createGumWrapperTexture(),
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = 'cork_gum_wrapper';
  mesh.castShadow = true;
  return mesh;
}

export function buildBlackButton(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cork_button';

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.008, 16),
    new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.65, metalness: 0.1 }),
  );
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  const holeMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.8 });
  for (const [x, y] of [[-0.012, -0.012], [0.012, -0.012], [-0.012, 0.012], [0.012, 0.012]] as const) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.01, 8), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(x, y, 0.002);
    group.add(hole);
  }

  return group;
}

export function buildNewspaperScrap(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.11),
    new THREE.MeshStandardMaterial({
      map: createNewspaperTexture(),
      roughness: 0.94,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = 'cork_newspaper';
  mesh.castShadow = true;
  return mesh;
}

export function createWordStripTexture(word: string): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#e8dfc8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(90, 75, 55, 0.35)';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.fillStyle = '#2a2438';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word.toLowerCase(), w / 2, h / 2 + 1);
  }, 128, 32);
}

export function buildIntroWordStrip(word: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.028),
    new THREE.MeshStandardMaterial({
      map: createWordStripTexture(word),
      roughness: 0.94,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = 'cork_intro_word_strip';
  mesh.castShadow = true;
  return mesh;
}

export function loadArmyManFigure(): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      ARMY_MAN_GLB,
      (gltf) => {
        const model = gltf.scene;
        const group = new THREE.Group();
        group.name = 'cork_army_man';

        model.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          child.castShadow = true;
          const mesh = child as THREE.Mesh;
          if (!mesh.material) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const updated = materials.map((mat) => {
            const src = mat as THREE.MeshStandardMaterial;
            if (src.isMeshStandardMaterial) {
              src.roughness = 0.78;
              src.metalness = 0.05;
              return src;
            }
            return new THREE.MeshStandardMaterial({
              color: src.color ?? new THREE.Color(0x3d6b3a),
              map: 'map' in src ? src.map : null,
              roughness: 0.78,
              metalness: 0.05,
            });
          });
          mesh.material = updated.length === 1 ? updated[0] : updated;
        });

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        model.scale.setScalar(ARMY_MAN_TARGET_HEIGHT / (size.y || 1));

        const grounded = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        grounded.getCenter(center);
        model.position.set(-center.x, -grounded.min.y, -center.z);

        group.add(model);
        resolve(group);
      },
      undefined,
      reject,
    );
  });
}
