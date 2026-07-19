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
import type { IsoCamera } from '../scene/IsoCamera';
import {
  applyCameraShot,
  type CameraShotDef,
  type CameraShotLock,
} from '../scene/CameraShots';

const RELATIONSHIPS: Record<string, { props: string[]; hotspots: string[]; lights: string[] }> = {
  BedFrame: {
    props: ['Mattress', 'Pillow', 'BedsideLamp', 'CalendarScrap'],
    hotspots: ['bed', 'calendar_scrap'],
    lights: []
  },
  Desk: {
    props: ['LampBase', 'LampShade', 'Sketchbook', 'DeskMug', 'CrowFigurine'],
    hotspots: ['desk', 'desk_drawer', 'sketchbook', 'lamp'],
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
    props: ['CrowFigurine', 'NightstandReadingLight'],
    hotspots: ['nightstand', 'key_handle'],
    lights: ['reading_lamp'],
  },
  NightstandReadingLight: {
    props: [],
    hotspots: ['nightstand'],
    lights: ['reading_lamp'],
  },
  Wardrobe: {
    props: ['WardrobeDoor', 'WardrobeTypewriter', 'CabinetLampLeft', 'CabinetLampRight'],
    hotspots: ['wardrobe', 'cipher_disk_pickup', 'stillpoint_letter'],
    lights: ['cabinet_lamp_left', 'cabinet_lamp_right'],
  },
  CabinetLampLeft: {
    props: [],
    hotspots: [],
    lights: ['cabinet_lamp_left'],
  },
  CabinetLampRight: {
    props: [],
    hotspots: [],
    lights: ['cabinet_lamp_right'],
  },
  WardrobeTypewriter: {
    props: [],
    hotspots: [],
    lights: [],
  },
  CorkBoard: {
    props: ['RedYarnBall', 'CorkBoardClutter'],
    hotspots: ['cork_board'],
    lights: [],
  },
  RedYarnBall: {
    props: [],
    hotspots: [],
    lights: [],
  },
  CorkBoardClutter: {
    props: [],
    hotspots: [],
    lights: [],
  },
  WallNotes: {
    props: [],
    hotspots: ['wall_notes'],
    lights: []
  },
  WallBookcase: {
    props: [],
    hotspots: ['bookshelf'],
    lights: []
  },
  WindowFrame: {
    props: ['WindowGlass'],
    hotspots: ['window'],
    lights: ['window'],
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
  },
  BedsideLamp: {
    props: [],
    hotspots: [],
    lights: [],
  },
};

type HistoryState = {
  props: Array<{
    id: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
  }>;
  hotspots: Array<{
    id: string;
    position: [number, number, number];
    size: [number, number, number];
  }>;
  lighting: Record<string, {
    position: [number, number, number];
    color: string;
    energy: number;
  }>;
  floor: {
    position: [number, number, number];
    size: [number, number, number];
  };
  floor_upper: {
    position: [number, number, number];
    size: [number, number, number];
  } | null;
};

const FLOOR_PICKER_VALUE = '__floor__';
const UPPER_FLOOR_PICKER_VALUE = '__floor_upper__';
type FloorEditId = 'main' | 'upper';

type EditMode = 'layout' | 'hotspots' | 'lighting' | 'camera' | 'text';

export class DevMover {
  private active = false;
  private editMode: EditMode = 'layout';
  private roomId: DevLevelId = 'bedroom';
  private hotspotItemMap = new Map<string, string>();
  // Selection state
  private selectedProps = new Map<string, THREE.Object3D>(); // id -> mesh
  private boxHelpers = new Map<string, THREE.BoxHelper>(); // id -> BoxHelper
  private selectedFloorId: FloorEditId | null = null;

