import * as THREE from 'three';

export type HotspotData = {
  id: string;
  label?: string;
  position: [number, number, number];
  size: [number, number, number];
};

export class Hotspot {
  readonly mesh: THREE.Mesh;
  readonly id: string;

  constructor(data: HotspotData) {
    this.id = data.id;
    const geometry = new THREE.BoxGeometry(data.size[0], data.size[1], data.size[2]);
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      transparent: true,
      opacity: 0,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(data.position[0], data.position[1], data.position[2]);
    this.mesh.userData.hotspotId = data.id;
    this.mesh.userData.puzzleHidden = false;
    this.mesh.layers.set(1);
  }

  setVisibleDebug(enabled: boolean): void {
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.visible = enabled;
    mat.opacity = enabled ? 0.25 : 0;
    mat.color.setHex(0xffcc66);
  }

  setSize(size: [number, number, number]): void {
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  }
}
