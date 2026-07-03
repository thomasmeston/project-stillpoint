import * as THREE from 'three';
import { DEFAULT_CORK_INTRO_WORDS } from '../game/IntroWords';
import { createPushPin } from './CrypticPaperArt';
import {
  buildBlackButton,
  buildCorkBoardFrame,
  buildGumWrapper,
  buildIntroWordStrip,
  loadArmyManFigure,
  buildNewspaperScrap,
  buildPlasticStraw,
  createWordStripTexture,
} from './CorkBoardPinnedArt';

export type CorkBoardItemId =
  | 'cork_straw'
  | 'cork_gum_wrapper'
  | 'cork_button'
  | 'cork_newspaper'
  | 'cork_army_man';

const BOARD_W = 1.45;
const BOARD_H = 1.05;
const ITEM_Z = 0.1;
const LABEL_OFFSET_Y = -0.062;
/** Wall-local anchor on the south wall — right of the wardrobe. */
export const CORK_BOARD_CLUSTER_OFFSET = new THREE.Vector3(-0.55, -0.05, -0.08);
const INSPECT_CENTER = new THREE.Vector3(0, 0, 0.32);
const INSPECT_SCALE = 2.85;

export function getCorkBoardFocusOnWall(): THREE.Vector3 {
  return new THREE.Vector3(
    CORK_BOARD_CLUSTER_OFFSET.x,
    CORK_BOARD_CLUSTER_OFFSET.y,
    CORK_BOARD_CLUSTER_OFFSET.z + 0.02,
  );
}

type ItemLayout = {
  id: CorkBoardItemId;
  x: number;
  y: number;
  rot: number;
  labelRot: number;
};

const ITEM_LAYOUTS: ItemLayout[] = [
  { id: 'cork_straw', x: -0.44, y: 0.3, rot: -32, labelRot: 4 },
  { id: 'cork_gum_wrapper', x: -0.02, y: 0.34, rot: 14, labelRot: -6 },
  { id: 'cork_button', x: -0.34, y: -0.02, rot: -6, labelRot: 3 },
  { id: 'cork_newspaper', x: 0.26, y: -0.06, rot: 9, labelRot: -4 },
  { id: 'cork_army_man', x: 0.42, y: 0.28, rot: -10, labelRot: 5 },
];

type ItemRestPose = {
  position: THREE.Vector3;
  rotationZ: number;
  scale: number;
};

type InspectMode = 'none' | 'to_inspect' | 'from_inspect';

type PinnedItemState = {
  id: CorkBoardItemId;
  root: THREE.Group;
  labelStrip: THREE.Mesh;
  layoutIndex: number;
};

export type CorkBoardHit = { type: 'item'; id: CorkBoardItemId };

function buildPinnedProp(id: Exclude<CorkBoardItemId, 'cork_army_man'>): THREE.Object3D {
  switch (id) {
    case 'cork_straw':
      return buildPlasticStraw();
    case 'cork_gum_wrapper':
      return buildGumWrapper();
    case 'cork_button':
      return buildBlackButton();
    case 'cork_newspaper':
      return buildNewspaperScrap();
  }
}

function wordForSlot(introWords: readonly string[], index: number): string {
  if (introWords[index]) return introWords[index];
  return DEFAULT_CORK_INTRO_WORDS[index] ?? DEFAULT_CORK_INTRO_WORDS[0];
}

export class CorkBoardCluster {
  readonly group = new THREE.Group();
  private readonly items: PinnedItemState[] = [];
  private readonly itemRestPoses: ItemRestPose[] = [];
  private introWords: string[] = [];

  private inspectedIndex: number | null = null;
  private inspectMode: InspectMode = 'none';
  private inspectTime = 0;
  private readonly inspectDuration = 0.38;
  private onItemInspected: ((id: CorkBoardItemId) => void) | null = null;
  private inspectFrom: ItemRestPose = {
    position: new THREE.Vector3(),
    rotationZ: 0,
    scale: 1,
  };
  private inspectTo: ItemRestPose = {
    position: new THREE.Vector3(),
    rotationZ: 0,
    scale: 1,
  };

