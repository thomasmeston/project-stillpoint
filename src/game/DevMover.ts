import * as THREE from 'three';
import type { RoomBuilder } from '../scene/RoomBuilder';
import puzzleData from '../../data/puzzles/bedroom.json';
import {
  clearContentOverrides,
  getBaseExamine,
  getBaseItem,
  getBaseThoughtForExamine,
  getContentOverrides,
  getExamineOverride,
  getItemOverride,
  listItemIds,
  setExamineOverride,
  setItemOverride,
} from './DevContentOverrides';
import {
  buildRoomJson,
  saveContentToRepo,
  saveLayoutToRepo,
} from './DevSave';

const RELATIONSHIPS: Record<string, { props: string[]; hotspots: string[]; lights: string[] }> = {
  BedFrame: {
    props: ['Mattress', 'Pillow', 'BedsideLamp'],
    hotspots: ['bed', 'calendar_scrap'],
    lights: []
  },
  Desk: {
    props: ['DeskTop', 'LampBase', 'LampShade', 'Sketchbook', 'DeskMug'],
    hotspots: ['desk', 'desk_drawer', 'sketchbook', 'combine_station', 'lamp'],
    lights: ['lamp']
  },
  LampBase: {
    props: ['LampShade'],
    hotspots: ['lamp'],
    lights: ['lamp']
  },
  LampShade: {
    props: [],
    hotspots: ['lamp'],
    lights: ['lamp']
  },
  Chair: {
    props: [],
    hotspots: ['chair'],
    lights: []
  },
  Nightstand: {
    props: ['CrowFigurine'],
    hotspots: ['nightstand', 'key_handle'],
    lights: []
  },
  Wardrobe: {
    props: ['WardrobeDoor'],
    hotspots: ['wardrobe', 'cipher_disk_pickup', 'stillpoint_letter'],
    lights: []
  },
  Bookshelf: {
    props: [],
    hotspots: ['bookshelf'],
    lights: []
  },
  WindowFrame: {
    props: ['WindowGlass'],
    hotspots: ['window'],
    lights: ['window']
  },
  WindowGlass: {
    props: [],
    hotspots: ['window'],
    lights: ['window']
  },
  Painting: {
    props: [],
    hotspots: ['painting'],
    lights: []
  },
  WallSafe: {
    props: ['Phone'],
    hotspots: ['wall_safe'],
    lights: []
  },
  ClockBody: {
    props: ['ClockFace'],
    hotspots: ['wall_clock'],
    lights: []
  }
};

const HOTSPOT_ITEM = new Map(
  puzzleData.hotspots
    .filter((h): h is typeof h & { item: string } => Boolean(h.item))
    .map((h) => [h.id, h.item]),
);

type HistoryState = {
  props: Array<{
    id: string;
    position: [number, number, number];
    rotation?: [number, number, number];
  }>;
  hotspots: Array<{
    id: string;
    position: [number, number, number];
  }>;
  lighting: Record<string, {
    position: [number, number, number];
  }>;
};

type EditMode = 'layout' | 'text';

export class DevMover {
  private active = false;
  private editMode: EditMode = 'layout';
  // Selection state
  private selectedProps = new Map<string, THREE.Object3D>(); // id -> mesh
  private boxHelpers = new Map<string, THREE.BoxHelper>(); // id -> BoxHelper

