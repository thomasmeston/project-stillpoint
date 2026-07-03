import * as THREE from 'three';

type DrawerPhase = 'closed' | 'opening' | 'open';

type DrawerAnchor = {
  center: THREE.Vector3;
  width: number;
  height: number;
};

/** Procedural drawer box that slides out of the Quaternius nightstand when unlocked. */
export class NightstandDrawerController {
  private slideGroup: THREE.Group | null = null;
  private closedPos = new THREE.Vector3();
  private openPos = new THREE.Vector3();
  private phase: DrawerPhase = 'closed';
  private animTime = 0;
  private pendingUnlock = false;
  private pendingAnimate = false;

  private readonly duration = 0.48;
  private readonly slideDistance = 0.1;

  attachToNightstand(
    nightstandGroup: THREE.Group,
    cabinetModel: THREE.Object3D,
    woodColor: THREE.Color,
  ): void {
    const anchor = this.measureDrawerAnchor(cabinetModel);
    this.hideGlbDrawerDetail(cabinetModel);

    const drawerW = anchor.width;
    const drawerH = anchor.height;
    const drawerInnerD = 0.095;
    const wall = 0.011;

    const woodFace = woodColor.clone().multiplyScalar(0.96);
    const woodSide = woodColor.clone().multiplyScalar(0.84);
    const woodInner = woodColor.clone().multiplyScalar(0.48);
    const matFace = new THREE.MeshStandardMaterial({ color: woodFace, roughness: 0.8, metalness: 0.05 });
    const matSide = new THREE.MeshStandardMaterial({ color: woodSide, roughness: 0.86, metalness: 0.04 });
    const matInner = new THREE.MeshStandardMaterial({ color: woodInner, roughness: 0.94, metalness: 0.02 });

    const recess = new THREE.Group();
    recess.name = 'NightstandDrawerRecess';
    recess.position.copy(anchor.center);
    nightstandGroup.add(recess);

    const cavity = new THREE.Mesh(
      new THREE.BoxGeometry(drawerW + wall, drawerH, drawerInnerD),
      matInner,
    );
    cavity.position.set(0, 0, -drawerInnerD * 0.5);
    cavity.receiveShadow = true;
    recess.add(cavity);

    const drawer = new THREE.Group();
    drawer.name = 'NightstandDrawerBox';

    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(drawerW - wall * 2, wall, drawerInnerD - wall),
      matSide,
    );
    bottom.position.set(0, -drawerH * 0.5 + wall * 0.6, -drawerInnerD * 0.5 + wall * 0.5);
    bottom.castShadow = true;
    drawer.add(bottom);

    const left = new THREE.Mesh(
      new THREE.BoxGeometry(wall, drawerH - wall, drawerInnerD - wall),
      matSide,
    );
    left.position.set(-drawerW * 0.5 + wall * 0.8, 0, -drawerInnerD * 0.5 + wall * 0.5);
    drawer.add(left);

    const right = left.clone();
    right.position.x = drawerW * 0.5 - wall * 0.8;
    drawer.add(right);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(drawerW - wall * 2, drawerH - wall * 2, wall),
      matSide,
    );
    back.position.set(0, 0, -drawerInnerD + wall);
    drawer.add(back);

    const front = new THREE.Mesh(
      new THREE.BoxGeometry(drawerW, drawerH, wall * 1.4),
      matFace,
    );
    front.position.set(0, 0, wall * 0.65);
    front.castShadow = true;
    drawer.add(front);

    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.02, 12),
      new THREE.MeshStandardMaterial({ color: '#c8a85c', metalness: 0.65, roughness: 0.28 }),
    );
    knob.rotation.x = Math.PI / 2;
    knob.position.set(drawerW * 0.26, 0, wall * 1.2);
    knob.castShadow = true;
    drawer.add(knob);

    this.slideGroup = new THREE.Group();
    this.slideGroup.name = 'NightstandDrawerSlide';
    this.slideGroup.position.copy(anchor.center);
    this.slideGroup.add(drawer);
    nightstandGroup.add(this.slideGroup);

    this.closedPos.copy(this.slideGroup.position);
    this.openPos.copy(this.closedPos).add(new THREE.Vector3(0, 0, this.slideDistance));

    if (this.pendingUnlock) {
      this.open(this.pendingAnimate);
      this.pendingUnlock = false;
    }
  }

  open(animate = true): void {
    if (!this.slideGroup) {
      this.pendingUnlock = true;
      this.pendingAnimate = animate;
      return;
    }
    if (this.phase === 'open' || this.phase === 'opening') return;

    this.slideGroup.visible = true;

    if (!animate) {
      this.phase = 'open';
      this.animTime = 0;
      this.applySlide(1);
      return;
    }

    this.phase = 'opening';
    this.animTime = 0;
  }

  close(): void {
    this.pendingUnlock = false;
    this.pendingAnimate = false;
    if (!this.slideGroup) {
      this.phase = 'closed';
      return;
    }
    this.phase = 'closed';
    this.animTime = 0;
    this.applySlide(0);
  }

  update(dt: number): void {
    if (this.phase !== 'opening') return;

    this.animTime += dt;
    const t = THREE.MathUtils.clamp(this.animTime / this.duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 2.8);
    const pop = t < 0.18 ? Math.sin((t / 0.18) * Math.PI) * 0.05 : 0;
    this.applySlide(Math.min(eased + pop, 1.05));

    if (t >= 1) {
      this.applySlide(1);
      this.phase = 'open';
    }
  }

  isOpen(): boolean {
    return this.phase === 'open' || this.phase === 'opening';
  }

  private applySlide(amount: number): void {
    if (!this.slideGroup) return;
    this.slideGroup.position.lerpVectors(this.closedPos, this.openPos, amount);
  }

  private measureDrawerAnchor(cabinetModel: THREE.Object3D): DrawerAnchor {
    const cabinetBox = new THREE.Box3().setFromObject(cabinetModel);
    const cabinetSize = new THREE.Vector3();
    cabinetBox.getSize(cabinetSize);

    let detailBox: THREE.Box3 | null = null;
    cabinetModel.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh || !/_2$/.test(child.name)) return;
      detailBox = new THREE.Box3().setFromObject(child);
    });

    if (detailBox !== null) {
      const box = detailBox as THREE.Box3;
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      return {
        center,
        width: Math.max(size.x * 3.2, cabinetSize.x * 0.52),
        height: Math.max(size.y * 1.05, cabinetSize.y * 0.18),
      };
    }

    const center = new THREE.Vector3();
    cabinetBox.getCenter(center);
    return {
      center: new THREE.Vector3(
        center.x,
        cabinetBox.min.y + cabinetSize.y * 0.53,
        cabinetBox.max.z - 0.01,
      ),
      width: cabinetSize.x * 0.55,
      height: cabinetSize.y * 0.18,
    };
  }

  private hideGlbDrawerDetail(cabinetModel: THREE.Object3D): void {
    cabinetModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && /_2$/.test(child.name)) {
        child.visible = false;
      }
    });
  }
}