  constructor() {
    this.group.name = 'CorkBoardCluster';
    this.group.position.copy(CORK_BOARD_CLUSTER_OFFSET);
    this.group.rotation.y = Math.PI;

    const frame = buildCorkBoardFrame(BOARD_W, BOARD_H);
    frame.position.z = ITEM_Z * 0.35;
    this.group.add(frame);

    this.buildPinnedItems();
  }

  setIntroWordLabels(words: readonly string[]): void {
    this.introWords = [...words];
    for (const { labelStrip, layoutIndex } of this.items) {
      this.applyWordToStrip(labelStrip, wordForSlot(this.introWords, layoutIndex));
    }
  }

  setOnItemInspected(handler: (id: CorkBoardItemId) => void): void {
    this.onItemInspected = handler;
  }

  attachToWall(wallMesh: THREE.Mesh): void {
    wallMesh.add(this.group);
  }

  getClickTargets(): THREE.Object3D[] {
    return this.items.map(({ root }) => root);
  }

  isAnimating(): boolean {
    return this.inspectMode !== 'none';
  }

  isInspecting(): boolean {
    return this.inspectedIndex !== null || this.inspectMode === 'to_inspect';
  }

  inspectItem(index: number): void {
    if (index < 0 || index >= this.items.length) return;

    if (this.inspectedIndex === index && this.inspectMode === 'none') {
      this.dismissInspect();
      return;
    }

    if (this.inspectMode !== 'none') return;

    if (this.inspectedIndex !== null && this.inspectedIndex !== index) {
      this.restoreItemVisual(this.inspectedIndex);
    }

    this.inspectedIndex = index;
    this.inspectFrom = this.poseFromMesh(this.items[index].root);
    this.inspectTo = this.inspectPose();
    this.inspectMode = 'to_inspect';
    this.inspectTime = 0;
    this.applyInspectDimming(index);
  }

  dismissInspect(): void {
    if (this.inspectedIndex === null || this.inspectMode !== 'none') return;
    const index = this.inspectedIndex;
    this.inspectFrom = this.poseFromMesh(this.items[index].root);
    this.inspectTo = this.itemRestPoses[index];
    this.inspectMode = 'from_inspect';
    this.inspectTime = 0;
  }

  resetInspect(): void {
    if (this.inspectedIndex !== null) {
      this.restoreItemVisual(this.inspectedIndex);
    }
    this.inspectedIndex = null;
    this.inspectMode = 'none';
    this.inspectTime = 0;
    this.clearItemDimming();
  }

