import * as THREE from 'three';
import type { RoomBuilder } from '../scene/RoomBuilder';
import {
  clearContentOverrides,
  getBaseExamine,
  getBaseItem,
  getBaseOpeningThought,
  getBaseThoughtForExamine,
  getBaseWakeThought,
  getContentOverrides,
  getExamineOverride,
  getExamineThoughtKey,
  getItemOverride,
  getOpeningThoughtOverride,
  getWakeThoughtOverride,
  listItemIds,
  setDevContentRoom,
  setExamineOverride,
  setItemOverride,
  setOpeningThoughtOverride,
  setWakeThoughtOverride,
} from './DevContentOverrides';
import {
  getDevLevel,
  isDevLevelId,
  layoutStorageKey,
  type DevLevelId,
} from './DevLevelConfig';
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

type HistoryState = {
  props: Array<{
    id: string;
    position: [number, number, number];
    rotation?: [number, number, number];
  }>;
  hotspots: Array<{
    id: string;
    position: [number, number, number];
    size: [number, number, number];
  }>;
  lighting: Record<string, {
    position: [number, number, number];
  }>;
};

type EditMode = 'layout' | 'hotspots' | 'text';

export class DevMover {
  private active = false;
  private editMode: EditMode = 'layout';
  private roomId: DevLevelId = 'bedroom';
  private hotspotItemMap = new Map<string, string>();
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
  private hotspotsSectionEl: HTMLElement | null = null;
  private contentSectionEl: HTMLElement | null = null;
  private layoutModeTab: HTMLButtonElement | null = null;
  private hotspotsModeTab: HTMLButtonElement | null = null;
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
  private selectedLayoutHotspotId: string | null = null;
  private hotspotBoxHelper: THREE.BoxHelper | null = null;
  private hotspotPicker: HTMLSelectElement | null = null;
  private hotspotLayoutPicker: HTMLSelectElement | null = null;
  private hotspotLayoutNameEl: HTMLElement | null = null;
  private hsPosXInput: HTMLInputElement | null = null;
  private hsPosYInput: HTMLInputElement | null = null;
  private hsPosZInput: HTMLInputElement | null = null;
  private hsSizeXInput: HTMLInputElement | null = null;
  private hsSizeYInput: HTMLInputElement | null = null;
  private hsSizeZInput: HTMLInputElement | null = null;
  private hotspotUndoBtn: HTMLButtonElement | null = null;
  private hotspotRedoBtn: HTMLButtonElement | null = null;
  private itemPicker: HTMLSelectElement | null = null;
  private examineTitleInput: HTMLInputElement | null = null;
  private examineBodyInput: HTMLTextAreaElement | null = null;
  private examineThoughtInput: HTMLTextAreaElement | null = null;
  private examineThoughtHintEl: HTMLElement | null = null;
  private openingThoughtInput: HTMLTextAreaElement | null = null;
  private wakeThoughtInput: HTMLTextAreaElement | null = null;
  private wakeThoughtSectionEl: HTMLElement | null = null;
  private itemLabelInput: HTMLInputElement | null = null;
  private itemDescInput: HTMLTextAreaElement | null = null;
  private levelLabelEl: HTMLElement | null = null;
  private layoutHintEl: HTMLElement | null = null;
  private contentHintEl: HTMLElement | null = null;
  private itemSectionEl: HTMLElement | null = null;

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
    this.hotspotsSectionEl = document.getElementById('dev-hotspots-section');
    this.contentSectionEl = document.getElementById('dev-content-section');
    this.layoutModeTab = document.getElementById('dev-mode-layout') as HTMLButtonElement;
    this.hotspotsModeTab = document.getElementById('dev-mode-hotspots') as HTMLButtonElement;
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
    document.querySelectorAll('.dev-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.setActive(false));
    });

    this.hotspotPicker = document.getElementById('dev-hotspot-picker') as HTMLSelectElement;
    this.hotspotLayoutPicker = document.getElementById('dev-hotspot-layout-picker') as HTMLSelectElement;
    this.hotspotLayoutNameEl = document.getElementById('dev-hotspot-layout-name');
    this.hsPosXInput = document.getElementById('dev-hs-pos-x') as HTMLInputElement;
    this.hsPosYInput = document.getElementById('dev-hs-pos-y') as HTMLInputElement;
    this.hsPosZInput = document.getElementById('dev-hs-pos-z') as HTMLInputElement;
    this.hsSizeXInput = document.getElementById('dev-hs-size-x') as HTMLInputElement;
    this.hsSizeYInput = document.getElementById('dev-hs-size-y') as HTMLInputElement;
    this.hsSizeZInput = document.getElementById('dev-hs-size-z') as HTMLInputElement;
    this.hotspotUndoBtn = document.getElementById('dev-hotspot-undo') as HTMLButtonElement;
    this.hotspotRedoBtn = document.getElementById('dev-hotspot-redo') as HTMLButtonElement;
    this.itemPicker = document.getElementById('dev-item-picker') as HTMLSelectElement;
    this.examineTitleInput = document.getElementById('dev-examine-title') as HTMLInputElement;
    this.examineBodyInput = document.getElementById('dev-examine-body') as HTMLTextAreaElement;
    this.examineThoughtInput = document.getElementById('dev-examine-thought') as HTMLTextAreaElement;
    this.examineThoughtHintEl = document.getElementById('dev-examine-thought-hint');
    this.openingThoughtInput = document.getElementById('dev-opening-thought') as HTMLTextAreaElement;
    this.wakeThoughtInput = document.getElementById('dev-wake-thought') as HTMLTextAreaElement;
    this.wakeThoughtSectionEl = document.getElementById('dev-wake-thought-section');
    this.itemLabelInput = document.getElementById('dev-item-label') as HTMLInputElement;
    this.itemDescInput = document.getElementById('dev-item-description') as HTMLTextAreaElement;
    this.levelLabelEl = document.getElementById('dev-level-label');
    this.layoutHintEl = document.getElementById('dev-layout-save-hint');
    this.contentHintEl = document.getElementById('dev-content-save-hint');
    this.itemSectionEl = document.getElementById('dev-item-section');

    this.populateContentPickers();
    this.populateHotspotLayoutPicker();
    this.hotspotPicker?.addEventListener('change', () => {
      if (this.hotspotPicker?.value) this.selectHotspot(this.hotspotPicker.value);
    });
    this.hotspotLayoutPicker?.addEventListener('change', () => {
      if (this.hotspotLayoutPicker?.value) this.selectLayoutHotspot(this.hotspotLayoutPicker.value);
      else this.deselectHotspotLayout();
    });

    this.wireNudge('dev-hs-x-dec', 'dev-hs-x-inc', 'x', 'hotspot-pos');
    this.wireNudge('dev-hs-y-dec', 'dev-hs-y-inc', 'y', 'hotspot-pos');
    this.wireNudge('dev-hs-z-dec', 'dev-hs-z-inc', 'z', 'hotspot-pos');
    this.wireNudge('dev-hs-sx-dec', 'dev-hs-sx-inc', 'x', 'hotspot-size');
    this.wireNudge('dev-hs-sy-dec', 'dev-hs-sy-inc', 'y', 'hotspot-size');
    this.wireNudge('dev-hs-sz-dec', 'dev-hs-sz-inc', 'z', 'hotspot-size');

    const triggerHotspotChange = () => this.applyHotspotInputs();
    this.hsPosXInput?.addEventListener('change', triggerHotspotChange);
    this.hsPosYInput?.addEventListener('change', triggerHotspotChange);
    this.hsPosZInput?.addEventListener('change', triggerHotspotChange);
    this.hsSizeXInput?.addEventListener('change', triggerHotspotChange);
    this.hsSizeYInput?.addEventListener('change', triggerHotspotChange);
    this.hsSizeZInput?.addEventListener('change', triggerHotspotChange);

    document.getElementById('dev-hotspot-save-layout')?.addEventListener('click', () => this.saveLayoutToDisk());
    document.getElementById('dev-hotspot-copy-json')?.addEventListener('click', () => this.copyJson());
    document.getElementById('dev-hotspot-reset-layout')?.addEventListener('click', () => this.resetLayout());
    this.hotspotUndoBtn?.addEventListener('click', () => this.undo());
    this.hotspotRedoBtn?.addEventListener('click', () => this.redo());
    this.itemPicker?.addEventListener('change', () => {
      const itemId = this.itemPicker?.value ?? '';
      if (itemId) {
        if (this.contentNameEl) {
          this.contentNameEl.textContent = `Item: ${itemId}`;
        }
        this.loadItemFields(itemId);
      } else {
        this.clearItemFields();
        if (this.contentNameEl) {
          this.contentNameEl.textContent = this.selectedHotspotId ?? 'None';
        }
      }
    });
    document.getElementById('dev-apply-content')?.addEventListener('click', () => this.applyContent());
    document.getElementById('dev-save-content')?.addEventListener('click', () => this.saveContent());
    document.getElementById('dev-copy-content')?.addEventListener('click', () => this.copyContentJson());
    document.getElementById('dev-reset-content')?.addEventListener('click', () => this.resetContent());

    this.layoutModeTab?.addEventListener('click', () => this.setEditMode('layout'));
    this.hotspotsModeTab?.addEventListener('click', () => this.setEditMode('hotspots'));
    this.textModeTab?.addEventListener('click', () => this.setEditMode('text'));
  }

  private setEditMode(mode: EditMode): void {
    if (this.editMode === mode) return;
    this.editMode = mode;

    if (mode === 'layout') {
      this.deselectContent();
      this.deselectHotspotLayout();
    } else if (mode === 'hotspots') {
      this.deselectLayout();
      this.deselectContent();
      this.populateHotspotLayoutPicker();
    } else {
      this.deselectLayout();
      this.deselectHotspotLayout();
    }

    this.layoutSectionEl?.classList.toggle('hidden', mode !== 'layout');
    this.hotspotsSectionEl?.classList.toggle('hidden', mode !== 'hotspots');
    this.contentSectionEl?.classList.toggle('hidden', mode !== 'text');
    this.layoutModeTab?.classList.toggle('active', mode === 'layout');
    this.hotspotsModeTab?.classList.toggle('active', mode === 'hotspots');
    this.textModeTab?.classList.toggle('active', mode === 'text');
    this.layoutModeTab?.setAttribute('aria-selected', mode === 'layout' ? 'true' : 'false');
    this.hotspotsModeTab?.setAttribute('aria-selected', mode === 'hotspots' ? 'true' : 'false');
    this.textModeTab?.setAttribute('aria-selected', mode === 'text' ? 'true' : 'false');

    if (this.modeIndicatorEl) {
      const labels: Record<EditMode, string> = {
        layout: 'Layout',
        hotspots: 'Hotspots',
        text: 'Text',
      };
      this.modeIndicatorEl.textContent = labels[mode];
    }

    if (mode === 'text') {
      this.loadRoomContentFields();
    }

    this.updateHotspotDebugVisibility();
  }

  private updateHotspotDebugVisibility(): void {
    const showHotspots = this.active && (this.editMode === 'text' || this.editMode === 'hotspots');
    for (const hs of this.room.hotspots) {
      hs.setVisibleDebug(showHotspots);
    }
  }

  private wireNudge(
    decId: string,
    incId: string,
    axis: 'x' | 'y' | 'z' | 'ry',
    target: 'prop' | 'hotspot-pos' | 'hotspot-size' = 'prop',
  ): void {
    const step = axis === 'ry' ? 15 : 0.05;
    document.getElementById(decId)?.addEventListener('click', () => {
      if (target === 'prop') this.nudge(axis, -step);
      else if (target === 'hotspot-pos') this.nudgeHotspotPosition(axis as 'x' | 'y' | 'z', -step);
      else this.nudgeHotspotSize(axis as 'x' | 'y' | 'z', -step);
    });
    document.getElementById(incId)?.addEventListener('click', () => {
      if (target === 'prop') this.nudge(axis, step);
      else if (target === 'hotspot-pos') this.nudgeHotspotPosition(axis as 'x' | 'y' | 'z', step);
      else this.nudgeHotspotSize(axis as 'x' | 'y' | 'z', step);
    });
  }

  isActive(): boolean {
    return this.active;
  }

  setRoom(room: RoomBuilder): void {
    this.room = room;
    if (isDevLevelId(room.roomId)) {
      this.bindLevel(room.roomId);
    }
    if (this.active) this.updateHotspotDebugVisibility();
  }

  private bindLevel(roomId: DevLevelId): void {
    this.roomId = roomId;
    setDevContentRoom(roomId);

    const level = getDevLevel(roomId);
    if (!level) return;

    this.hotspotItemMap = new Map(
      level.puzzleHotspots
        .filter((h): h is typeof h & { id: string; item: string } => Boolean(h.id && h.item))
        .map((h) => [h.id, h.item]),
    );

    if (this.levelLabelEl) {
      this.levelLabelEl.textContent = level.title;
    }
    if (this.layoutHintEl) {
      this.layoutHintEl.innerHTML = `Save Layout writes to <code>${level.roomPath}</code> (local dev server).`;
    }
    if (this.contentHintEl) {
      const itemsHint = level.supportsItems && level.itemsPath
        ? ` and <code>${level.itemsPath}</code>`
        : '';
      this.contentHintEl.innerHTML = `Save Text writes to <code>${level.storyPath}</code>${itemsHint}.`;
    }
    if (this.itemSectionEl) {
      this.itemSectionEl.classList.toggle('hidden', !level.supportsItems);
    }

    this.deselectAll();
    this.undoStack = [];
    this.redoStack = [];
    this.updateHistoryButtons();
    this.populateContentPickers();
    this.populateHotspotLayoutPicker();
    this.loadRoomContentFields();
  }

  setActive(active: boolean): void {
    if (this.active === active) return;

    if (active && !isDevLevelId(this.room.roomId)) {
      alert(`Dev Mode is not available in "${this.room.roomId}".`);
      return;
    }

    this.active = active;

    if (active) {
      this.editMode = 'layout';
      this.layoutSectionEl?.classList.remove('hidden');
      this.hotspotsSectionEl?.classList.add('hidden');
      this.contentSectionEl?.classList.add('hidden');
      this.layoutModeTab?.classList.add('active');
      this.hotspotsModeTab?.classList.remove('active');
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
    if (this.editMode === 'hotspots') {
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

      if (!this.selectedLayoutHotspotId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const moveStep = e.shiftKey ? 0.01 : 0.05;
      const sizeStep = e.shiftKey ? 0.01 : 0.05;

      switch (e.key) {
        case 'ArrowLeft':
          this.nudgeHotspotPosition('x', -moveStep);
          e.preventDefault();
          break;
        case 'ArrowRight':
          this.nudgeHotspotPosition('x', moveStep);
          e.preventDefault();
          break;
        case 'ArrowUp':
          this.nudgeHotspotPosition('z', -moveStep);
          e.preventDefault();
          break;
        case 'ArrowDown':
          this.nudgeHotspotPosition('z', moveStep);
          e.preventDefault();
          break;
        case 'PageUp':
          this.nudgeHotspotPosition('y', moveStep);
          e.preventDefault();
          break;
        case 'PageDown':
          this.nudgeHotspotPosition('y', -moveStep);
          e.preventDefault();
          break;
        case '[':
          this.nudgeHotspotSize('x', -sizeStep);
          e.preventDefault();
          break;
        case ']':
          this.nudgeHotspotSize('x', sizeStep);
          e.preventDefault();
          break;
        case '{':
          this.nudgeHotspotSize('y', -sizeStep);
          e.preventDefault();
          break;
        case '}':
          this.nudgeHotspotSize('y', sizeStep);
          e.preventDefault();
          break;
        case '-':
          this.nudgeHotspotSize('z', -sizeStep);
          e.preventDefault();
          break;
        case '=':
        case '+':
          this.nudgeHotspotSize('z', sizeStep);
          e.preventDefault();
          break;
        case 'Escape':
          this.deselectHotspotLayout();
          e.preventDefault();
          break;
      }
      return;
    }

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

    if (this.editMode === 'hotspots') {
      raycaster.layers.set(1);
      raycaster.setFromCamera(mouse, this.camera);
      const hotspotHits = raycaster.intersectObjects(
        this.room.hotspots.map((h) => h.mesh),
        false,
      );
      if (hotspotHits.length > 0) {
        const hotspotId = hotspotHits[0].object.userData.hotspotId as string;
        this.selectLayoutHotspot(hotspotId);
        return;
      }
      if (!toggle) {
        this.deselectHotspotLayout();
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
    this.deselectHotspotLayout();
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

  private deselectHotspotLayout(): void {
    this.selectedLayoutHotspotId = null;
    if (this.hotspotLayoutPicker) this.hotspotLayoutPicker.value = '';
    if (this.hotspotLayoutNameEl) this.hotspotLayoutNameEl.textContent = 'None';
    if (this.hotspotBoxHelper) {
      this.scene.remove(this.hotspotBoxHelper);
      this.hotspotBoxHelper = null;
    }
    this.updateHotspotLayoutUIFields();
  }

  private selectLayoutHotspot(hotspotId: string): void {
    this.selectedLayoutHotspotId = hotspotId;
    if (this.hotspotLayoutPicker) this.hotspotLayoutPicker.value = hotspotId;
    if (this.hotspotLayoutNameEl) {
      const hs = this.room.hotspotsData.find((h) => h.id === hotspotId);
      this.hotspotLayoutNameEl.textContent = hs?.label ? `${hotspotId} (${hs.label})` : hotspotId;
    }

    const hs = this.room.hotspots.find((h) => h.id === hotspotId);
    if (hs) {
      if (this.hotspotBoxHelper) {
        this.scene.remove(this.hotspotBoxHelper);
      }
      this.hotspotBoxHelper = new THREE.BoxHelper(hs.mesh, 0xff8800);
      this.scene.add(this.hotspotBoxHelper);
    }

    this.updateHotspotLayoutUIFields();
  }

  private updateHotspotLayoutUIFields(): void {
    const hsData = this.selectedLayoutHotspotId
      ? this.room.hotspotsData.find((h) => h.id === this.selectedLayoutHotspotId)
      : null;

    const setField = (input: HTMLInputElement | null, value: string, enabled: boolean) => {
      if (!input) return;
      input.disabled = !enabled;
      input.value = value;
    };

    if (hsData) {
      setField(this.hsPosXInput, hsData.position[0].toFixed(2), true);
      setField(this.hsPosYInput, hsData.position[1].toFixed(2), true);
      setField(this.hsPosZInput, hsData.position[2].toFixed(2), true);
      setField(this.hsSizeXInput, hsData.size[0].toFixed(2), true);
      setField(this.hsSizeYInput, hsData.size[1].toFixed(2), true);
      setField(this.hsSizeZInput, hsData.size[2].toFixed(2), true);
    } else {
      setField(this.hsPosXInput, '0.00', false);
      setField(this.hsPosYInput, '0.00', false);
      setField(this.hsPosZInput, '0.00', false);
      setField(this.hsSizeXInput, '0.00', false);
      setField(this.hsSizeYInput, '0.00', false);
      setField(this.hsSizeZInput, '0.00', false);
    }
  }

  private nudgeHotspotPosition(axis: 'x' | 'y' | 'z', amount: number): void {
    if (!this.selectedLayoutHotspotId) return;
    const hsData = this.room.hotspotsData.find((h) => h.id === this.selectedLayoutHotspotId);
    if (!hsData) return;

    this.pushHistory();
    if (axis === 'x') hsData.position[0] += amount;
    else if (axis === 'y') hsData.position[1] += amount;
    else hsData.position[2] += amount;

    this.applyHotspotVisual(this.selectedLayoutHotspotId);
    this.updateHotspotLayoutUIFields();
    this.persistLayoutDraft();
  }

  private nudgeHotspotSize(axis: 'x' | 'y' | 'z', amount: number): void {
    if (!this.selectedLayoutHotspotId) return;
    const hsData = this.room.hotspotsData.find((h) => h.id === this.selectedLayoutHotspotId);
    if (!hsData) return;

    this.pushHistory();
    const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    hsData.size[idx] = Math.max(0.05, hsData.size[idx] + amount);

    this.applyHotspotVisual(this.selectedLayoutHotspotId);
    this.updateHotspotLayoutUIFields();
    this.persistLayoutDraft();
  }

  private applyHotspotInputs(): void {
    if (!this.selectedLayoutHotspotId) return;
    const hsData = this.room.hotspotsData.find((h) => h.id === this.selectedLayoutHotspotId);
    if (!hsData) return;

    const x = parseFloat(this.hsPosXInput?.value ?? '0');
    const y = parseFloat(this.hsPosYInput?.value ?? '0');
    const z = parseFloat(this.hsPosZInput?.value ?? '0');
    const sx = parseFloat(this.hsSizeXInput?.value ?? '0');
    const sy = parseFloat(this.hsSizeYInput?.value ?? '0');
    const sz = parseFloat(this.hsSizeZInput?.value ?? '0');

    const changed =
      (!isNaN(x) && x !== hsData.position[0]) ||
      (!isNaN(y) && y !== hsData.position[1]) ||
      (!isNaN(z) && z !== hsData.position[2]) ||
      (!isNaN(sx) && sx !== hsData.size[0]) ||
      (!isNaN(sy) && sy !== hsData.size[1]) ||
      (!isNaN(sz) && sz !== hsData.size[2]);

    if (!changed) return;

    this.pushHistory();
    if (!isNaN(x)) hsData.position[0] = x;
    if (!isNaN(y)) hsData.position[1] = y;
    if (!isNaN(z)) hsData.position[2] = z;
    if (!isNaN(sx)) hsData.size[0] = Math.max(0.05, sx);
    if (!isNaN(sy)) hsData.size[1] = Math.max(0.05, sy);
    if (!isNaN(sz)) hsData.size[2] = Math.max(0.05, sz);

    this.applyHotspotVisual(this.selectedLayoutHotspotId);
    this.updateHotspotLayoutUIFields();
    this.persistLayoutDraft();
  }

  private applyHotspotVisual(hotspotId: string): void {
    const hsData = this.room.hotspotsData.find((h) => h.id === hotspotId);
    const hs = this.room.hotspots.find((h) => h.id === hotspotId);
    if (!hsData || !hs) return;

    hs.setSize(hsData.size);
    this.applyTransformToHotspotMesh(hs.mesh, hsData);
    if (this.hotspotBoxHelper && this.selectedLayoutHotspotId === hotspotId) {
      this.hotspotBoxHelper.update();
    }
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
      position: [...h.position] as [number, number, number],
      size: [...h.size] as [number, number, number],
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
      position: [...h.position] as [number, number, number],
      size: [...h.size] as [number, number, number],
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
      position: [...h.position] as [number, number, number],
      size: [...h.size] as [number, number, number],
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
        hsData.size = [...savedHs.size];
        this.applyHotspotVisual(savedHs.id);
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
    this.updateHotspotLayoutUIFields();
    this.updateHistoryButtons();
  }

  private updateHistoryButtons(): void {
    const canUndo = this.undoStack.length > 0;
    const canRedo = this.redoStack.length > 0;
    if (this.undoBtn) this.undoBtn.disabled = !canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !canRedo;
    if (this.hotspotUndoBtn) this.hotspotUndoBtn.disabled = !canUndo;
    if (this.hotspotRedoBtn) this.hotspotRedoBtn.disabled = !canRedo;
  }

  private persistLayoutDraft(): void {
    localStorage.setItem(
      layoutStorageKey(this.roomId),
      JSON.stringify({
        props: this.room.propsData,
        hotspots: this.room.hotspotsData,
        lighting: this.room.lightingData,
      }),
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
    const level = getDevLevel(this.roomId);
    if (!level) return;

    if (!confirm(`Save layout to ${level.roomPath}? This overwrites the file on disk.`)) {
      return;
    }

    const result = await saveLayoutToRepo(this.room);
    alert(result.message);
    if (result.ok && result.method === 'api') {
      location.reload();
    }
  }

  private resetLayout(): void {
    if (confirm('Are you sure you want to reset all custom layout placements for this level?')) {
      localStorage.removeItem(layoutStorageKey(this.roomId));
      location.reload();
    }
  }

  private populateHotspotLayoutPicker(): void {
    if (!this.hotspotLayoutPicker) return;
    const current = this.selectedLayoutHotspotId ?? '';
    this.hotspotLayoutPicker.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— select hotspot —';
    this.hotspotLayoutPicker.appendChild(blank);
    for (const hs of this.room.hotspotsData) {
      const opt = document.createElement('option');
      opt.value = hs.id;
      opt.textContent = hs.label ? `${hs.id} (${hs.label})` : hs.id;
      this.hotspotLayoutPicker.appendChild(opt);
    }
    this.hotspotLayoutPicker.value = current;
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
      if (getDevLevel(this.roomId)?.supportsItems) {
        for (const itemId of listItemIds()) {
          const opt = document.createElement('option');
          opt.value = itemId;
          opt.textContent = itemId;
          this.itemPicker.appendChild(opt);
        }
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

  private loadRoomContentFields(): void {
    const level = getDevLevel(this.roomId);
    if (this.openingThoughtInput) {
      this.openingThoughtInput.value =
        getOpeningThoughtOverride() ?? getBaseOpeningThought(this.roomId);
    }
    if (this.wakeThoughtSectionEl) {
      this.wakeThoughtSectionEl.classList.toggle('hidden', !level?.afterIntroThoughtKey);
    }
    if (this.wakeThoughtInput && level?.afterIntroThoughtKey) {
      this.wakeThoughtInput.value =
        getWakeThoughtOverride() ?? getBaseWakeThought(this.roomId);
    }
  }

  private loadContentFields(hotspotId: string): void {
    const base = getBaseExamine(hotspotId, this.roomId);
    const ov = getExamineOverride(hotspotId);
    const thoughtKey = getExamineThoughtKey(hotspotId, this.roomId);

    if (this.examineTitleInput) {
      this.examineTitleInput.value = ov?.title ?? base?.title ?? '';
    }
    if (this.examineBodyInput) {
      this.examineBodyInput.value = ov?.body ?? base?.body ?? '';
    }
    if (this.examineThoughtInput) {
      this.examineThoughtInput.value =
        ov?.thought ?? getBaseThoughtForExamine(hotspotId, this.roomId);
    }
    if (this.examineThoughtHintEl) {
      if (!base) {
        this.examineThoughtHintEl.textContent =
          'No story entry for this hotspot yet. Save Text creates one on disk.';
      } else if (thoughtKey) {
        this.examineThoughtHintEl.textContent =
          `Linked in story as "${thoughtKey}" under thoughts. Shown once on first examine.`;
      } else {
        this.examineThoughtHintEl.textContent =
          'This hotspot has no first-examine inner voice in the story file yet.';
      }
    }

    const linkedItem = this.hotspotItemMap.get(hotspotId);
    if (linkedItem && this.itemPicker && getDevLevel(this.roomId)?.supportsItems) {
      this.itemPicker.value = linkedItem;
      this.loadItemFields(linkedItem);
    } else {
      this.clearItemFields();
      if (this.itemPicker) this.itemPicker.value = '';
    }
  }

  private loadItemFields(itemId: string): void {
    if (!itemId) {
      this.clearItemFields();
      return;
    }
    const base = getBaseItem(itemId);
    const ov = getItemOverride(itemId);
    if (this.itemLabelInput) {
      this.itemLabelInput.value = ov?.label ?? base?.label ?? '';
    }
    if (this.itemDescInput) {
      this.itemDescInput.value = ov?.description ?? base?.description ?? '';
    }
  }

  private clearItemFields(): void {
    if (this.itemLabelInput) this.itemLabelInput.value = '';
    if (this.itemDescInput) this.itemDescInput.value = '';
  }

  private applyContent(): void {
    this.applyContentToOverrides();
    alert('Text preview saved to localStorage. Play-test to preview.');
  }

  private applyContentToOverrides(): void {
    if (this.openingThoughtInput) {
      setOpeningThoughtOverride(this.openingThoughtInput.value);
    }
    if (this.wakeThoughtInput && getDevLevel(this.roomId)?.afterIntroThoughtKey) {
      setWakeThoughtOverride(this.wakeThoughtInput.value);
    }

    if (this.selectedHotspotId) {
      setExamineOverride(this.selectedHotspotId, {
        title: this.examineTitleInput?.value ?? '',
        body: this.examineBodyInput?.value ?? '',
        thought: this.examineThoughtInput?.value ?? '',
      });
    }

    const itemId = this.itemPicker?.value;
    if (itemId && getDevLevel(this.roomId)?.supportsItems) {
      setItemOverride(itemId, {
        label: this.itemLabelInput?.value ?? '',
        description: this.itemDescInput?.value ?? '',
      });
    }
  }

  private async saveContent(): Promise<void> {
    this.applyContentToOverrides();

    const level = getDevLevel(this.roomId);
    if (!level) return;

    const itemsHint = level.supportsItems && level.itemsPath
      ? ` and ${level.itemsPath}`
      : '';
    if (
      !confirm(
        `Save text to ${level.storyPath}${itemsHint}? This overwrites those files on disk.`,
      )
    ) {
      return;
    }

    const result = await saveContentToRepo(this.roomId);
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
    if (!confirm(`Reset all dev text overrides for ${getDevLevel(this.roomId)?.title ?? this.roomId}?`)) return;
    clearContentOverrides(this.roomId);
    this.loadRoomContentFields();
    if (this.selectedHotspotId) {
      this.loadContentFields(this.selectedHotspotId);
    }
    if (this.itemPicker?.value && getDevLevel(this.roomId)?.supportsItems) {
      this.loadItemFields(this.itemPicker.value);
    }
    alert('Text overrides cleared for this level.');
  }
}