  // History state
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];
  private maxHistory = 50;

  // DOM cache
  private panelEl: HTMLElement | null = null;
  private modeIndicatorEl: HTMLElement | null = null;
  private layoutSectionEl: HTMLElement | null = null;
  private contentSectionEl: HTMLElement | null = null;
  private layoutModeTab: HTMLButtonElement | null = null;
  private textModeTab: HTMLButtonElement | null = null;
  private nameEl: HTMLElement | null = null;
  private contentNameEl: HTMLElement | null = null;
  private posXInput: HTMLInputElement | null = null;
  private posYInput: HTMLInputElement | null = null;
  private posZInput: HTMLInputElement | null = null;
  private rotYInput: HTMLInputElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;

  private selectedHotspotId: string | null = null;
  private hotspotPicker: HTMLSelectElement | null = null;
  private itemPicker: HTMLSelectElement | null = null;
  private examineTitleInput: HTMLInputElement | null = null;
  private examineBodyInput: HTMLTextAreaElement | null = null;
  private examineThoughtInput: HTMLTextAreaElement | null = null;
  private itemLabelInput: HTMLInputElement | null = null;
  private itemDescInput: HTMLTextAreaElement | null = null;

  // Event handler bounds
  private clickHandlerBound = this.handleClick.bind(this);
  private keydownHandlerBound = this.handleKeyDown.bind(this);

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private room: RoomBuilder,
    private canvas: HTMLCanvasElement,
    private onToggled: (active: boolean) => void,
  ) {
    this.initDOM();
  }

  private initDOM(): void {
    this.panelEl = document.getElementById('dev-panel');
    this.modeIndicatorEl = document.getElementById('dev-mode-indicator');
    this.layoutSectionEl = document.getElementById('dev-layout-section');
    this.contentSectionEl = document.getElementById('dev-content-section');
    this.layoutModeTab = document.getElementById('dev-mode-layout') as HTMLButtonElement;
    this.textModeTab = document.getElementById('dev-mode-text') as HTMLButtonElement;
    this.nameEl = document.getElementById('dev-selected-name');
    this.contentNameEl = document.getElementById('dev-content-selected-name');
    this.posXInput = document.getElementById('dev-pos-x') as HTMLInputElement;
    this.posYInput = document.getElementById('dev-pos-y') as HTMLInputElement;
    this.posZInput = document.getElementById('dev-pos-z') as HTMLInputElement;
    this.rotYInput = document.getElementById('dev-rot-y') as HTMLInputElement;
    this.undoBtn = document.getElementById('dev-undo') as HTMLButtonElement;
    this.redoBtn = document.getElementById('dev-redo') as HTMLButtonElement;

    // Register UI nudge buttons
    this.wireNudge('dev-x-dec', 'dev-x-inc', 'x');
    this.wireNudge('dev-y-dec', 'dev-y-inc', 'y');
    this.wireNudge('dev-z-dec', 'dev-z-inc', 'z');
    this.wireNudge('dev-ry-dec', 'dev-ry-inc', 'ry');

    // Register input field change listeners
    const triggerChange = () => this.applyInputs();
    this.posXInput?.addEventListener('change', triggerChange);
    this.posYInput?.addEventListener('change', triggerChange);
    this.posZInput?.addEventListener('change', triggerChange);
    this.rotYInput?.addEventListener('change', triggerChange);

    // Actions
    this.undoBtn?.addEventListener('click', () => this.undo());
    this.redoBtn?.addEventListener('click', () => this.redo());
    document.getElementById('dev-copy-json')?.addEventListener('click', () => this.copyJson());
    document.getElementById('dev-save-layout')?.addEventListener('click', () => this.saveLayoutToDisk());
    document.getElementById('dev-reset-layout')?.addEventListener('click', () => this.resetLayout());
    document.getElementById('dev-close-btn')?.addEventListener('click', () => this.setActive(false));

    this.hotspotPicker = document.getElementById('dev-hotspot-picker') as HTMLSelectElement;
    this.itemPicker = document.getElementById('dev-item-picker') as HTMLSelectElement;
    this.examineTitleInput = document.getElementById('dev-examine-title') as HTMLInputElement;
    this.examineBodyInput = document.getElementById('dev-examine-body') as HTMLTextAreaElement;
    this.examineThoughtInput = document.getElementById('dev-examine-thought') as HTMLTextAreaElement;
    this.itemLabelInput = document.getElementById('dev-item-label') as HTMLInputElement;
    this.itemDescInput = document.getElementById('dev-item-description') as HTMLTextAreaElement;

    this.populateContentPickers();
    this.hotspotPicker?.addEventListener('change', () => {
      if (this.hotspotPicker?.value) this.selectHotspot(this.hotspotPicker.value);
    });
    this.itemPicker?.addEventListener('change', () => {
      const itemId = this.itemPicker?.value ?? '';
      if (itemId && this.contentNameEl) {
        this.contentNameEl.textContent = `Item: ${itemId}`;
      }
      this.loadItemFields(itemId);
    });
    document.getElementById('dev-apply-content')?.addEventListener('click', () => this.applyContent());
    document.getElementById('dev-save-content')?.addEventListener('click', () => this.saveContent());
    document.getElementById('dev-copy-content')?.addEventListener('click', () => this.copyContentJson());
    document.getElementById('dev-reset-content')?.addEventListener('click', () => this.resetContent());

    this.layoutModeTab?.addEventListener('click', () => this.setEditMode('layout'));
    this.textModeTab?.addEventListener('click', () => this.setEditMode('text'));
  }

  private setEditMode(mode: EditMode): void {
    if (this.editMode === mode) return;
    this.editMode = mode;

    if (mode === 'layout') {
      this.deselectContent();
    } else {
      this.deselectLayout();
    }

    this.layoutSectionEl?.classList.toggle('hidden', mode !== 'layout');
    this.contentSectionEl?.classList.toggle('hidden', mode !== 'text');
    this.layoutModeTab?.classList.toggle('active', mode === 'layout');
    this.textModeTab?.classList.toggle('active', mode === 'text');
    this.layoutModeTab?.setAttribute('aria-selected', mode === 'layout' ? 'true' : 'false');
    this.textModeTab?.setAttribute('aria-selected', mode === 'text' ? 'true' : 'false');

    if (this.modeIndicatorEl) {
      this.modeIndicatorEl.textContent = mode === 'layout' ? 'Layout' : 'Text';
    }

    this.updateHotspotDebugVisibility();
  }

  private updateHotspotDebugVisibility(): void {
    const showHotspots = this.active && this.editMode === 'text';
    for (const hs of this.room.hotspots) {
      hs.setVisibleDebug(showHotspots);
    }
  }

  private wireNudge(decId: string, incId: string, axis: 'x' | 'y' | 'z' | 'ry'): void {
    const step = axis === 'ry' ? 15 : 0.05;
    document.getElementById(decId)?.addEventListener('click', () => {
      this.nudge(axis, -step);
    });
    document.getElementById(incId)?.addEventListener('click', () => {
      this.nudge(axis, step);
    });
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;

    if (active) {
      this.editMode = 'layout';
      this.layoutSectionEl?.classList.remove('hidden');
      this.contentSectionEl?.classList.add('hidden');
      this.layoutModeTab?.classList.add('active');
      this.textModeTab?.classList.remove('active');
      if (this.modeIndicatorEl) this.modeIndicatorEl.textContent = 'Layout';
      this.panelEl?.classList.remove('hidden');
      this.canvas.addEventListener('click', this.clickHandlerBound);
      window.addEventListener('keydown', this.keydownHandlerBound);
    } else {
      this.panelEl?.classList.add('hidden');
      this.canvas.removeEventListener('click', this.clickHandlerBound);
      window.removeEventListener('keydown', this.keydownHandlerBound);
      this.deselectAll();
      this.undoStack = [];
      this.redoStack = [];
      this.updateHistoryButtons();
    }

    // Toggle debug visibility of hotspots (text mode only)
    this.updateHotspotDebugVisibility();

    this.onToggled(active);
  }

  private handleClick(e: MouseEvent): void {
    if (e.button !== 0) return; // Only left click
    const toggle = e.ctrlKey || e.shiftKey;
    this.selectObjectAt(e.clientX, e.clientY, toggle);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.editMode !== 'layout') return;

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (this.selectedProps.size === 0) return;
    if (e.target instanceof HTMLInputElement) return; // Skip if typing in inputs

    // Movement controls
    const moveStep = e.shiftKey ? 0.01 : 0.05;
    const rotStep = e.shiftKey ? 5 : 15;

    switch (e.key) {
      case 'ArrowLeft':
        this.nudge('x', -moveStep);
        e.preventDefault();
        break;
      case 'ArrowRight':
        this.nudge('x', moveStep);
        e.preventDefault();
        break;
      case 'ArrowUp':
        this.nudge('z', -moveStep);
        e.preventDefault();
        break;
      case 'ArrowDown':
        this.nudge('z', moveStep);
        e.preventDefault();
        break;
      case 'PageUp':
        this.nudge('y', moveStep);
        e.preventDefault();
        break;
      case 'PageDown':
        this.nudge('y', -moveStep);
        e.preventDefault();
        break;
      case 'r':
      case 'R':
        this.nudge('ry', rotStep);
        e.preventDefault();
        break;
      case 'Escape':
        this.deselectLayout();
        e.preventDefault();
        break;
    }
  }

  private selectObjectAt(clientX: number, clientY: number, toggle: boolean): void {
    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();

    if (this.editMode === 'text') {
      raycaster.layers.set(1);
      raycaster.setFromCamera(mouse, this.camera);
      const hotspotHits = raycaster.intersectObjects(
        this.room.hotspots.map((h) => h.mesh),
        false,
      );
      if (hotspotHits.length > 0) {
        const hotspotId = hotspotHits[0].object.userData.hotspotId as string;
        this.selectHotspot(hotspotId);
        return;
      }
      if (!toggle) {
        this.deselectContent();
      }
      return;
    }

    raycaster.layers.set(0);
    raycaster.setFromCamera(mouse, this.camera);

    const targets: THREE.Object3D[] = [];

    // Traverse all meshes that correspond to props
    this.room.propsRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        targets.push(child);
      }
    });

    // Also check props loaded on walls
    this.room.root.traverse((child) => {
      if (
        (child as THREE.Mesh).isMesh &&
        child.name &&
        !child.name.startsWith('wall_') &&
        child.name !== 'WindowGlass' &&
        !child.userData.isFloor &&
        !child.userData.isHotspot
      ) {
        targets.push(child);
      }
    });

    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let current: THREE.Object3D | null = hits[0].object;
      while (current && current !== this.scene) {
        const id = current.name;
        const exists = this.room.propsData.some((p) => p.id === id);
        if (exists) {
          this.toggleSelection(id, current, toggle);
          return;
        }
        current = current.parent;
      }
    } else if (!toggle) {
      this.deselectLayout();
    }
  }

  private toggleSelection(id: string, mesh: THREE.Object3D, toggle: boolean): void {
    if (!toggle) {
      this.deselectLayout();
    }

    if (this.selectedProps.has(id)) {
      if (toggle) {
        this.selectedProps.delete(id);
        const helper = this.boxHelpers.get(id);
        if (helper) {
          this.scene.remove(helper);
          this.boxHelpers.delete(id);
        }
      }
    } else {
      this.selectedProps.set(id, mesh);
      const helper = new THREE.BoxHelper(mesh, 0xffcc00);
      this.scene.add(helper);
      this.boxHelpers.set(id, helper);
    }

    this.updateUIFields();
  }

  private deselectAll(): void {
    this.deselectLayout();
    this.deselectContent();
  }

  private deselectLayout(): void {
    this.selectedProps.clear();
    for (const helper of this.boxHelpers.values()) {
      this.scene.remove(helper);
    }
    this.boxHelpers.clear();
    this.updateLayoutUIFields();
  }

  private deselectContent(): void {
    this.selectedHotspotId = null;
    if (this.hotspotPicker) this.hotspotPicker.value = '';
    if (this.contentNameEl) this.contentNameEl.textContent = 'None';
  }

  private updateBoxHelpers(): void {
    for (const [id, helper] of this.boxHelpers.entries()) {
      const mesh = this.selectedProps.get(id);
      if (mesh) {
        helper.update();
      } else {
        this.scene.remove(helper);
        this.boxHelpers.delete(id);
      }
    }
  }

  private updateUIFields(): void {
    this.updateLayoutUIFields();
  }

  private updateLayoutUIFields(): void {
    if (this.selectedProps.size === 1) {
      const id = this.selectedProps.keys().next().value!;
      if (this.nameEl) this.nameEl.textContent = id;

      const prop = this.room.propsData.find((p) => p.id === id);
      if (prop) {
        if (this.posXInput) {
          this.posXInput.disabled = false;
          this.posXInput.value = prop.position[0].toFixed(2);
        }
        if (this.posYInput) {
          this.posYInput.disabled = false;
          this.posYInput.value = prop.position[1].toFixed(2);
        }
        if (this.posZInput) {
          this.posZInput.disabled = false;
          this.posZInput.value = prop.position[2].toFixed(2);
        }
        if (this.rotYInput) {
          this.rotYInput.disabled = false;
          const ry = prop.rotation ? prop.rotation[1] : 0;
          this.rotYInput.value = Math.round(ry).toString();
        }
      }
    } else if (this.selectedProps.size > 1) {
      if (this.nameEl) this.nameEl.textContent = `${this.selectedProps.size} objects`;
      if (this.posXInput) { this.posXInput.disabled = true; this.posXInput.value = 'Multiple'; }
      if (this.posYInput) { this.posYInput.disabled = true; this.posYInput.value = 'Multiple'; }
      if (this.posZInput) { this.posZInput.disabled = true; this.posZInput.value = 'Multiple'; }
      if (this.rotYInput) { this.rotYInput.disabled = true; this.rotYInput.value = 'Multiple'; }
    } else {
      if (this.nameEl) this.nameEl.textContent = 'None';
      if (this.posXInput) { this.posXInput.disabled = true; this.posXInput.value = '0.00'; }
      if (this.posYInput) { this.posYInput.disabled = true; this.posYInput.value = '0.00'; }
      if (this.posZInput) { this.posZInput.disabled = true; this.posZInput.value = '0.00'; }
      if (this.rotYInput) { this.rotYInput.disabled = true; this.rotYInput.value = '0'; }
    }
  }

  private findMeshForProp(id: string): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    this.room.propsRoot.traverse((child) => {
      if (child.name === id) {
        found = child;
      }
    });
    if (!found) {
      this.room.root.traverse((child) => {
        if (child.name === id && !child.name.startsWith('wall_')) {
          found = child;
        }
      });
    }
    return found;
  }

  private applyTransformToHotspotMesh(mesh: THREE.Object3D, hsData: any): void {
    const wallFace = mesh.userData.wallFace;
    if (wallFace && wallFace !== 'floor') {
      const wallMesh = this.room.wallMeshes.get(wallFace);
      if (wallMesh) {
        mesh.position.set(
          hsData.position[0] - wallMesh.position.x,
          hsData.position[1] - wallMesh.position.y,
          hsData.position[2] - wallMesh.position.z
        );
      } else {
        mesh.position.set(hsData.position[0], hsData.position[1], hsData.position[2]);
      }
    } else {
      mesh.position.set(hsData.position[0], hsData.position[1], hsData.position[2]);
    }
  }

  private collectAffected(
    propId: string,
    visitedProps: Set<string>,
    visitedHotspots: Set<string>,
    visitedLights: Set<string>
  ): void {
    if (visitedProps.has(propId)) return;
    visitedProps.add(propId);

    const rel = RELATIONSHIPS[propId];
    if (rel) {
      for (const childPropId of rel.props) {
        this.collectAffected(childPropId, visitedProps, visitedHotspots, visitedLights);
      }
      for (const hsId of rel.hotspots) {
        visitedHotspots.add(hsId);
      }
      for (const lightId of rel.lights) {
        visitedLights.add(lightId);
      }
    }
  }

  private nudgePropGroup(propId: string, axis: 'x' | 'y' | 'z' | 'ry', amount: number): void {
    const prop = this.room.propsData.find((p) => p.id === propId);
    if (!prop) return;

    const parentX = prop.position[0];
    const parentZ = prop.position[2];

    const visitedProps = new Set<string>();
    const visitedHotspots = new Set<string>();
    const visitedLights = new Set<string>();

    // 1. Gather all descendants recursively
    this.collectAffected(propId, visitedProps, visitedHotspots, visitedLights);

    // Apply translations/rotations to all gathered props
    for (const pId of visitedProps) {
      const p = this.room.propsData.find((item) => item.id === pId);
      if (p) {
        if (pId === propId) {
          // Direct transform for selected parent
          if (axis === 'x') p.position[0] += amount;
          else if (axis === 'y') p.position[1] += amount;
          else if (axis === 'z') p.position[2] += amount;
          else if (axis === 'ry') {
            if (!p.rotation) p.rotation = [0, 0, 0];
            p.rotation[1] = (p.rotation[1] + amount + 360) % 360;
          }
        } else {
          // Child item transform relative to parent pivot
          if (axis === 'x') {
            p.position[0] += amount;
          } else if (axis === 'y') {
            p.position[1] += amount;
          } else if (axis === 'z') {
            p.position[2] += amount;
          } else if (axis === 'ry') {
            const rx = p.position[0] - parentX;
            const rz = p.position[2] - parentZ;
            const rad = THREE.MathUtils.degToRad(amount);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            p.position[0] = parentX + (rx * cos - rz * sin);
            p.position[2] = parentZ + (rx * sin + rz * cos);
            if (!p.rotation) p.rotation = [0, 0, 0];
            p.rotation[1] = (p.rotation[1] + amount + 360) % 360;
          }
        }

        const mesh = this.findMeshForProp(pId);
        if (mesh) {
          this.applyTransformToMesh(mesh, p);
        }
      }
    }

    // Apply translations/rotations to all gathered hotspots
    for (const hsId of visitedHotspots) {
      const hsData = this.room.hotspotsData.find((item) => item.id === hsId);
      if (hsData) {
        if (axis === 'x') {
          hsData.position[0] += amount;
        } else if (axis === 'y') {
          hsData.position[1] += amount;
        } else if (axis === 'z') {
          hsData.position[2] += amount;
        } else if (axis === 'ry') {
          const rx = hsData.position[0] - parentX;
          const rz = hsData.position[2] - parentZ;
          const rad = THREE.MathUtils.degToRad(amount);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          hsData.position[0] = parentX + (rx * cos - rz * sin);
          hsData.position[2] = parentZ + (rx * sin + rz * cos);
        }

        const hs = this.room.hotspots.find((item) => item.id === hsId);
        if (hs) {
          this.applyTransformToHotspotMesh(hs.mesh, hsData);
        }
      }
    }

    // Apply translations/rotations to all gathered lights
    for (const ltId of visitedLights) {
      const ltData = this.room.lightingData ? this.room.lightingData[ltId] : undefined;
      if (ltData) {
        if (axis === 'x') {
          ltData.position[0] += amount;
        } else if (axis === 'y') {
          ltData.position[1] += amount;
        } else if (axis === 'z') {
          ltData.position[2] += amount;
        } else if (axis === 'ry') {
          const rx = ltData.position[0] - parentX;
          const rz = ltData.position[2] - parentZ;
          const rad = THREE.MathUtils.degToRad(amount);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          ltData.position[0] = parentX + (rx * cos - rz * sin);
          ltData.position[2] = parentZ + (rx * sin + rz * cos);
        }

        const lightMesh = this.room.lights.get(ltId);
        if (lightMesh && !lightMesh.userData.parentPropId) {
          lightMesh.position.set(ltData.position[0], ltData.position[1], ltData.position[2]);
        }
      }
    }
  }

  private nudge(axis: 'x' | 'y' | 'z' | 'ry', amount: number): void {
    if (this.selectedProps.size === 0) return;

    // Record history state prior to modifications
    this.pushHistory();

    // Apply nudge to all selected props
    for (const id of this.selectedProps.keys()) {
      this.nudgePropGroup(id, axis, amount);
    }

    // Sync UI fields
    this.updateUIFields();

    // Rebuild collision boundaries and save
    this.room.rebuildObstacles();
    this.persistLayoutDraft();

    // Update selection visual outlines
    this.updateBoxHelpers();
  }

  private applyInputs(): void {
    if (this.selectedProps.size !== 1) return;
    const id = this.selectedProps.keys().next().value!;

    const prop = this.room.propsData.find((p) => p.id === id);
    if (!prop) return;

    const x = parseFloat(this.posXInput?.value ?? '0');
    const y = parseFloat(this.posYInput?.value ?? '0');
    const z = parseFloat(this.posZInput?.value ?? '0');
    const ry = parseFloat(this.rotYInput?.value ?? '0');

    const xDiff = !isNaN(x) && x !== prop.position[0];
    const yDiff = !isNaN(y) && y !== prop.position[1];
    const zDiff = !isNaN(z) && z !== prop.position[2];
    const currentRy = prop.rotation ? prop.rotation[1] : 0;
    const ryDiff = !isNaN(ry) && ry !== currentRy;

    if (xDiff || yDiff || zDiff || ryDiff) {
      this.pushHistory();

      if (xDiff) this.nudgePropGroup(id, 'x', x - prop.position[0]);
      if (yDiff) this.nudgePropGroup(id, 'y', y - prop.position[1]);
      if (zDiff) this.nudgePropGroup(id, 'z', z - prop.position[2]);
      if (ryDiff) this.nudgePropGroup(id, 'ry', ry - currentRy);

      this.room.rebuildObstacles();
      this.persistLayoutDraft();
      this.updateBoxHelpers();
      this.updateUIFields();
    }
  }

  private applyTransformToMesh(mesh: THREE.Object3D, prop: any): void {
    const wallFace = mesh.userData.wallFace;
    if (wallFace && wallFace !== 'floor') {
      const wallMesh = this.room.wallMeshes.get(wallFace);
      if (wallMesh) {
        mesh.position.set(
          prop.position[0] - wallMesh.position.x,
          prop.position[1] - wallMesh.position.y,
          prop.position[2] - wallMesh.position.z
        );
      } else {
        mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
      }
    } else {
      mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
    }

    if (prop.rotation) {
      mesh.rotation.y = THREE.MathUtils.degToRad(prop.rotation[1]);
    }
  }

  // History system
  private pushHistory(): void {
    const propsCopy = this.room.propsData.map((p) => ({
      id: p.id,
      position: [...p.position] as [number, number, number],
      ...(p.rotation ? { rotation: [...p.rotation] as [number, number, number] } : {})
    }));

    const hotspotsCopy = this.room.hotspotsData.map((h) => ({
      id: h.id,
      position: [...h.position] as [number, number, number]
    }));

    const lightingCopy: Record<string, { position: [number, number, number] }> = {};
    for (const [key, spec] of Object.entries(this.room.lightingData || {})) {
      lightingCopy[key] = {
        position: [...spec.position] as [number, number, number]
      };
    }

    this.undoStack.push({ props: propsCopy, hotspots: hotspotsCopy, lighting: lightingCopy });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateHistoryButtons();
  }

  private undo(): void {
    if (this.undoStack.length === 0) return;

    const currentProps = this.room.propsData.map((p) => ({
      id: p.id,
      position: [...p.position] as [number, number, number],
      ...(p.rotation ? { rotation: [...p.rotation] as [number, number, number] } : {})
    }));
    const currentHotspots = this.room.hotspotsData.map((h) => ({
      id: h.id,
      position: [...h.position] as [number, number, number]
    }));
    const currentLighting: Record<string, { position: [number, number, number] }> = {};
    for (const [key, spec] of Object.entries(this.room.lightingData || {})) {
      currentLighting[key] = {
        position: [...spec.position] as [number, number, number]
      };
    }
    this.redoStack.push({ props: currentProps, hotspots: currentHotspots, lighting: currentLighting });

    const state = this.undoStack.pop()!;
    this.restoreState(state);
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;

    const currentProps = this.room.propsData.map((p) => ({
      id: p.id,
      position: [...p.position] as [number, number, number],
      ...(p.rotation ? { rotation: [...p.rotation] as [number, number, number] } : {})
    }));
    const currentHotspots = this.room.hotspotsData.map((h) => ({
      id: h.id,
      position: [...h.position] as [number, number, number]
    }));
    const currentLighting: Record<string, { position: [number, number, number] }> = {};
    for (const [key, spec] of Object.entries(this.room.lightingData || {})) {
      currentLighting[key] = {
        position: [...spec.position] as [number, number, number]
      };
    }
    this.undoStack.push({ props: currentProps, hotspots: currentHotspots, lighting: currentLighting });

    const state = this.redoStack.pop()!;
    this.restoreState(state);
  }

  private restoreState(state: HistoryState): void {
    for (const savedProp of state.props) {
      const prop = this.room.propsData.find((p) => p.id === savedProp.id);
      if (prop) {
        prop.position = [...savedProp.position];
        if (savedProp.rotation) {
          prop.rotation = [...savedProp.rotation];
        }
        const mesh = this.findMeshForProp(savedProp.id);
        if (mesh) {
          this.applyTransformToMesh(mesh, prop);
        }
      }
    }

    for (const savedHs of state.hotspots) {
      const hsData = this.room.hotspotsData.find((h) => h.id === savedHs.id);
      if (hsData) {
        hsData.position = [...savedHs.position];
        const hs = this.room.hotspots.find((h) => h.id === savedHs.id);
        if (hs) {
          this.applyTransformToHotspotMesh(hs.mesh, hsData);
        }
      }
    }

    if (state.lighting) {
      for (const [key, savedLt] of Object.entries(state.lighting)) {
        const ltData = this.room.lightingData ? this.room.lightingData[key] : undefined;
        if (ltData) {
          ltData.position = [...savedLt.position];
          const pointLight = this.room.lights.get(key);
          if (pointLight && !pointLight.userData.parentPropId) {
            pointLight.position.set(ltData.position[0], ltData.position[1], ltData.position[2]);
          }
        }
      }
    }

    this.room.rebuildObstacles();
    this.persistLayoutDraft();
    this.updateBoxHelpers();
    this.updateUIFields();
    this.updateHistoryButtons();
  }

  private updateHistoryButtons(): void {
    if (this.undoBtn) this.undoBtn.disabled = this.undoStack.length === 0;
    if (this.redoBtn) this.redoBtn.disabled = this.redoStack.length === 0;
  }

  private persistLayoutDraft(): void {
    localStorage.setItem(
      'dev_room_layout_bedroom',
      JSON.stringify({
        props: this.room.propsData,
        hotspots: this.room.hotspotsData,
        lighting: this.room.lightingData
      })
    );
  }

  private copyJson(): void {
    const json = JSON.stringify(buildRoomJson(this.room), null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => {
        alert('Copied entire room layout JSON (including props, hotspots & lights) to clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy JSON: ', err);
        alert('Failed to copy to clipboard. JSON printed to developer console.');
        console.log(json);
      });
  }

  private async saveLayoutToDisk(): Promise<void> {
    if (!confirm('Save layout to data/rooms/bedroom.json? This overwrites the file on disk.')) {
      return;
    }

    const result = await saveLayoutToRepo(this.room);
    alert(result.message);
    if (result.ok && result.method === 'api') {
      location.reload();
    }
  }

  private resetLayout(): void {
    if (confirm('Are you sure you want to reset all custom layout placements?')) {
      localStorage.removeItem('dev_room_layout_bedroom');
      location.reload();
    }
  }

  private populateContentPickers(): void {
    if (this.hotspotPicker) {
      this.hotspotPicker.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— select hotspot —';
      this.hotspotPicker.appendChild(blank);
      for (const hs of this.room.hotspotsData) {
        const opt = document.createElement('option');
        opt.value = hs.id;
        opt.textContent = hs.label ? `${hs.id} (${hs.label})` : hs.id;
        this.hotspotPicker.appendChild(opt);
      }
    }
    if (this.itemPicker) {
      this.itemPicker.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— select item —';
      this.itemPicker.appendChild(blank);
      for (const itemId of listItemIds()) {
        const opt = document.createElement('option');
        opt.value = itemId;
        opt.textContent = itemId;
        this.itemPicker.appendChild(opt);
      }
    }
  }

  private selectHotspot(hotspotId: string): void {
    this.selectedHotspotId = hotspotId;
    if (this.hotspotPicker) this.hotspotPicker.value = hotspotId;
    if (this.contentNameEl) {
      this.contentNameEl.textContent = hotspotId;
    }
    this.loadContentFields(hotspotId);
  }

  private loadContentFields(hotspotId: string): void {
    const base = getBaseExamine(hotspotId);
    const ov = getExamineOverride(hotspotId);

    if (this.examineTitleInput) {
      this.examineTitleInput.value = ov?.title ?? base?.title ?? '';
    }
    if (this.examineBodyInput) {
      this.examineBodyInput.value = ov?.body ?? base?.body ?? '';
    }
    if (this.examineThoughtInput) {
      this.examineThoughtInput.value =
        ov?.thought ?? getBaseThoughtForExamine(hotspotId);
    }

    const linkedItem = HOTSPOT_ITEM.get(hotspotId);
    if (linkedItem && this.itemPicker) {
      this.itemPicker.value = linkedItem;
      this.loadItemFields(linkedItem);
    }
  }

  private loadItemFields(itemId: string): void {
    if (!itemId) return;
    const base = getBaseItem(itemId);
    const ov = getItemOverride(itemId);
    if (this.itemLabelInput) {
      this.itemLabelInput.value = ov?.label ?? base?.label ?? '';
    }
    if (this.itemDescInput) {
      this.itemDescInput.value = ov?.description ?? base?.description ?? '';
    }
  }

  private applyContent(): void {
    this.applyContentToOverrides();
    alert('Text preview saved to localStorage. Play-test to preview.');
  }

  private applyContentToOverrides(): void {
    if (this.selectedHotspotId) {
      setExamineOverride(this.selectedHotspotId, {
        title: this.examineTitleInput?.value ?? '',
        body: this.examineBodyInput?.value ?? '',
        thought: this.examineThoughtInput?.value ?? '',
      });
    }

    const itemId = this.itemPicker?.value;
    if (itemId) {
      setItemOverride(itemId, {
        label: this.itemLabelInput?.value ?? '',
        description: this.itemDescInput?.value ?? '',
      });
    }
  }

  private async saveContent(): Promise<void> {
    this.applyContentToOverrides();

    if (
      !confirm(
        'Save text to data/story/bedroom-script.json and data/items.json? This overwrites those files on disk.',
      )
    ) {
      return;
    }

    const result = await saveContentToRepo();
    alert(result.message);
    if (result.ok && result.method === 'api') {
      location.reload();
    }
  }

  private copyContentJson(): void {
    const json = JSON.stringify(getContentOverrides(), null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => alert('Copied content overrides JSON to clipboard.'))
      .catch(() => {
        console.log(json);
        alert('Content JSON logged to console.');
      });
  }

  private resetContent(): void {
    if (!confirm('Reset all dev text overrides?')) return;
    clearContentOverrides();
    if (this.selectedHotspotId) {
      this.loadContentFields(this.selectedHotspotId);
    }
    if (this.itemPicker?.value) {
      this.loadItemFields(this.itemPicker.value);
    }
    alert('Text overrides cleared.');
  }
}