  update(dt: number): void {
    if (this.inspectMode === 'none') return;
    if (this.inspectedIndex === null) return;

    this.inspectTime += dt;
    const t = THREE.MathUtils.clamp(this.inspectTime / this.inspectDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const root = this.items[this.inspectedIndex].root;

    root.position.lerpVectors(this.inspectFrom.position, this.inspectTo.position, eased);
    root.rotation.z = THREE.MathUtils.lerp(this.inspectFrom.rotationZ, this.inspectTo.rotationZ, eased);
    root.scale.setScalar(THREE.MathUtils.lerp(this.inspectFrom.scale, this.inspectTo.scale, eased));

    if (t >= 1) {
      if (this.inspectMode === 'to_inspect') {
        this.inspectMode = 'none';
        root.renderOrder = 12;
        this.onItemInspected?.(this.items[this.inspectedIndex].id);
      } else {
        const idx = this.inspectedIndex;
        this.inspectMode = 'none';
        this.inspectedIndex = null;
        root.renderOrder = 0;
        this.clearItemDimming();
        if (idx !== null) {
          this.itemRestPoses[idx] = this.poseFromMesh(root);
        }
      }
    }
  }

  raycastHit(raycaster: THREE.Raycaster): CorkBoardHit | null {
    raycaster.layers.set(0);
    const hits = raycaster.intersectObjects(this.getClickTargets(), true);
    if (hits.length === 0) return null;

    let obj: THREE.Object3D | null = hits[0].object;
    while (obj) {
      if (obj.userData.corkBoardItem) {
        return { type: 'item', id: obj.userData.corkBoardItem as CorkBoardItemId };
      }
      obj = obj.parent;
    }
    return null;
  }

  private buildPinnedItems(): void {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      this.group.remove(this.items[i].root);
    }
    this.items.length = 0;
    this.itemRestPoses.length = 0;

    for (let i = 0; i < ITEM_LAYOUTS.length; i += 1) {
      const layout = ITEM_LAYOUTS[i];
      const root = new THREE.Group();
      root.name = `cork_item_${layout.id}`;
      root.userData.corkBoardItem = layout.id;
      root.userData.itemIndex = i;
      root.position.set(layout.x, layout.y, ITEM_Z);
      root.rotation.z = THREE.MathUtils.degToRad(layout.rot);

      if (layout.id === 'cork_army_man') {
        void loadArmyManFigure().then((prop) => {
          prop.position.set(0, 0.01, 0);
          root.add(prop);
        });
      } else {
        const prop = buildPinnedProp(layout.id);
        prop.position.set(0, 0.01, 0);
        root.add(prop);
      }

      const labelStrip = buildIntroWordStrip(wordForSlot(this.introWords, i));
      labelStrip.position.set(0, LABEL_OFFSET_Y, 0.003);
      labelStrip.rotation.z = THREE.MathUtils.degToRad(layout.labelRot);
      root.add(labelStrip);

      const pin = createPushPin();
      pin.position.set(layout.x, layout.y + 0.05, ITEM_Z + 0.015);

      this.items.push({ id: layout.id, root, labelStrip, layoutIndex: i });
      this.itemRestPoses.push(this.layoutRestPose(i));
      this.group.add(root);
      this.group.add(pin);
    }
  }

  private applyWordToStrip(strip: THREE.Mesh, word: string): void {
    const mat = strip.material as THREE.MeshStandardMaterial;
    mat.map?.dispose();
    const tex = createWordStripTexture(word);
    tex.needsUpdate = true;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  private layoutRestPose(index: number): ItemRestPose {
    const layout = ITEM_LAYOUTS[index];
    return {
      position: new THREE.Vector3(layout.x, layout.y, ITEM_Z),
      rotationZ: THREE.MathUtils.degToRad(layout.rot),
      scale: 1,
    };
  }

  private inspectPose(): ItemRestPose {
    return {
      position: INSPECT_CENTER.clone(),
      rotationZ: 0,
      scale: INSPECT_SCALE,
    };
  }

  private poseFromMesh(root: THREE.Object3D): ItemRestPose {
    return {
      position: root.position.clone(),
      rotationZ: root.rotation.z,
      scale: root.scale.x,
    };
  }

  private restoreItemVisual(index: number): void {
    const root = this.items[index].root;
    const rest = this.itemRestPoses[index];
    root.position.copy(rest.position);
    root.rotation.z = rest.rotationZ;
    root.scale.setScalar(rest.scale);
    root.renderOrder = 0;
    this.setMeshOpacity(root, 1, false);
  }

  private applyInspectDimming(activeIndex: number): void {
    for (const { root, layoutIndex } of this.items) {
      if (layoutIndex === activeIndex) {
        this.setMeshOpacity(root, 1, false);
        continue;
      }
      this.setMeshOpacity(root, 0.42, true);
    }
  }

  private clearItemDimming(): void {
    for (const { root } of this.items) {
      this.setMeshOpacity(root, 1, false);
    }
  }

  private setMeshOpacity(root: THREE.Object3D, opacity: number, transparent: boolean): void {
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mat = (child as THREE.Mesh).material;
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const entry of materials) {
        const std = entry as THREE.MeshStandardMaterial;
        std.opacity = opacity;
        std.transparent = transparent;
      }
    });
  }
}