  // History state
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];
  private maxHistory = 50;

  // DOM cache
  private panelEl: HTMLElement | null = null;
  private modeIndicatorEl: HTMLElement | null = null;
  private layoutSectionEl: HTMLElement | null = null;
  private hotspotsSectionEl: HTMLElement | null = null;
  private lightingSectionEl: HTMLElement | null = null;
  private cameraSectionEl: HTMLElement | null = null;
  private contentSectionEl: HTMLElement | null = null;
  private layoutModeTab: HTMLButtonElement | null = null;
  private hotspotsModeTab: HTMLButtonElement | null = null;
  private lightingModeTab: HTMLButtonElement | null = null;
  private cameraModeTab: HTMLButtonElement | null = null;
  private textModeTab: HTMLButtonElement | null = null;
  private nameEl: HTMLElement | null = null;
  private contentNameEl: HTMLElement | null = null;
  private posXInput: HTMLInputElement | null = null;
  private posYInput: HTMLInputElement | null = null;
  private posZInput: HTMLInputElement | null = null;
  private rotXInput: HTMLInputElement | null = null;
  private rotYInput: HTMLInputElement | null = null;
  private rotZInput: HTMLInputElement | null = null;
  private scaleInput: HTMLInputElement | null = null;
  private propOrientGroupEl: HTMLElement | null = null;
  private floorSizeGroupEl: HTMLElement | null = null;
  private floorSizeXInput: HTMLInputElement | null = null;
  private floorSizeYInput: HTMLInputElement | null = null;
  private floorSizeZInput: HTMLInputElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;

  private selectedHotspotId: string | null = null;
  private selectedLayoutHotspotId: string | null = null;
  private hotspotBoxHelper: THREE.BoxHelper | null = null;
  private hotspotPicker: HTMLSelectElement | null = null;
  private hotspotLayoutPicker: HTMLSelectElement | null = null;
  private hotspotLayoutNameEl: HTMLElement | null = null;
  private propLayoutPicker: HTMLSelectElement | null = null;
  private hsPosXInput: HTMLInputElement | null = null;
  private hsPosYInput: HTMLInputElement | null = null;
  private hsPosZInput: HTMLInputElement | null = null;
  private hsSizeXInput: HTMLInputElement | null = null;
  private hsSizeYInput: HTMLInputElement | null = null;
  private hsSizeZInput: HTMLInputElement | null = null;
  private hotspotUndoBtn: HTMLButtonElement | null = null;
  private hotspotRedoBtn: HTMLButtonElement | null = null;
  private selectedLightId: string | null = null;
  private lightPicker: HTMLSelectElement | null = null;
  private lightNameEl: HTMLElement | null = null;
  private lightColorInput: HTMLInputElement | null = null;
  private lightColorHexInput: HTMLInputElement | null = null;
  private lightEnergyRange: HTMLInputElement | null = null;
  private lightEnergyValInput: HTMLInputElement | null = null;
  private lightUndoBtn: HTMLButtonElement | null = null;
  private lightRedoBtn: HTMLButtonElement | null = null;
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

  private selectedCameraShotId: string | null = null;
  private cameraShotPicker: HTMLSelectElement | null = null;
  private camTargetXInput: HTMLInputElement | null = null;
  private camTargetYInput: HTMLInputElement | null = null;
  private camTargetZInput: HTMLInputElement | null = null;
  private camSizeInput: HTMLInputElement | null = null;
  private camPitchInput: HTMLInputElement | null = null;
  private camYawInput: HTMLInputElement | null = null;
  private camFollowYawInput: HTMLInputElement | null = null;
  private camDampInput: HTMLInputElement | null = null;
  private camLockSelect: HTMLSelectElement | null = null;
  private camLockHintEl: HTMLElement | null = null;
  private suppressCameraInput = false;

  // Event handler bounds
  private clickHandlerBound = this.handleClick.bind(this);
  private keydownHandlerBound = this.handleKeyDown.bind(this);

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private room: RoomBuilder,
    private canvas: HTMLCanvasElement,
    private onToggled: (active: boolean) => void,
    private isoCamera: IsoCamera,
  ) {
    this.initDOM();
  }

  private initDOM(): void {
    this.panelEl = document.getElementById('dev-panel');
    this.modeIndicatorEl = document.getElementById('dev-mode-indicator');
    this.layoutSectionEl = document.getElementById('dev-layout-section');
    this.hotspotsSectionEl = document.getElementById('dev-hotspots-section');
    this.lightingSectionEl = document.getElementById('dev-lighting-section');
    this.cameraSectionEl = document.getElementById('dev-camera-section');
    this.contentSectionEl = document.getElementById('dev-content-section');
    this.layoutModeTab = document.getElementById('dev-mode-layout') as HTMLButtonElement;
    this.hotspotsModeTab = document.getElementById('dev-mode-hotspots') as HTMLButtonElement;
    this.lightingModeTab = document.getElementById('dev-mode-lighting') as HTMLButtonElement;
    this.cameraModeTab = document.getElementById('dev-mode-camera') as HTMLButtonElement;
    this.textModeTab = document.getElementById('dev-mode-text') as HTMLButtonElement;
    this.nameEl = document.getElementById('dev-selected-name');
    this.contentNameEl = document.getElementById('dev-content-selected-name');
    this.posXInput = document.getElementById('dev-pos-x') as HTMLInputElement;
    this.posYInput = document.getElementById('dev-pos-y') as HTMLInputElement;
    this.posZInput = document.getElementById('dev-pos-z') as HTMLInputElement;
    this.rotXInput = document.getElementById('dev-rot-x') as HTMLInputElement;
    this.rotYInput = document.getElementById('dev-rot-y') as HTMLInputElement;
    this.rotZInput = document.getElementById('dev-rot-z') as HTMLInputElement;
    this.scaleInput = document.getElementById('dev-scale') as HTMLInputElement;
    this.propOrientGroupEl = document.getElementById('dev-prop-orient-group');
    this.floorSizeGroupEl = document.getElementById('dev-floor-size-group');
    this.floorSizeXInput = document.getElementById('dev-floor-size-x') as HTMLInputElement;
    this.floorSizeYInput = document.getElementById('dev-floor-size-y') as HTMLInputElement;
    this.floorSizeZInput = document.getElementById('dev-floor-size-z') as HTMLInputElement;
    this.undoBtn = document.getElementById('dev-undo') as HTMLButtonElement;
    this.redoBtn = document.getElementById('dev-redo') as HTMLButtonElement;

    // Register UI nudge buttons
    this.wireNudge('dev-x-dec', 'dev-x-inc', 'x');
    this.wireNudge('dev-y-dec', 'dev-y-inc', 'y');
    this.wireNudge('dev-z-dec', 'dev-z-inc', 'z');
    this.wireNudge('dev-rx-dec', 'dev-rx-inc', 'rx');
    this.wireNudge('dev-ry-dec', 'dev-ry-inc', 'ry');
    this.wireNudge('dev-rz-dec', 'dev-rz-inc', 'rz');
    this.wireNudge('dev-scale-dec', 'dev-scale-inc', 's');
    this.wireNudge('dev-floor-sx-dec', 'dev-floor-sx-inc', 'x', 'floor-size');
    this.wireNudge('dev-floor-sy-dec', 'dev-floor-sy-inc', 'y', 'floor-size');
    this.wireNudge('dev-floor-sz-dec', 'dev-floor-sz-inc', 'z', 'floor-size');

    // Register input field change listeners
    const triggerChange = () => this.applyInputs();
    this.posXInput?.addEventListener('change', triggerChange);
    this.posYInput?.addEventListener('change', triggerChange);
    this.posZInput?.addEventListener('change', triggerChange);
    this.rotXInput?.addEventListener('change', triggerChange);
    this.rotYInput?.addEventListener('change', triggerChange);
    this.rotZInput?.addEventListener('change', triggerChange);
    this.scaleInput?.addEventListener('change', triggerChange);
    const triggerFloorSizeChange = () => this.applyFloorSizeInputs();
    this.floorSizeXInput?.addEventListener('change', triggerFloorSizeChange);
    this.floorSizeYInput?.addEventListener('change', triggerFloorSizeChange);
    this.floorSizeZInput?.addEventListener('change', triggerFloorSizeChange);

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
    this.propLayoutPicker = document.getElementById('dev-prop-layout-picker') as HTMLSelectElement;
    this.hsPosXInput = document.getElementById('dev-hs-pos-x') as HTMLInputElement;
    this.hsPosYInput = document.getElementById('dev-hs-pos-y') as HTMLInputElement;
    this.hsPosZInput = document.getElementById('dev-hs-pos-z') as HTMLInputElement;
    this.hsSizeXInput = document.getElementById('dev-hs-size-x') as HTMLInputElement;
    this.hsSizeYInput = document.getElementById('dev-hs-size-y') as HTMLInputElement;
    this.hsSizeZInput = document.getElementById('dev-hs-size-z') as HTMLInputElement;
    this.hotspotUndoBtn = document.getElementById('dev-hotspot-undo') as HTMLButtonElement;
    this.hotspotRedoBtn = document.getElementById('dev-hotspot-redo') as HTMLButtonElement;
    this.lightPicker = document.getElementById('dev-light-picker') as HTMLSelectElement;
    this.lightNameEl = document.getElementById('dev-light-name');
    this.lightColorInput = document.getElementById('dev-light-color') as HTMLInputElement;
    this.lightColorHexInput = document.getElementById('dev-light-color-hex') as HTMLInputElement;
    this.lightEnergyRange = document.getElementById('dev-light-energy') as HTMLInputElement;
    this.lightEnergyValInput = document.getElementById('dev-light-energy-val') as HTMLInputElement;
    this.lightUndoBtn = document.getElementById('dev-light-undo') as HTMLButtonElement;
    this.lightRedoBtn = document.getElementById('dev-light-redo') as HTMLButtonElement;
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
    this.populatePropLayoutPicker();
    this.hotspotPicker?.addEventListener('change', () => {
      if (this.hotspotPicker?.value) this.selectHotspot(this.hotspotPicker.value);
    });
    this.hotspotLayoutPicker?.addEventListener('change', () => {
      if (this.hotspotLayoutPicker?.value) this.selectLayoutHotspot(this.hotspotLayoutPicker.value);
      else this.deselectHotspotLayout();
    });
    this.propLayoutPicker?.addEventListener('change', () => {
      const value = this.propLayoutPicker?.value ?? '';
      if (!value) {
        this.deselectLayout();
        return;
      }
      if (value === FLOOR_PICKER_VALUE) {
        this.selectFloor('main');
        return;
      }
      if (value === UPPER_FLOOR_PICKER_VALUE) {
        this.selectFloor('upper');
        return;
      }
      const option = this.propLayoutPicker?.selectedOptions[0];
      if (option?.dataset.kind === 'item') {
        const propId = this.propIdForItemHotspot(value);
        if (propId) {
          this.selectLayoutProp(propId);
        } else {
          if (this.propLayoutPicker) this.propLayoutPicker.value = '';
          this.setEditMode('hotspots');
          this.selectLayoutHotspot(value);
        }
        return;
      }
      this.selectLayoutProp(value);
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
    document.getElementById('dev-light-save-layout')?.addEventListener('click', () => this.saveLayoutToDisk());
    document.getElementById('dev-light-copy-json')?.addEventListener('click', () => this.copyJson());
    document.getElementById('dev-light-reset-layout')?.addEventListener('click', () => this.resetLayout());
    this.lightUndoBtn?.addEventListener('click', () => this.undo());
    this.lightRedoBtn?.addEventListener('click', () => this.redo());

    this.populateLightPicker();
    this.lightPicker?.addEventListener('change', () => {
      if (this.lightPicker?.value) this.selectLight(this.lightPicker.value);
      else this.deselectLight();
    });

    const applyLightingInputs = () => this.applyLightingInputs();
    this.lightColorInput?.addEventListener('input', () => {
      if (this.lightColorInput && this.lightColorHexInput) {
        this.lightColorHexInput.value = this.lightColorInput.value;
      }
      applyLightingInputs();
    });
    this.lightColorHexInput?.addEventListener('change', applyLightingInputs);
    this.lightEnergyRange?.addEventListener('input', () => {
      if (this.lightEnergyRange && this.lightEnergyValInput) {
        this.lightEnergyValInput.value = parseFloat(this.lightEnergyRange.value).toFixed(2);
      }
      applyLightingInputs();
    });
    this.lightEnergyValInput?.addEventListener('change', applyLightingInputs);
    document.getElementById('dev-light-energy-dec')?.addEventListener('click', () => this.nudgeLightEnergy(-0.05));
    document.getElementById('dev-light-energy-inc')?.addEventListener('click', () => this.nudgeLightEnergy(0.05));

    document.getElementById('dev-apply-content')?.addEventListener('click', () => this.applyContent());
    document.getElementById('dev-save-content')?.addEventListener('click', () => this.saveContent());
    document.getElementById('dev-copy-content')?.addEventListener('click', () => this.copyContentJson());
    document.getElementById('dev-reset-content')?.addEventListener('click', () => this.resetContent());

    this.initCameraDom();

    this.layoutModeTab?.addEventListener('click', () => this.setEditMode('layout'));
    this.hotspotsModeTab?.addEventListener('click', () => this.setEditMode('hotspots'));
    this.lightingModeTab?.addEventListener('click', () => this.setEditMode('lighting'));
    this.cameraModeTab?.addEventListener('click', () => this.setEditMode('camera'));
    this.textModeTab?.addEventListener('click', () => this.setEditMode('text'));
  }

  private initCameraDom(): void {
    this.cameraShotPicker = document.getElementById('dev-camera-shot-picker') as HTMLSelectElement;
    this.camTargetXInput = document.getElementById('dev-cam-target-x') as HTMLInputElement;
    this.camTargetYInput = document.getElementById('dev-cam-target-y') as HTMLInputElement;
    this.camTargetZInput = document.getElementById('dev-cam-target-z') as HTMLInputElement;
    this.camSizeInput = document.getElementById('dev-cam-size') as HTMLInputElement;
    this.camPitchInput = document.getElementById('dev-cam-pitch') as HTMLInputElement;
    this.camYawInput = document.getElementById('dev-cam-yaw') as HTMLInputElement;
    this.camFollowYawInput = document.getElementById('dev-cam-follow-yaw') as HTMLInputElement;
    this.camDampInput = document.getElementById('dev-cam-damp') as HTMLInputElement;
    this.camLockSelect = document.getElementById('dev-cam-lock') as HTMLSelectElement;
    this.camLockHintEl = document.getElementById('dev-camera-lock-hint');

    this.cameraShotPicker?.addEventListener('change', () => {
      const id = this.cameraShotPicker?.value ?? '';
      if (id) this.selectCameraShot(id);
    });

    const applyCam = () => this.applyCameraInputs();
    for (const input of [
      this.camTargetXInput,
      this.camTargetYInput,
      this.camTargetZInput,
      this.camSizeInput,
      this.camPitchInput,
      this.camYawInput,
      this.camDampInput,
    ]) {
      input?.addEventListener('change', applyCam);
      input?.addEventListener('blur', applyCam);
    }
    this.camFollowYawInput?.addEventListener('change', () => {
      if (this.camYawInput) this.camYawInput.disabled = !!this.camFollowYawInput?.checked;
      applyCam();
    });
    this.camLockSelect?.addEventListener('change', applyCam);

    this.wireCameraNudge('dev-cam-tx-dec', 'dev-cam-tx-inc', this.camTargetXInput, 0.05);
    this.wireCameraNudge('dev-cam-ty-dec', 'dev-cam-ty-inc', this.camTargetYInput, 0.05);
    this.wireCameraNudge('dev-cam-tz-dec', 'dev-cam-tz-inc', this.camTargetZInput, 0.05);
    this.wireCameraNudge('dev-cam-size-dec', 'dev-cam-size-inc', this.camSizeInput, 0.1);
    this.wireCameraNudge('dev-cam-pitch-dec', 'dev-cam-pitch-inc', this.camPitchInput, 1);
    this.wireCameraNudge('dev-cam-yaw-dec', 'dev-cam-yaw-inc', this.camYawInput, 5);
    this.wireCameraNudge('dev-cam-damp-dec', 'dev-cam-damp-inc', this.camDampInput, 0.5);

    document.getElementById('dev-camera-preview')?.addEventListener('click', () => this.previewCameraShot());
    document.getElementById('dev-camera-capture')?.addEventListener('click', () => this.captureCameraShot());
    document.getElementById('dev-camera-save-layout')?.addEventListener('click', () => this.saveCameraLayoutToDisk());
    document.getElementById('dev-camera-copy-json')?.addEventListener('click', () => this.copyJson());
    document.getElementById('dev-camera-reset-layout')?.addEventListener('click', () => this.resetLayout());
  }

  private wireCameraNudge(
    decId: string,
    incId: string,
    input: HTMLInputElement | null,
    step: number,
  ): void {
    document.getElementById(decId)?.addEventListener('click', () => {
      if (!input) return;
      input.value = (parseFloat(input.value || '0') - step).toFixed(step < 1 ? 2 : 0);
      this.applyCameraInputs();
    });
    document.getElementById(incId)?.addEventListener('click', () => {
      if (!input) return;
      input.value = (parseFloat(input.value || '0') + step).toFixed(step < 1 ? 2 : 0);
      this.applyCameraInputs();
    });
  }

  private setEditMode(mode: EditMode): void {
    if (this.editMode === mode) return;
    this.editMode = mode;

    if (mode === 'layout') {
      this.deselectContent();
      this.deselectHotspotLayout();
      this.deselectLight();
      this.populatePropLayoutPicker();
    } else if (mode === 'hotspots') {
      this.deselectLayout();
      this.deselectContent();
      this.deselectLight();
      this.populateHotspotLayoutPicker();
    } else if (mode === 'lighting') {
      this.deselectLayout();
      this.deselectContent();
      this.deselectHotspotLayout();
      this.populateLightPicker();
    } else if (mode === 'camera') {
      this.deselectLayout();
      this.deselectContent();
      this.deselectHotspotLayout();
      this.deselectLight();
      this.populateCameraShotPicker();
    } else {
      this.deselectLayout();
      this.deselectHotspotLayout();
      this.deselectLight();
    }

    if (mode !== 'layout') {
      this.room.updateFloorEditHelper(false);
    }

    this.layoutSectionEl?.classList.toggle('hidden', mode !== 'layout');
    this.hotspotsSectionEl?.classList.toggle('hidden', mode !== 'hotspots');
    this.lightingSectionEl?.classList.toggle('hidden', mode !== 'lighting');
    this.cameraSectionEl?.classList.toggle('hidden', mode !== 'camera');
    this.contentSectionEl?.classList.toggle('hidden', mode !== 'text');
    this.layoutModeTab?.classList.toggle('active', mode === 'layout');
    this.hotspotsModeTab?.classList.toggle('active', mode === 'hotspots');
    this.lightingModeTab?.classList.toggle('active', mode === 'lighting');
    this.cameraModeTab?.classList.toggle('active', mode === 'camera');
    this.textModeTab?.classList.toggle('active', mode === 'text');
    this.layoutModeTab?.setAttribute('aria-selected', mode === 'layout' ? 'true' : 'false');
    this.hotspotsModeTab?.setAttribute('aria-selected', mode === 'hotspots' ? 'true' : 'false');
    this.lightingModeTab?.setAttribute('aria-selected', mode === 'lighting' ? 'true' : 'false');
    this.cameraModeTab?.setAttribute('aria-selected', mode === 'camera' ? 'true' : 'false');
    this.textModeTab?.setAttribute('aria-selected', mode === 'text' ? 'true' : 'false');

    if (this.modeIndicatorEl) {
      const labels: Record<EditMode, string> = {
        layout: 'Layout',
        hotspots: 'Hotspots',
        lighting: 'Lighting',
        camera: 'Camera',
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
    // Layout also shows hotspot boxes so items/objects without a clear mesh hit stay clickable.
    const showHotspots =
      this.active &&
      (this.editMode === 'layout' || this.editMode === 'text' || this.editMode === 'hotspots');
    for (const hs of this.room.hotspots) {
      hs.setVisibleDebug(showHotspots);
    }
  }

  private wireNudge(
    decId: string,
    incId: string,
    axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz' | 's',
    target: 'prop' | 'hotspot-pos' | 'hotspot-size' | 'floor-size' = 'prop',
  ): void {
    const step = axis === 'rx' || axis === 'ry' || axis === 'rz' ? 15 : axis === 's' ? 0.05 : 0.05;
    document.getElementById(decId)?.addEventListener('click', () => {
      if (target === 'prop') this.nudge(axis, -step);
      else if (target === 'hotspot-pos') this.nudgeHotspotPosition(axis as 'x' | 'y' | 'z', -step);
      else if (target === 'floor-size') this.nudgeFloorSize(axis as 'x' | 'y' | 'z', -step);
      else this.nudgeHotspotSize(axis as 'x' | 'y' | 'z', -step);
    });
    document.getElementById(incId)?.addEventListener('click', () => {
      if (target === 'prop') this.nudge(axis, step);
      else if (target === 'hotspot-pos') this.nudgeHotspotPosition(axis as 'x' | 'y' | 'z', step);
      else if (target === 'floor-size') this.nudgeFloorSize(axis as 'x' | 'y' | 'z', step);
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
    if (this.active) {
      this.populatePropLayoutPicker();
      this.updateHotspotDebugVisibility();
    }
  }

  /** Call when async room targets (ship floors) finish loading. */
  onRoomTargetsChanged(): void {
    if (this.active && this.editMode === 'layout') {
      this.populatePropLayoutPicker();
    }
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
    this.ensureDiscoveredEditablesInPropsData();
    this.populateContentPickers();
    this.populateHotspotLayoutPicker();
    this.populatePropLayoutPicker();
    this.populateLightPicker();
    this.loadRoomContentFields();
  }

  /**
   * Scene clusters (cork board, wall notes, etc.) may exist as named Object3Ds
   * with `userData.devEditable` before they appear in room JSON. Inject stub
   * propsData entries so Layout / Save Layout include them automatically.
   */
  private ensureDiscoveredEditablesInPropsData(): void {
    this.room.root.traverse((obj) => {
      if (!obj.userData?.devEditable || !obj.name) return;
      if (this.room.propsData.some((p) => p.id === obj.name)) return;

      const world = new THREE.Vector3();
      obj.getWorldPosition(world);
      const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      const wallFace = obj.userData.wallFace as string | undefined;
      const entry: RoomBuilder['propsData'][number] = {
        id: obj.name,
        mesh: 'group',
        color: '#888888',
        size: [
          Math.max(0.1, Number(size.x.toFixed(3))),
          Math.max(0.1, Number(size.y.toFixed(3))),
          Math.max(0.1, Number(size.z.toFixed(3))),
        ],
        position: [
          Number(world.x.toFixed(3)),
          Number(world.y.toFixed(3)),
          Number(world.z.toFixed(3)),
        ],
      };
      if (wallFace && wallFace !== 'floor') {
        entry.wall = wallFace as 'north' | 'south' | 'east' | 'west';
      }
      const euler = obj.rotation;
      const ry = Math.round(THREE.MathUtils.radToDeg(euler.y));
      if (ry !== 0) {
        entry.rotation = [0, ((ry % 360) + 360) % 360, 0];
      }
      this.room.propsData.push(entry);
    });
  }

  private isSelectablePropId(id: string, obj?: THREE.Object3D | null): boolean {
    if (this.room.propsData.some((p) => p.id === id)) return true;
    if (obj?.userData?.devEditable) return true;
    return false;
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
      this.lightingSectionEl?.classList.add('hidden');
      this.cameraSectionEl?.classList.add('hidden');
      this.contentSectionEl?.classList.add('hidden');
      this.layoutModeTab?.classList.add('active');
      this.hotspotsModeTab?.classList.remove('active');
      this.lightingModeTab?.classList.remove('active');
      this.cameraModeTab?.classList.remove('active');
      this.textModeTab?.classList.remove('active');
      this.layoutModeTab?.setAttribute('aria-selected', 'true');
      this.hotspotsModeTab?.setAttribute('aria-selected', 'false');
      this.lightingModeTab?.setAttribute('aria-selected', 'false');
      this.cameraModeTab?.setAttribute('aria-selected', 'false');
      this.textModeTab?.setAttribute('aria-selected', 'false');
      if (this.modeIndicatorEl) this.modeIndicatorEl.textContent = 'Layout';
      this.panelEl?.classList.remove('hidden');
      this.ensureDiscoveredEditablesInPropsData();
      this.populateContentPickers();
      this.populateHotspotLayoutPicker();
      this.populatePropLayoutPicker();
      this.populateLightPicker();
      this.canvas.addEventListener('click', this.clickHandlerBound);
      window.addEventListener('keydown', this.keydownHandlerBound);
    } else {
      this.panelEl?.classList.add('hidden');
      this.canvas.removeEventListener('click', this.clickHandlerBound);
      window.removeEventListener('keydown', this.keydownHandlerBound);
      this.deselectAll();
      this.room.updateFloorEditHelper(false);
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
    if (this.editMode === 'lighting') {
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
      if (e.key === 'Escape') {
        this.deselectLight();
        e.preventDefault();
      }
      return;
    }

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

    if (this.selectedProps.size === 0 && !this.selectedFloorId) return;
    if (e.target instanceof HTMLInputElement) return; // Skip if typing in inputs

    // Movement controls
    const moveStep = e.shiftKey ? 0.01 : 0.05;
    const rotStep = e.shiftKey ? 5 : 15;
    const sizeStep = e.shiftKey ? 0.01 : 0.05;

    if (this.selectedFloorId) {
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
        case '[':
          this.nudgeFloorSize('x', -sizeStep);
          e.preventDefault();
          break;
        case ']':
          this.nudgeFloorSize('x', sizeStep);
          e.preventDefault();
          break;
        case ';':
          this.nudgeFloorSize('z', -sizeStep);
          e.preventDefault();
          break;
        case "'":
          this.nudgeFloorSize('z', sizeStep);
          e.preventDefault();
          break;
        case 'Escape':
          this.deselectLayout();
          e.preventDefault();
          break;
      }
      return;
    }

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

    if (this.editMode === 'lighting') {
      const propId = this.pickPropIdAt(clientX, clientY);
      if (propId) {
        const lightId = this.findLightIdForProp(propId);
        if (lightId) {
          this.selectLight(lightId);
          return;
        }
      }
      if (!toggle) {
        this.deselectLight();
      }
      return;
    }

    const propId = this.pickPropIdAt(clientX, clientY);
    if (propId) {
      const mesh = this.findMeshForProp(propId);
      if (mesh) {
        this.toggleSelection(propId, mesh, toggle);
        return;
      }
    }

    // Layout: click a walkable floor plane to edit it.
    if (this.editMode === 'layout') {
      const floorId = this.pickFloorAt(clientX, clientY);
      if (floorId) {
        if (!toggle) this.selectFloor(floorId);
        return;
      }
    }

    // Layout fallback: pick item/object hotspots so level clicks can select edit targets.
    if (this.editMode === 'layout') {
      const hotspotId = this.pickHotspotIdAt(clientX, clientY);
      if (hotspotId) {
        const linkedPropId = this.propIdForItemHotspot(hotspotId);
        if (linkedPropId) {
          const mesh = this.findMeshForProp(linkedPropId);
          if (mesh) {
            this.toggleSelection(linkedPropId, mesh, toggle);
            return;
          }
        }
        if (!toggle) {
          this.deselectLayout();
          this.setEditMode('hotspots');
          this.selectLayoutHotspot(hotspotId);
        }
        return;
      }
    }

    if (!toggle) {
      this.deselectLayout();
    }
  }

  private pickFloorAt(clientX: number, clientY: number): FloorEditId | null {
    const floors: Array<{ id: FloorEditId; mesh: THREE.Mesh }> = [];
    const main = this.room.getPrimaryFloorMesh();
    if (main) floors.push({ id: 'main', mesh: main });
    const upper = this.room.getUpperFloorMesh();
    if (upper) floors.push({ id: 'upper', mesh: upper });
    if (floors.length === 0) return null;

    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(0);
    raycaster.setFromCamera(mouse, this.camera);
    const hits = raycaster.intersectObjects(
      floors.map((f) => f.mesh),
      false,
    );
    if (hits.length === 0) return null;
    const hitMesh = hits[0].object;
    const match = floors.find((f) => f.mesh === hitMesh);
    return match?.id ?? null;
  }

  private pickHotspotIdAt(clientX: number, clientY: number): string | null {
    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    raycaster.setFromCamera(mouse, this.camera);
    const hotspotHits = raycaster.intersectObjects(
      this.room.hotspots.map((h) => h.mesh),
      false,
    );
    if (hotspotHits.length === 0) return null;
    return (hotspotHits[0].object.userData.hotspotId as string) ?? null;
  }

  private pickPropIdAt(clientX: number, clientY: number): string | null {
    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(0);
    raycaster.setFromCamera(mouse, this.camera);

    const targets: THREE.Object3D[] = [];
    const seen = new Set<THREE.Object3D>();
    const pushMesh = (child: THREE.Object3D) => {
      if (!(child as THREE.Mesh).isMesh || seen.has(child)) return;
      if (child.userData.isFloor || child.userData.isHotspot) return;
      if (child.name === 'WindowGlass' || child.name === 'Floor') return;
      if (/^Wall(North|South|East|West)$/.test(child.name)) return;
      if (child.name.startsWith('wall_')) return;
      seen.add(child);
      targets.push(child);
    };

    this.room.propsRoot.traverse(pushMesh);
    this.room.root.traverse(pushMesh);

    const hits = raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      let current: THREE.Object3D | null = hit.object;
      while (current && current !== this.scene) {
        const id = current.name;
        if (id && this.isSelectablePropId(id, current)) return id;
        current = current.parent;
      }
    }
    return null;
  }

  private toggleSelection(id: string, mesh: THREE.Object3D, toggle: boolean): void {
    if (this.selectedFloorId || !toggle) {
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

    this.syncPropLayoutPicker();
    this.updateUIFields();
  }

  private syncPropLayoutPicker(): void {
    if (!this.propLayoutPicker) return;
    if (this.selectedFloorId === 'main') {
      this.propLayoutPicker.value = FLOOR_PICKER_VALUE;
    } else if (this.selectedFloorId === 'upper') {
      this.propLayoutPicker.value = UPPER_FLOOR_PICKER_VALUE;
    } else if (this.selectedProps.size === 1) {
      this.propLayoutPicker.value = this.selectedProps.keys().next().value!;
    } else {
      this.propLayoutPicker.value = '';
    }
  }

  private deselectAll(): void {
    this.deselectLayout();
    this.deselectHotspotLayout();
    this.deselectLight();
    this.deselectContent();
  }

  private deselectLayout(): void {
    this.selectedFloorId = null;
    this.room.updateFloorEditHelper(false);
    this.selectedProps.clear();
    for (const helper of this.boxHelpers.values()) {
      this.scene.remove(helper);
    }
    this.boxHelpers.clear();
    if (this.propLayoutPicker) this.propLayoutPicker.value = '';
    this.updateLayoutUIFields();
  }

  private selectFloor(which: FloorEditId): void {
    this.deselectLayout();
    const mesh =
      which === 'upper' ? this.room.getUpperFloorMesh() : this.room.getPrimaryFloorMesh();
    if (!mesh || (which === 'upper' && !this.room.hasUpperFloor())) {
      if (this.nameEl) {
        this.nameEl.textContent =
          which === 'upper' ? 'Upper deck floor (not ready)' : 'Floor plane (not ready)';
      }
      return;
    }
    this.selectedFloorId = which;
    this.room.updateFloorEditHelper(true, which);
    const helper = new THREE.BoxHelper(mesh, which === 'upper' ? 0xf4a261 : 0x4ecdc4);
    this.scene.add(helper);
    const key = which === 'upper' ? UPPER_FLOOR_PICKER_VALUE : FLOOR_PICKER_VALUE;
    this.boxHelpers.set(key, helper);
    if (this.propLayoutPicker) this.propLayoutPicker.value = key;
    this.updateLayoutUIFields();
  }

  private selectLayoutProp(propId: string): void {
    this.deselectLayout();
    const mesh = this.findMeshForProp(propId);
    if (!mesh) {
      if (this.nameEl) this.nameEl.textContent = `${propId} (mesh not found)`;
      return;
    }
    this.selectedProps.set(propId, mesh);
    const helper = new THREE.BoxHelper(mesh, 0xffcc00);
    this.scene.add(helper);
    this.boxHelpers.set(propId, helper);
    if (this.propLayoutPicker) this.propLayoutPicker.value = propId;
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

  private findLightIdForProp(propId: string): string | null {
    const lights = RELATIONSHIPS[propId]?.lights;
    return lights?.length ? lights[0] : null;
  }

  private deselectLight(): void {
    this.selectedLightId = null;
    if (this.lightPicker) this.lightPicker.value = '';
    if (this.lightNameEl) this.lightNameEl.textContent = 'None';
    this.updateLightingUIFields();
  }

  private selectLight(lightId: string): void {
    this.selectedLightId = lightId;
    if (this.lightPicker) this.lightPicker.value = lightId;
    if (this.lightNameEl) this.lightNameEl.textContent = lightId;
    this.updateLightingUIFields();
  }

  private updateLightingUIFields(): void {
    const spec = this.selectedLightId
      ? this.room.lightingData?.[this.selectedLightId]
      : null;
    const enabled = Boolean(spec);

    if (this.lightColorInput) {
      this.lightColorInput.disabled = !enabled;
      if (spec) this.lightColorInput.value = this.toColorInputHex(spec.color);
    }
    if (this.lightColorHexInput) {
      this.lightColorHexInput.disabled = !enabled;
      if (spec) this.lightColorHexInput.value = spec.color;
    }
    if (this.lightEnergyRange) {
      this.lightEnergyRange.disabled = !enabled;
      if (spec) this.lightEnergyRange.value = String(spec.energy);
    }
    if (this.lightEnergyValInput) {
      this.lightEnergyValInput.disabled = !enabled;
      if (spec) this.lightEnergyValInput.value = spec.energy.toFixed(2);
    }
  }

  private toColorInputHex(color: string): string {
    const c = new THREE.Color(color);
    return `#${c.getHexString()}`;
  }

  private normalizeHexColor(raw: string): string | null {
    const trimmed = raw.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
    return null;
  }

  private nudgeLightEnergy(delta: number): void {
    if (!this.selectedLightId || !this.room.lightingData) return;
    const spec = this.room.lightingData[this.selectedLightId];
    if (!spec) return;

    this.pushHistory();
    spec.energy = THREE.MathUtils.clamp(spec.energy + delta, 0, 3);
    this.room.applyLightSettings(this.selectedLightId);
    this.updateLightingUIFields();
    this.persistLayoutDraft();
  }

  private applyLightingInputs(): void {
    if (!this.selectedLightId || !this.room.lightingData) return;
    const spec = this.room.lightingData[this.selectedLightId];
    if (!spec) return;

    const hex = this.normalizeHexColor(
      this.lightColorHexInput?.value ?? this.lightColorInput?.value ?? spec.color,
    );
    const energy = parseFloat(this.lightEnergyValInput?.value ?? this.lightEnergyRange?.value ?? `${spec.energy}`);
    if (!hex || Number.isNaN(energy)) return;

    const nextEnergy = THREE.MathUtils.clamp(energy, 0, 3);
    if (hex === spec.color && nextEnergy === spec.energy) return;

    this.pushHistory();
    spec.color = hex;
    spec.energy = nextEnergy;
    this.room.applyLightSettings(this.selectedLightId);
    this.updateLightingUIFields();
    this.persistLayoutDraft();
  }

  private copyLightingState(): HistoryState['lighting'] {
    const copy: HistoryState['lighting'] = {};
    for (const [key, spec] of Object.entries(this.room.lightingData || {})) {
      copy[key] = {
        position: [...spec.position] as [number, number, number],
        color: spec.color,
        energy: spec.energy,
      };
    }
    return copy;
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
      if (id === FLOOR_PICKER_VALUE || id === UPPER_FLOOR_PICKER_VALUE) {
        const which: FloorEditId = id === UPPER_FLOOR_PICKER_VALUE ? 'upper' : 'main';
        const floor =
          which === 'upper' ? this.room.getUpperFloorMesh() : this.room.getPrimaryFloorMesh();
        if (this.selectedFloorId === which && floor) {
          helper.update();
        } else {
          this.scene.remove(helper);
          this.boxHelpers.delete(id);
        }
        continue;
      }
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

  private getActiveFloorData(): { position: [number, number, number]; size: [number, number, number] } | null {
    if (this.selectedFloorId === 'upper') return this.room.upperFloorPlaneData;
    if (this.selectedFloorId === 'main') return this.room.floorPlaneData;
    return null;
  }

  private applyActiveFloorPlane(): void {
    if (this.selectedFloorId === 'upper') this.room.applyUpperFloorPlane();
    else this.room.applyFloorPlane();
    if (this.selectedFloorId) {
      this.room.updateFloorEditHelper(true, this.selectedFloorId);
    }
  }

  private updateLayoutUIFields(): void {
    const showFloor = Boolean(this.selectedFloorId);
    this.propOrientGroupEl?.classList.toggle('hidden', showFloor);
    this.floorSizeGroupEl?.classList.toggle('hidden', !showFloor);

    if (this.selectedFloorId) {
      const floor = this.getActiveFloorData();
      if (!floor) return;
      if (this.nameEl) {
        this.nameEl.textContent =
          this.selectedFloorId === 'upper' ? 'Upper deck floor' : 'Floor plane';
      }
      if (this.posXInput) {
        this.posXInput.disabled = false;
        this.posXInput.value = floor.position[0].toFixed(2);
      }
      if (this.posYInput) {
        this.posYInput.disabled = false;
        this.posYInput.value = floor.position[1].toFixed(2);
      }
      if (this.posZInput) {
        this.posZInput.disabled = false;
        this.posZInput.value = floor.position[2].toFixed(2);
      }
      if (this.floorSizeXInput) {
        this.floorSizeXInput.disabled = false;
        this.floorSizeXInput.value = floor.size[0].toFixed(2);
      }
      if (this.floorSizeYInput) {
        this.floorSizeYInput.disabled = false;
        this.floorSizeYInput.value = floor.size[1].toFixed(2);
      }
      if (this.floorSizeZInput) {
        this.floorSizeZInput.disabled = false;
        this.floorSizeZInput.value = floor.size[2].toFixed(2);
      }
      if (this.rotXInput) { this.rotXInput.disabled = true; this.rotXInput.value = '0'; }
      if (this.rotYInput) { this.rotYInput.disabled = true; this.rotYInput.value = '0'; }
      if (this.rotZInput) { this.rotZInput.disabled = true; this.rotZInput.value = '0'; }
      if (this.scaleInput) { this.scaleInput.disabled = true; this.scaleInput.value = '1.00'; }
      return;
    }

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
        const rx = prop.rotation ? prop.rotation[0] : 0;
        const ry = prop.rotation ? prop.rotation[1] : 0;
        const rz = prop.rotation ? prop.rotation[2] : 0;
        if (this.rotXInput) {
          this.rotXInput.disabled = false;
          this.rotXInput.value = Math.round(rx).toString();
        }
        if (this.rotYInput) {
          this.rotYInput.disabled = false;
          this.rotYInput.value = Math.round(ry).toString();
        }
        if (this.rotZInput) {
          this.rotZInput.disabled = false;
          this.rotZInput.value = Math.round(rz).toString();
        }
        if (this.scaleInput) {
          this.scaleInput.disabled = false;
          this.scaleInput.value = (prop.scale ?? 1).toFixed(2);
        }
      }
    } else if (this.selectedProps.size > 1) {
      if (this.nameEl) this.nameEl.textContent = `${this.selectedProps.size} objects`;
      if (this.posXInput) { this.posXInput.disabled = true; this.posXInput.value = 'Multiple'; }
      if (this.posYInput) { this.posYInput.disabled = true; this.posYInput.value = 'Multiple'; }
      if (this.posZInput) { this.posZInput.disabled = true; this.posZInput.value = 'Multiple'; }
      if (this.rotXInput) { this.rotXInput.disabled = true; this.rotXInput.value = 'Multiple'; }
      if (this.rotYInput) { this.rotYInput.disabled = true; this.rotYInput.value = 'Multiple'; }
      if (this.rotZInput) { this.rotZInput.disabled = true; this.rotZInput.value = 'Multiple'; }
      if (this.scaleInput) { this.scaleInput.disabled = true; this.scaleInput.value = 'Multiple'; }
    } else {
      if (this.nameEl) this.nameEl.textContent = 'None';
      if (this.posXInput) { this.posXInput.disabled = true; this.posXInput.value = '0.00'; }
      if (this.posYInput) { this.posYInput.disabled = true; this.posYInput.value = '0.00'; }
      if (this.posZInput) { this.posZInput.disabled = true; this.posZInput.value = '0.00'; }
      if (this.rotXInput) { this.rotXInput.disabled = true; this.rotXInput.value = '0'; }
      if (this.rotYInput) { this.rotYInput.disabled = true; this.rotYInput.value = '0'; }
      if (this.rotZInput) { this.rotZInput.disabled = true; this.rotZInput.value = '0'; }
      if (this.scaleInput) { this.scaleInput.disabled = true; this.scaleInput.value = '1.00'; }
      if (this.floorSizeXInput) { this.floorSizeXInput.disabled = true; this.floorSizeXInput.value = '0.00'; }
      if (this.floorSizeYInput) { this.floorSizeYInput.disabled = true; this.floorSizeYInput.value = '0.00'; }
      if (this.floorSizeZInput) { this.floorSizeZInput.disabled = true; this.floorSizeZInput.value = '0.00'; }
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
    const wallFace = mesh.userData.wallFace as string | undefined;
    if (wallFace && wallFace !== 'floor') {
      const rest = this.room.getWallRestPosition(wallFace as 'north' | 'south' | 'east' | 'west');
      if (rest) {
        mesh.position.set(
          hsData.position[0] - rest.x,
          hsData.position[1] - rest.y,
          hsData.position[2] - rest.z,
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

  private nudgePropGroup(propId: string, axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz' | 's', amount: number): void {
    const prop = this.room.propsData.find((p) => p.id === propId);
    if (!prop) return;

    const parentX = prop.position[0];
    const parentZ = prop.position[2];

    const visitedProps = new Set<string>();
    const visitedHotspots = new Set<string>();
    const visitedLights = new Set<string>();

    // 1. Gather all descendants recursively
    this.collectAffected(propId, visitedProps, visitedHotspots, visitedLights);

    // Also include any lights parented to visited props (scene-graph grouping).
    for (const pId of visitedProps) {
      for (const [lightKey, light] of this.room.lights) {
        if (light.userData.parentPropId === pId) {
          visitedLights.add(lightKey);
        }
      }
    }

    // Apply translations/rotations to all gathered props
    for (const pId of visitedProps) {
      const p = this.room.propsData.find((item) => item.id === pId);
      if (p) {
        if (pId === propId) {
          // Direct transform for selected parent
          if (axis === 'x') p.position[0] += amount;
          else if (axis === 'y') p.position[1] += amount;
          else if (axis === 'z') p.position[2] += amount;
          else if (axis === 'rx' || axis === 'ry' || axis === 'rz') {
            if (!p.rotation) p.rotation = [0, 0, 0];
            const idx = axis === 'rx' ? 0 : axis === 'ry' ? 1 : 2;
            p.rotation[idx] = ((p.rotation[idx] + amount) % 360 + 360) % 360;
          } else if (axis === 's') {
            p.scale = Math.max(0.05, (p.scale ?? 1) + amount);
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

    // Lights parented to props follow via scene graph; sync world positions into lightingData.
    // Unparented lights get the same translation/orbit as the prop group.
    for (const ltId of visitedLights) {
      const ltData = this.room.lightingData ? this.room.lightingData[ltId] : undefined;
      const lightMesh = this.room.lights.get(ltId);
      if (!ltData || !lightMesh) continue;

      if (lightMesh.userData.parentPropId) {
        continue; // synced below after all meshes update
      }

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

      lightMesh.position.set(ltData.position[0], ltData.position[1], ltData.position[2]);
    }

    if (visitedLights.size > 0) {
      this.room.syncLightWorldPositions(visitedLights);
    }
  }

  private nudge(axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz' | 's', amount: number): void {
    if (this.selectedFloorId) {
      if (axis === 'rx' || axis === 'ry' || axis === 'rz' || axis === 's') return;
      const floor = this.getActiveFloorData();
      if (!floor) return;
      this.pushHistory();
      const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      floor.position[idx] += amount;
      this.applyActiveFloorPlane();
      this.updateUIFields();
      this.persistLayoutDraft();
      this.updateBoxHelpers();
      return;
    }

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

  private nudgeFloorSize(axis: 'x' | 'y' | 'z', amount: number): void {
    if (!this.selectedFloorId) return;
    const floor = this.getActiveFloorData();
    if (!floor) return;
    this.pushHistory();
    const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const next = Math.max(0.05, floor.size[idx] + amount);
    floor.size[idx] = next;
    this.applyActiveFloorPlane();
    this.updateUIFields();
    this.persistLayoutDraft();
    this.updateBoxHelpers();
  }

  private applyFloorSizeInputs(): void {
    if (!this.selectedFloorId) return;
    const floor = this.getActiveFloorData();
    if (!floor) return;
    const sx = parseFloat(this.floorSizeXInput?.value ?? '0');
    const sy = parseFloat(this.floorSizeYInput?.value ?? '0');
    const sz = parseFloat(this.floorSizeZInput?.value ?? '0');
    const xDiff = !isNaN(sx) && sx !== floor.size[0];
    const yDiff = !isNaN(sy) && sy !== floor.size[1];
    const zDiff = !isNaN(sz) && sz !== floor.size[2];
    if (!xDiff && !yDiff && !zDiff) return;

    this.pushHistory();
    if (xDiff) floor.size[0] = Math.max(0.05, sx);
    if (yDiff) floor.size[1] = Math.max(0.01, sy);
    if (zDiff) floor.size[2] = Math.max(0.05, sz);
    this.applyActiveFloorPlane();
    this.persistLayoutDraft();
    this.updateBoxHelpers();
    this.updateUIFields();
  }

  private applyInputs(): void {
    if (this.selectedFloorId) {
      const floor = this.getActiveFloorData();
      if (!floor) return;
      const x = parseFloat(this.posXInput?.value ?? '0');
      const y = parseFloat(this.posYInput?.value ?? '0');
      const z = parseFloat(this.posZInput?.value ?? '0');
      const xDiff = !isNaN(x) && x !== floor.position[0];
      const yDiff = !isNaN(y) && y !== floor.position[1];
      const zDiff = !isNaN(z) && z !== floor.position[2];
      if (!xDiff && !yDiff && !zDiff) return;

      this.pushHistory();
      if (xDiff) floor.position[0] = x;
      if (yDiff) floor.position[1] = y;
      if (zDiff) floor.position[2] = z;
      this.applyActiveFloorPlane();
      this.persistLayoutDraft();
      this.updateBoxHelpers();
      this.updateUIFields();
      return;
    }

    if (this.selectedProps.size !== 1) return;
    const id = this.selectedProps.keys().next().value!;

    const prop = this.room.propsData.find((p) => p.id === id);
    if (!prop) return;

    const x = parseFloat(this.posXInput?.value ?? '0');
    const y = parseFloat(this.posYInput?.value ?? '0');
    const z = parseFloat(this.posZInput?.value ?? '0');
    const rx = parseFloat(this.rotXInput?.value ?? '0');
    const ry = parseFloat(this.rotYInput?.value ?? '0');
    const rz = parseFloat(this.rotZInput?.value ?? '0');
    const scale = parseFloat(this.scaleInput?.value ?? '1');

    const xDiff = !isNaN(x) && x !== prop.position[0];
    const yDiff = !isNaN(y) && y !== prop.position[1];
    const zDiff = !isNaN(z) && z !== prop.position[2];
    const currentRx = prop.rotation ? prop.rotation[0] : 0;
    const currentRy = prop.rotation ? prop.rotation[1] : 0;
    const currentRz = prop.rotation ? prop.rotation[2] : 0;
    const currentScale = prop.scale ?? 1;
    const rxDiff = !isNaN(rx) && rx !== currentRx;
    const ryDiff = !isNaN(ry) && ry !== currentRy;
    const rzDiff = !isNaN(rz) && rz !== currentRz;
    const scaleDiff = !isNaN(scale) && scale !== currentScale;

    if (xDiff || yDiff || zDiff || rxDiff || ryDiff || rzDiff || scaleDiff) {
      this.pushHistory();

      if (xDiff) this.nudgePropGroup(id, 'x', x - prop.position[0]);
      if (yDiff) this.nudgePropGroup(id, 'y', y - prop.position[1]);
      if (zDiff) this.nudgePropGroup(id, 'z', z - prop.position[2]);
      if (rxDiff) this.nudgePropGroup(id, 'rx', rx - currentRx);
      if (ryDiff) this.nudgePropGroup(id, 'ry', ry - currentRy);
      if (rzDiff) this.nudgePropGroup(id, 'rz', rz - currentRz);
      if (scaleDiff) this.nudgePropGroup(id, 's', scale - currentScale);

      this.room.rebuildObstacles();
      this.persistLayoutDraft();
      this.updateBoxHelpers();
      this.updateUIFields();
    }
  }

  private applyTransformToMesh(mesh: THREE.Object3D, prop: any): void {
    const wallFace = mesh.userData.wallFace as string | undefined;
    if (wallFace && wallFace !== 'floor') {
      // Use rest pose — animated/folded wall.position would cancel nudges.
      const rest = this.room.getWallRestPosition(wallFace as 'north' | 'south' | 'east' | 'west');
      if (rest) {
        mesh.position.set(
          prop.position[0] - rest.x,
          prop.position[1] - rest.y,
          prop.position[2] - rest.z,
        );
      } else {
        mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
      }
    } else {
      mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
    }

    if (prop.rotation) {
      mesh.rotation.set(
        THREE.MathUtils.degToRad(prop.rotation[0] ?? 0),
        THREE.MathUtils.degToRad(prop.rotation[1] ?? 0),
        THREE.MathUtils.degToRad(prop.rotation[2] ?? 0),
      );
    } else {
      mesh.rotation.set(0, 0, 0);
    }

    mesh.scale.setScalar(prop.scale ?? 1);
  }

  // History system
  private copyFloorState(): HistoryState['floor'] {
    return {
      position: [...this.room.floorPlaneData.position] as [number, number, number],
      size: [...this.room.floorPlaneData.size] as [number, number, number],
    };
  }

  private copyUpperFloorState(): HistoryState['floor_upper'] {
    const upper = this.room.upperFloorPlaneData;
    if (!upper) return null;
    return {
      position: [...upper.position] as [number, number, number],
      size: [...upper.size] as [number, number, number],
    };
  }

  private pushHistory(): void {
    const propsCopy = this.room.propsData.map((p) => ({
      id: p.id,
      position: [...p.position] as [number, number, number],
      ...(p.rotation ? { rotation: [...p.rotation] as [number, number, number] } : {}),
      ...(p.scale != null && p.scale !== 1 ? { scale: p.scale } : {}),
    }));

    const hotspotsCopy = this.room.hotspotsData.map((h) => ({
      id: h.id,
      position: [...h.position] as [number, number, number],
      size: [...h.size] as [number, number, number],
    }));

    const lightingCopy = this.copyLightingState();

    this.undoStack.push({
      props: propsCopy,
      hotspots: hotspotsCopy,
      lighting: lightingCopy,
      floor: this.copyFloorState(),
      floor_upper: this.copyUpperFloorState(),
    });
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
      ...(p.rotation ? { rotation: [...p.rotation] as [number, number, number] } : {}),
      ...(p.scale != null && p.scale !== 1 ? { scale: p.scale } : {}),
    }));
    const currentHotspots = this.room.hotspotsData.map((h) => ({
      id: h.id,
      position: [...h.position] as [number, number, number],
      size: [...h.size] as [number, number, number],
    }));
    this.redoStack.push({
      props: currentProps,
      hotspots: currentHotspots,
      lighting: this.copyLightingState(),
      floor: this.copyFloorState(),
      floor_upper: this.copyUpperFloorState(),
    });

    const state = this.undoStack.pop()!;
    this.restoreState(state);
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;

    const currentProps = this.room.propsData.map((p) => ({
      id: p.id,
      position: [...p.position] as [number, number, number],
      ...(p.rotation ? { rotation: [...p.rotation] as [number, number, number] } : {}),
      ...(p.scale != null && p.scale !== 1 ? { scale: p.scale } : {}),
    }));
    const currentHotspots = this.room.hotspotsData.map((h) => ({
      id: h.id,
      position: [...h.position] as [number, number, number],
      size: [...h.size] as [number, number, number],
    }));
    this.undoStack.push({
      props: currentProps,
      hotspots: currentHotspots,
      lighting: this.copyLightingState(),
      floor: this.copyFloorState(),
      floor_upper: this.copyUpperFloorState(),
    });

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
        } else {
          delete prop.rotation;
        }
        if (savedProp.scale != null) {
          prop.scale = savedProp.scale;
        } else {
          delete prop.scale;
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
          if (savedLt.color) ltData.color = savedLt.color;
          if (savedLt.energy != null) ltData.energy = savedLt.energy;
          this.room.applyLightSettings(key);
          const pointLight = this.room.lights.get(key);
          if (pointLight && !pointLight.userData.parentPropId) {
            pointLight.position.set(ltData.position[0], ltData.position[1], ltData.position[2]);
          } else if (pointLight?.userData.parentPropId) {
            // Keep light glued to its prop; refresh local offset from restored world pos.
            this.room.attachLightToProp(key, pointLight.userData.parentPropId as string);
          }
        }
      }
    }

    if (state.floor) {
      this.room.floorPlaneData = {
        position: [...state.floor.position] as [number, number, number],
        size: [...state.floor.size] as [number, number, number],
      };
      this.room.applyFloorPlane();
    }

    if (state.floor_upper && this.room.upperFloorPlaneData) {
      this.room.upperFloorPlaneData = {
        position: [...state.floor_upper.position] as [number, number, number],
        size: [...state.floor_upper.size] as [number, number, number],
      };
      this.room.applyUpperFloorPlane();
    }

    if (this.selectedFloorId) {
      this.room.updateFloorEditHelper(true, this.selectedFloorId);
    }

    this.room.rebuildObstacles();
    this.persistLayoutDraft();
    this.updateBoxHelpers();
    this.updateUIFields();
    this.updateHotspotLayoutUIFields();
    this.updateLightingUIFields();
    this.updateHistoryButtons();
  }

  private updateHistoryButtons(): void {
    const canUndo = this.undoStack.length > 0;
    const canRedo = this.redoStack.length > 0;
    if (this.undoBtn) this.undoBtn.disabled = !canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !canRedo;
    if (this.hotspotUndoBtn) this.hotspotUndoBtn.disabled = !canUndo;
    if (this.hotspotRedoBtn) this.hotspotRedoBtn.disabled = !canRedo;
    if (this.lightUndoBtn) this.lightUndoBtn.disabled = !canUndo;
    if (this.lightRedoBtn) this.lightRedoBtn.disabled = !canRedo;
  }

  private persistLayoutDraft(): void {
    localStorage.setItem(
      layoutStorageKey(this.roomId),
      JSON.stringify({
        props: this.room.propsData,
        hotspots: this.room.hotspotsData,
        lighting: this.room.lightingData,
        camera_shots: this.room.cameraShotsData,
        floor: this.room.floorPlaneData,
        floor_upper: this.room.upperFloorPlaneData,
      }),
    );
  }

  private populateCameraShotPicker(): void {
    if (!this.cameraShotPicker) return;
    const shots = Object.entries(this.room.cameraShotsData);
    shots.sort((a, b) => a[1].label.localeCompare(b[1].label));
    this.cameraShotPicker.innerHTML = '';
    for (const [id, shot] of shots) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${shot.label} (${id})`;
      this.cameraShotPicker.appendChild(opt);
    }
    const prefer = this.selectedCameraShotId && this.room.cameraShotsData[this.selectedCameraShotId]
      ? this.selectedCameraShotId
      : shots[0]?.[0];
    if (prefer) {
      this.cameraShotPicker.value = prefer;
      this.selectCameraShot(prefer);
    }
  }

  private selectCameraShot(id: string): void {
    const shot = this.room.getCameraShot(id);
    if (!shot) return;
    this.selectedCameraShotId = id;
    this.suppressCameraInput = true;
    if (this.camTargetXInput) this.camTargetXInput.value = shot.target[0].toFixed(3);
    if (this.camTargetYInput) this.camTargetYInput.value = shot.target[1].toFixed(3);
    if (this.camTargetZInput) this.camTargetZInput.value = shot.target[2].toFixed(3);
    if (this.camSizeInput) this.camSizeInput.value = shot.size.toFixed(2);
    if (this.camPitchInput) this.camPitchInput.value = shot.pitch_deg.toFixed(1);
    const followYaw = shot.yaw_deg === null || shot.yaw_deg === undefined;
    if (this.camFollowYawInput) this.camFollowYawInput.checked = followYaw;
    if (this.camYawInput) {
      this.camYawInput.value = followYaw ? '0' : Number(shot.yaw_deg).toFixed(1);
      this.camYawInput.disabled = followYaw;
    }
    if (this.camDampInput) this.camDampInput.value = (shot.damp ?? 9).toFixed(1);
    if (this.camLockSelect) this.camLockSelect.value = shot.lock_to ?? '';
    if (this.camLockHintEl) {
      this.camLockHintEl.textContent = shot.lock_to
        ? `Target locked to ${shot.lock_to} at runtime. Capture Current clears the lock and stores an absolute target.`
        : 'Target is absolute world position.';
    }
    this.suppressCameraInput = false;
  }

  private readCameraShotFromInputs(): CameraShotDef | null {
    if (!this.selectedCameraShotId) return null;
    const existing = this.room.getCameraShot(this.selectedCameraShotId);
    if (!existing) return null;
    const followYaw = !!this.camFollowYawInput?.checked;
    const lockVal = (this.camLockSelect?.value || '') as CameraShotLock | '';
    const shot: CameraShotDef = {
      label: existing.label,
      target: [
        parseFloat(this.camTargetXInput?.value || '0'),
        parseFloat(this.camTargetYInput?.value || '0'),
        parseFloat(this.camTargetZInput?.value || '0'),
      ],
      size: parseFloat(this.camSizeInput?.value || '10'),
      pitch_deg: parseFloat(this.camPitchInput?.value || '-30'),
      yaw_deg: followYaw ? null : parseFloat(this.camYawInput?.value || '0'),
      damp: parseFloat(this.camDampInput?.value || '9'),
    };
    if (lockVal) shot.lock_to = lockVal;
    return shot;
  }

  private applyCameraInputs(): void {
    if (this.suppressCameraInput || !this.selectedCameraShotId) return;
    const shot = this.readCameraShotFromInputs();
    if (!shot) return;

    const prev = this.room.getCameraShot(this.selectedCameraShotId);
    // Editing target while locked to a prop would be ignored at runtime — clear the lock.
    if (prev?.lock_to && prev.lock_to !== 'player_head') {
      const targetChanged =
        Math.abs(prev.target[0] - shot.target[0]) > 1e-4
        || Math.abs(prev.target[1] - shot.target[1]) > 1e-4
        || Math.abs(prev.target[2] - shot.target[2]) > 1e-4;
      if (targetChanged) {
        delete shot.lock_to;
        if (this.camLockSelect) this.camLockSelect.value = '';
      }
    }

    this.room.setCameraShot(this.selectedCameraShotId, shot);
    if (this.camLockHintEl) {
      this.camLockHintEl.textContent = shot.lock_to
        ? `Target locked to ${shot.lock_to} at runtime (stored Target XYZ is ignored until you clear Lock or edit Target).`
        : 'Target is absolute world position — this is what Save writes.';
    }
    this.persistLayoutDraft();
  }

  private previewCameraShot(): void {
    this.applyCameraInputs();
    if (!this.selectedCameraShotId) return;
    const shot = this.room.getCameraShot(this.selectedCameraShotId);
    if (!shot) return;
    let yawOverride: number | undefined;
    if (shot.yaw_deg === null) {
      yawOverride = this.isoCamera.getYawForViewIndex(this.isoCamera.getViewIndex());
    }
    applyCameraShot(this.isoCamera, shot, { yawOverride });
  }

  private captureCameraShot(): void {
    if (!this.selectedCameraShotId) return;
    const existing = this.room.getCameraShot(this.selectedCameraShotId);
    if (!existing) return;
    const pose = this.isoCamera.getLivePose();
    const followYaw = !!this.camFollowYawInput?.checked;
    const shot: CameraShotDef = {
      label: existing.label,
      target: [pose.pos.x, pose.pos.y, pose.pos.z],
      size: pose.size,
      pitch_deg: THREE.MathUtils.radToDeg(pose.pitch),
      yaw_deg: followYaw ? null : THREE.MathUtils.radToDeg(pose.yaw),
      damp: parseFloat(this.camDampInput?.value || String(existing.damp ?? 9)),
    };
    this.room.setCameraShot(this.selectedCameraShotId, shot);
    this.selectCameraShot(this.selectedCameraShotId);
    this.persistLayoutDraft();
  }

  private async saveCameraLayoutToDisk(): Promise<void> {
    // Save the form values as-is — do NOT capture live camera (that was wiping edits).
    this.applyCameraInputs();
    await this.saveLayoutToDisk();
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

    // Ensure pending Camera-tab field edits are in room.cameraShotsData.
    this.applyCameraInputs();

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

  private populateLightPicker(): void {
    if (!this.lightPicker) return;
    const current = this.selectedLightId ?? '';
    this.lightPicker.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— select light —';
    this.lightPicker.appendChild(blank);
    for (const key of Object.keys(this.room.lightingData || {})) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      this.lightPicker.appendChild(opt);
    }
    this.lightPicker.value = current;
  }

  private populatePropLayoutPicker(): void {
    if (!this.propLayoutPicker) return;
    this.ensureDiscoveredEditablesInPropsData();
    const current =
      this.selectedFloorId === 'main'
        ? FLOOR_PICKER_VALUE
        : this.selectedFloorId === 'upper'
          ? UPPER_FLOOR_PICKER_VALUE
          : this.selectedProps.size === 1
            ? this.selectedProps.keys().next().value!
            : '';
    this.propLayoutPicker.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— select —';
    this.propLayoutPicker.appendChild(blank);

    const floorOpt = document.createElement('option');
    floorOpt.value = FLOOR_PICKER_VALUE;
    floorOpt.textContent = 'Floor plane';
    this.propLayoutPicker.appendChild(floorOpt);

    if (this.room.hasUpperFloor()) {
      const upperOpt = document.createElement('option');
      upperOpt.value = UPPER_FLOOR_PICKER_VALUE;
      upperOpt.textContent = 'Upper deck floor';
      this.propLayoutPicker.appendChild(upperOpt);
    }

    const propsGroup = document.createElement('optgroup');
    propsGroup.label = 'Objects';
    const sortedProps = [...this.room.propsData].sort((a, b) => a.id.localeCompare(b.id));
    for (const prop of sortedProps) {
      const opt = document.createElement('option');
      opt.value = prop.id;
      const meshHint = prop.mesh && prop.mesh !== 'box' ? ` · ${prop.mesh}` : '';
      opt.textContent = `${prop.id}${meshHint}`;
      propsGroup.appendChild(opt);
    }
    this.propLayoutPicker.appendChild(propsGroup);

    const itemHotspots = this.room.hotspotsData.filter((hs) => this.hotspotItemMap.has(hs.id));
    if (itemHotspots.length > 0) {
      const itemsGroup = document.createElement('optgroup');
      itemsGroup.label = 'Items';
      for (const hs of itemHotspots) {
        const itemId = this.hotspotItemMap.get(hs.id)!;
        const opt = document.createElement('option');
        opt.value = hs.id;
        opt.dataset.kind = 'item';
        const propId = this.propIdForItemHotspot(hs.id);
        const targetHint = propId ? ` → ${propId}` : ' → hotspot';
        opt.textContent = `${itemId}${targetHint}`;
        itemsGroup.appendChild(opt);
      }
      this.propLayoutPicker.appendChild(itemsGroup);
    }

    this.propLayoutPicker.value = current;
  }

  private propIdForItemHotspot(hotspotId: string): string | null {
    const normalized = hotspotId.toLowerCase().replace(/_/g, '');
    const match = this.room.propsData.find(
      (p) => p.id.toLowerCase().replace(/_/g, '') === normalized,
    );
    return match?.id ?? null;
  }

  private populateHotspotLayoutPicker(): void {
    if (!this.hotspotLayoutPicker) return;
    const current = this.selectedLayoutHotspotId ?? '';
    this.hotspotLayoutPicker.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— select hotspot —';
    this.hotspotLayoutPicker.appendChild(blank);
    // Always list every hotspot from the loaded room — no hardcoded allowlist.
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
