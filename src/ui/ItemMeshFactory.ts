import * as THREE from 'three';
import { buildCalendarScrap } from '../scene/CalendarScrapProp';

/** Low-poly meshes matching in-world item shapes for inventory previews. */
export function buildItemMesh(itemId: string): THREE.Object3D {
  switch (itemId) {
    case 'calendar_scrap':
      return buildCalendarScrap();
    case 'photo_set':
      return buildPhotoSet();
    case 'receipt_stub':
      return buildReceiptStub();
    case 'key_blade':
      return buildKeyBlade();
    case 'key_handle':
      return buildKeyHandle();
    case 'assembled_key':
      return buildAssembledKey();
    case 'cipher_disk':
      return buildCipherDisk();
    case 'stillpoint_letter':
      return buildLetter();
    case 'phone':
      return buildPhone();
    default:
      return buildFallbackItem();
  }
}

function buildPhotoSet(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#d4c4a8', roughness: 0.9 });
  const backMat = new THREE.MeshStandardMaterial({ color: '#8a7a62', roughness: 0.92 });
  for (let i = 0; i < 4; i++) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.004, 0.07), i % 2 === 0 ? mat : backMat);
    card.position.set((i - 1.5) * 0.012, i * 0.003, 0);
    card.rotation.y = (i - 1.5) * 0.12;
    g.add(card);
  }
  return g;
}

function buildReceiptStub(): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.002, 0.05),
    new THREE.MeshStandardMaterial({ color: '#f0ebe0', roughness: 0.92 }),
  );
  g.add(paper);
  return g;
}

function buildKeyBlade(): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#b8924a', roughness: 0.45, metalness: 0.55 });
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12), metal);
  bow.rotation.x = Math.PI / 2;
  g.add(bow);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.004, 0.008), metal);
  shaft.position.set(0.028, 0, 0);
  g.add(shaft);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.014), metal);
  tooth.position.set(0.048, 0, 0.008);
  g.add(tooth);
  return g;
}

function buildKeyHandle(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#6a5040', roughness: 0.88 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.05, 10), wood);
  grip.position.y = 0.025;
  g.add(grip);
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), wood);
  stub.position.y = 0.056;
  g.add(stub);
  return g;
}

function buildAssembledKey(): THREE.Group {
  const g = new THREE.Group();
  g.add(buildKeyHandle());
  const blade = buildKeyBlade();
  blade.position.y = 0.06;
  blade.rotation.z = Math.PI / 2;
  g.add(blade);
  return g;
}

function buildCipherDisk(): THREE.Group {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.006, 24),
    new THREE.MeshStandardMaterial({ color: '#c8b898', roughness: 0.9 }),
  );
  g.add(disk);
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.008, 16),
    new THREE.MeshStandardMaterial({ color: '#3a3540', roughness: 0.85 }),
  );
  inner.position.y = 0.002;
  g.add(inner);
  return g;
}

function buildLetter(): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.003, 0.095),
    new THREE.MeshStandardMaterial({ color: '#ede4d0', roughness: 0.9 }),
  );
  g.add(paper);
  const fold = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.003, 0.03),
    new THREE.MeshStandardMaterial({ color: '#ddd0b8', roughness: 0.92 }),
  );
  fold.position.set(0, 0.002, -0.04);
  fold.rotation.x = -0.35;
  g.add(fold);
  return g;
}

function buildPhone(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.006, 0.065),
    new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.6, metalness: 0.2 }),
  );
  g.add(body);
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.001, 0.055),
    new THREE.MeshStandardMaterial({ color: '#2a3040', roughness: 0.3, metalness: 0.1 }),
  );
  screen.position.y = 0.0035;
  g.add(screen);
  return g;
}

function buildFallbackItem(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 0.04),
    new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.8 }),
  ));
  return g;
}
