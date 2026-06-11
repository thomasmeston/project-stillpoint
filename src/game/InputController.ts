import * as THREE from 'three';

export class InputController {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private camera: THREE.Camera;
  private floorTargets: THREE.Object3D[];
  private hotspotTargets: THREE.Object3D[];
  private firstInput = false;

  isHotspotInteractable: ((mesh: THREE.Object3D) => boolean) | null = null;

  onFirstInput?: () => void;
  onMove?: (point: THREE.Vector3) => void;
  onHotspot?: (id: string) => void;
  onHover?: (id: string | null, hint: string) => void;

  constructor(
    camera: THREE.Camera,
    floorTargets: THREE.Object3D[],
    hotspotTargets: THREE.Object3D[],
  ) {
    this.camera = camera;
    this.floorTargets = floorTargets;
    this.hotspotTargets = hotspotTargets;
  }

  handleClick(clientX: number, clientY: number): void {
    if (!this.firstInput) {
      this.firstInput = true;
      this.onFirstInput?.();
    }
    this.updateMouse(clientX, clientY);
    const hotspot = this.intersectHotspot();
    if (hotspot) {
      this.onHotspot?.(hotspot);
      return;
    }
    const floor = this.intersectFloor();
    if (floor) this.onMove?.(floor);
  }

  handleMove(clientX: number, clientY: number, hintFn: (id: string | null) => string): void {
    this.updateMouse(clientX, clientY);
    const hotspot = this.intersectHotspot();
    if (hotspot) {
      this.onHover?.(hotspot, hintFn(hotspot));
    } else {
      this.onHover?.(null, 'Walk');
    }
  }

  private updateMouse(clientX: number, clientY: number): void {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  private intersectHotspot(): string | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.raycaster.layers.set(1);
    const hits = this.raycaster.intersectObjects(this.hotspotTargets, false);
    for (const hit of hits) {
      if (hit.object.userData.puzzleHidden) continue;
      if (this.isHotspotInteractable && !this.isHotspotInteractable(hit.object)) continue;
      return (hit.object.userData.hotspotId as string) ?? null;
    }
    return null;
  }

  private intersectFloor(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.raycaster.layers.set(0);
    const hits = this.raycaster.intersectObjects(this.floorTargets, false);
    if (hits.length === 0) return null;
    return hits[0].point.clone();
  }
}
