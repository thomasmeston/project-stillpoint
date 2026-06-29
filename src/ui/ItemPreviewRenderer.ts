import * as THREE from 'three';
import { buildItemMesh } from './ItemMeshFactory';

const previewCache = new Map<string, string>();

/** Renders inventory item meshes to data URLs for HUD thumbnails. */
export class ItemPreviewRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 10);
  private light: THREE.DirectionalLight;
  private fill: THREE.AmbientLight;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.light = new THREE.DirectionalLight(0xfff4e0, 1.4);
    this.light.position.set(1.2, 2, 1.5);
    this.scene.add(this.light);
    this.fill = new THREE.AmbientLight(0x404860, 0.65);
    this.scene.add(this.fill);
  }

  getPreviewDataUrl(itemId: string, pixelSize: number): string {
    const key = `${itemId}:${pixelSize}`;
    const cached = previewCache.get(key);
    if (cached) return cached;

    const url = this.render(itemId, pixelSize);
    previewCache.set(key, url);
    return url;
  }

  clearCache(): void {
    previewCache.clear();
  }

  private render(itemId: string, pixelSize: number): string {
    while (this.scene.children.length > 2) {
      this.scene.remove(this.scene.children[2]);
    }

    const mesh = buildItemMesh(itemId);
    this.scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.01);

    mesh.position.sub(center);

    const dist = maxDim * 2.4;
    this.camera.position.set(dist * 0.6, dist * 0.85, dist * 0.9);
    this.camera.lookAt(0, 0, 0);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(pixelSize, pixelSize, false);
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

let sharedPreview: ItemPreviewRenderer | null = null;

export function getItemPreviewRenderer(): ItemPreviewRenderer {
  if (!sharedPreview) sharedPreview = new ItemPreviewRenderer();
  return sharedPreview;
}
