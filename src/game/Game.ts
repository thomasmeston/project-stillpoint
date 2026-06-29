import * as THREE from 'three';
import { AudioManager } from './AudioManager';
import { GameState } from './GameState';
import { InputController } from './InputController';
import { Inventory } from './Inventory';
import { NarrativeManager } from './NarrativeManager';
import { PlayerMover } from './PlayerMover';
import { PuzzleManager } from './PuzzleManager';
import { SaveLoad } from './SaveLoad';
import { IsoCamera, type CameraSnapshot } from '../scene/IsoCamera';
import { RoomBuilder } from '../scene/RoomBuilder';
import { FallTransition } from '../scene/FallTransition';
import { ViewWallController } from '../scene/ViewWallController';
import { HUD } from '../ui/HUD';
import { MeditationOverlay } from '../ui/MeditationOverlay';
import { PuzzleUI } from '../ui/PuzzleUI';
import { DevMover } from './DevMover';
import { DeskSketchSpread } from '../scene/DeskSketchSpread';
import { getWallNotesFocusOnWall } from '../scene/WallNotesCluster';
import type { WallFace } from '../scene/WallFace';

const INWARD_BY_WALL: Record<Exclude<WallFace, 'floor'>, THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, 1),
  south: new THREE.Vector3(0, 0, -1),
  east: new THREE.Vector3(-1, 0, 0),
  west: new THREE.Vector3(1, 0, 0),
};

const PORTAL_HOTSPOTS = [
  'portal_ship',
  'portal_garden',
  'portal_cavern',
  'portal_observatory',
] as const;

const PORTAL_LESSON_FLAGS: Record<string, string> = {
  portal_garden: 'lesson_2',
  portal_cavern: 'lesson_3',
  portal_observatory: 'lesson_4',
};

/** How far from a hotspot the player stops before examining (metres). */
const HOTSPOT_STANDOFF_FLOOR = 1.2;
const HOTSPOT_STANDOFF_WALL = 1.05;
/** Extra clearance beyond standoff before the examine panel auto-dismisses (metres). */
const EXAMINE_DISMISS_EXTRA = 0.85;

const ROOM_TITLES: Record<string, string> = {
  bedroom: 'Bedroom',
  pirate_ship: 'Ship Deck',
  level_2: 'Garden',
  level_3: 'Cavern',
  level_4: 'Observatory',
};

const ROOM_BACKGROUNDS: Record<string, number> = {
  bedroom: 0x141820,
  pirate_ship: 0x8fc1e3,
  level_2: 0x87ceeb,
  level_3: 0x0a0812,
  level_4: 0x0c0e18,
};

const PORTAL_LEVEL_ROOMS = new Set(['pirate_ship', 'level_2', 'level_3', 'level_4']);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private sceneBg = new THREE.Color(0x141820);
  private isoCamera: IsoCamera;
  private wallCtrl: ViewWallController;
  private room: RoomBuilder;
  private player: PlayerMover;
  private input: InputController;
  private devMover: DevMover;
  private deskSketchSpread: DeskSketchSpread;
  private detailZoomRaycaster = new THREE.Raycaster();

  readonly gameState = new GameState();
  readonly inventory = new Inventory();
  readonly narrative = new NarrativeManager();
  readonly puzzleManager = new PuzzleManager();
  readonly audio = new AudioManager();
  readonly saveLoad = new SaveLoad();
  private hud: HUD;
  private puzzleUI: PuzzleUI;

  private clock = new THREE.Clock();
  private currentSlot: number | null = null;
  private currentRoomId = 'bedroom';
  private inMenu = true;
  private loadMenuFromPause = false;
  private escapeMenuOpen = false;
  private isDeskZoomed = false;
  private isWallNotesZoomed = false;
  private introActive = false;
  private thoughtActive = false;
  private meditateActive = false;
  private fallActive = false;
  private examineAnchorHotspotId: string | null = null;
  private preMeditateCamera: CameraSnapshot | null = null;
  private meditation = new MeditationOverlay();
  private fallTransition = new FallTransition();
  private wordsClickedCount = 0;
  private readonly INTRO_WORDS = [
    // Original 13 words
    'fuzzy', 'tired', 'memory', 'gone', 'here', 'nowhere',
    'fear', 'peace', 'sleep', 'wake', 'dream', 'calm', 'alone',
    // 52 additional similar words (total 65)
    'hazy', 'exhausted', 'mind', 'lost', 'away', 'everywhere',
    'dread', 'quiet', 'rest', 'arise', 'vision', 'still', 'isolated',
    'shadow', 'dark', 'light', 'illusion', 'forgotten', 'remember',
    'hollow', 'numb', 'heavy', 'drift', 'float', 'daze', 'mist',
    'flicker', 'weary', 'fading', 'vanished', 'empty', 'void', 'somewhere',
    'panic', 'terror', 'serenity', 'tranquil', 'slumber', 'alert', 'awake',
    'fantasy', 'nightmare', 'silent', 'peaceful', 'solitude', 'deserted',
    'apart', 'detached', 'confused', 'blurred', 'dim', 'faint'
  ];

  get isDetailZoomed(): boolean {
    return this.isDeskZoomed || this.isWallNotesZoomed;
  }

  get isInputBlocked(): boolean {
    return this.inMenu || this.escapeMenuOpen || this.introActive || this.thoughtActive || this.meditateActive
      || this.fallActive || this.hud.isItemInspectOpen()
      || (this.devMover && this.devMover.isActive());
  }

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene.background = this.sceneBg;

    this.isoCamera = new IsoCamera(window.innerWidth / window.innerHeight);
    this.wallCtrl = new ViewWallController();
    this.wallCtrl.setInMenu(true);

    this.room = new RoomBuilder(this.wallCtrl);
    this.player = new PlayerMover();
    this.scene.add(this.room.root);
    this.scene.add(this.player.root);
    this.scene.add(this.isoCamera.rig);

    this.inventory.bindPuzzleManager(this.puzzleManager);
    this.narrative.bindGameState(this.gameState);
    this.puzzleManager.bind(this.gameState, this.inventory, this.narrative);

    this.hud = new HUD(this.inventory, this.narrative, this.puzzleManager);
    this.puzzleUI = new PuzzleUI();
    this.wirePuzzleUI();
    this.wireEvents();

    this.input = new InputController(
      this.isoCamera.camera,
      this.room.floorMeshes,
      this.room.hotspots.map((h) => h.mesh),
    );
    this.input.isHotspotInteractable = (mesh) => this.wallCtrl.isObjectInteractable(mesh);

    this.devMover = new DevMover(
      this.scene,
      this.isoCamera.camera,
      this.room,
      this.canvas,
      (active) => {
        if (active && this.escapeMenuOpen) {
          this.toggleEscapeMenu();
        }
      }
    );

    this.deskSketchSpread = new DeskSketchSpread(new THREE.Vector3(1.6, 0, -0.1));
    this.room.propsRoot.add(this.deskSketchSpread.group);

    this.wireInput();
    this.wireViewRotation();

    this.puzzleManager.events.on('hotspotStateChanged', (id) => {
      const def = this.puzzleManager.getHotspotDef(id);
      this.room.setHotspotVisible(id, !def.disabled);
      this.syncPickupProps();
    });

    // Wire up autosave event listeners
    this.gameState.events.on('flagChanged', ({ flag }) => {
      if (flag === 'painting_moved' || flag === 'safe_unlocked') {
        this.syncSafeVisuals();
      }
      if (flag === 'meditation_portal_opened' || flag.startsWith('lesson_')) {
        this.syncPortals();
      }
      this.saveGame();
    });
    this.gameState.events.on('puzzleSolved', () => this.saveGame());
    this.inventory.events.on('changed', () => {
      this.syncSafeVisuals();
      this.saveGame();
    });
    this.narrative.events.on('journalUpdated', () => this.saveGame());
    this.puzzleManager.events.on('hotspotStateChanged', () => this.saveGame());

    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    this.initMainMenu();
    this.initEscapeMenu();

    this.renderer.setAnimationLoop(() => this.frame());
  }

  private wirePuzzleUI(): void {
    this.puzzleUI.getInventoryItems = () => this.inventory.items;
    this.puzzleUI.getItemLabel = (id) => this.inventory.getLabel(id);
    this.puzzleUI.onClockSubmit = (id, hour, minute) => {
      if (this.puzzleManager.submitPuzzle(id, { hour, minute })) this.puzzleUI.closeClock();
    };
    this.puzzleUI.onPhotoSubmit = (id, answer) => {
      if (this.puzzleManager.submitPuzzle(id, answer)) this.puzzleUI.closePhoto();
    };
    this.puzzleUI.onPadlockSubmit = (id, answer) => {
      if (this.puzzleManager.submitPuzzle(id, answer)) this.puzzleUI.closePadlock();
    };
    this.puzzleUI.onCombine = (a, b) => this.inventory.tryCombine(a, b);
  }

  private wireEvents(): void {
    this.gameState.events.on('gameWon', () => {
      this.audio.playSfx('door_unlock');
      this.narrative.onWin();
      if (this.currentSlot !== null) {
        this.saveLoad.delete(this.currentSlot);
      }
    });
    this.puzzleManager.events.on('puzzleOpenRequested', ({ puzzleId, puzzleType }) => {
      this.isoCamera.focusOn(this.player.position);
      if (puzzleType === 'clock') this.puzzleUI.openClock(puzzleId);
      if (puzzleType === 'photo_cipher') this.puzzleUI.openPhoto(puzzleId);
      if (puzzleType === 'padlock') this.puzzleUI.openPadlock(puzzleId);
    });
  }

  private wireInput(): void {
    this.hud.onZoomBack = () => this.zoomOutFromDetail();
    this.hud.onMeditate = () => this.toggleMeditate();
    this.hud.onReturnToRoom = () => this.returnToBedroom();
    this.hud.onThoughtBlockingChange = (active) => {
      this.thoughtActive = active;
    };
    this.hud.onExamineDismiss = () => {
      this.examineAnchorHotspotId = null;
    };

    this.input.onFirstInput = () => {
      this.narrative.onFirstInput();
      this.audio.startOnFirstInteraction();
    };
    this.input.onMove = (point) => {
      if (this.isDetailZoomed) return;
      this.player.moveTo(point);
    };
    this.input.onHotspot = (id) => this.handleHotspot(id);

    let isMiddleDragging = false;
    let middleDragStartX = 0;
    let middleDragStartY = 0;
    let hasMiddleDragged = false;
    const DRAG_THRESHOLD = 50;
    const CLICK_TOLERANCE = 5;

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isInputBlocked) return;
      if (e.button === 1) {
        e.preventDefault();
        isMiddleDragging = true;
        middleDragStartX = e.clientX;
        middleDragStartY = e.clientY;
        hasMiddleDragged = false;
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.isInputBlocked) return;
      if (e.button !== 0) return;
      if (this.isDetailZoomed) {
        this.handleDetailZoomClick(e.clientX, e.clientY);
        return;
      }
      this.audio.startOnFirstInteraction();
      this.input.handleClick(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isInputBlocked) return;
      if (this.isDetailZoomed) {
        this.hud.setCursorHintVisible(false);
        return;
      }
      if (isMiddleDragging) {
        this.hud.setCursorHint('', e.clientX, e.clientY);
        const deltaX = e.clientX - middleDragStartX;
        const deltaY = e.clientY - middleDragStartY;
        if (Math.abs(deltaX) > CLICK_TOLERANCE || Math.abs(deltaY) > CLICK_TOLERANCE) {
          hasMiddleDragged = true;
        }
        if (Math.abs(deltaX) > DRAG_THRESHOLD) {
          if (deltaX > 0) {
            this.rotateView('left'); // Drag right -> Rotate left
          } else {
            this.rotateView('right'); // Drag left -> Rotate right
          }
          middleDragStartX = e.clientX;
          middleDragStartY = e.clientY;
        }
      } else {
        this.input.onHover = (_id, hint) => this.hud.setCursorHint(hint, e.clientX, e.clientY);
        this.input.handleMove(e.clientX, e.clientY, (id) => this.hud.getHintForHotspot(id));
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isInputBlocked) return;
      if (e.button === 1) {
        if (isMiddleDragging && !hasMiddleDragged) {
          this.rotateView('left'); // Click -> Rotate counter-clockwise once
        }
        isMiddleDragging = false;
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      if (this.isInputBlocked) return;
      if (this.isDeskZoomed) return;
      e.preventDefault();
      if (e.shiftKey) {
        if (e.deltaY > 0) this.rotateView('right');
        else if (e.deltaY < 0) this.rotateView('left');
      } else {
        this.isoCamera.onWheel(e.deltaY);
      }
    });
  }

  private wireViewRotation(): void {
    document.getElementById('rotate-left')?.addEventListener('click', () => this.rotateView('left'));
    document.getElementById('rotate-right')?.addEventListener('click', () => this.rotateView('right'));

    window.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        e.preventDefault();
        this.toggleDevMode();
        return;
      }

      if (e.key === 'Escape' && this.hud.isItemInspectOpen()) {
        e.preventDefault();
        this.hud.hideItemInspect();
        return;
      }

      if (e.key === 'Escape' && this.loadMenuFromPause) {
        e.preventDefault();
        this.closeLoadSaveScreen();
        return;
      }

      if (this.inMenu) return;
      if (e.repeat) return;

      if (this.isDeskZoomed) return;

      if (e.key === 'Escape') {
        if (this.meditateActive) {
          this.exitMeditate();
          return;
        }
        if (this.introActive) return;
        if (this.devMover && this.devMover.isActive()) return; // Let devMover handle Escape deselect
        this.toggleEscapeMenu();
        return;
      }

      const isDevActive = this.devMover && this.devMover.isActive();
      if (this.inMenu || this.escapeMenuOpen || this.introActive || this.thoughtActive) return;

      if (e.key === 'q' || e.key === 'Q') {
        this.rotateView('left');
      } else if (e.key === 'e' || e.key === 'E') {
        this.rotateView('right');
      } else if (!isDevActive) {
        if (e.key === 'ArrowLeft') this.rotateView('left');
        else if (e.key === 'ArrowRight') this.rotateView('right');
      }
    });
  }

  private toggleDevMode(): void {
    if (this.inMenu || this.introActive || this.thoughtActive || this.meditateActive) return;
    if (this.isDeskZoomed) {
      this.zoomOutFromDesk();
    }
    const active = !this.devMover.isActive();
    this.devMover.setActive(active);
  }

  private rotateView(direction: 'left' | 'right'): void {
    if (this.inMenu || this.escapeMenuOpen || this.introActive || this.thoughtActive || this.meditateActive) return;
    if (this.isDeskZoomed) return;
    if (this.wallCtrl.isAnimating() || this.isoCamera.isRotating()) return;
    this.audio.playSfx('rotate');
    if (direction === 'left') {
      this.isoCamera.rotateLeft();
      this.wallCtrl.rotateLeft();
    } else {
      this.isoCamera.rotateRight();
      this.wallCtrl.rotateRight();
    }
  }

  private handleHotspot(hotspotId: string): void {
    this.audio.playSfx('click');
    this.walkToHotspot(hotspotId, () => {
      this.performHotspotAction(hotspotId);
      this.saveGame();
    });
  }

  private walkToHotspot(hotspotId: string, onArrived: () => void): void {
    let approach: THREE.Vector3;
    if (hotspotId === 'desk') {
      approach = this.getDeskApproachPosition();
    } else if (hotspotId === 'wall_notes') {
      approach = this.getWallNotesApproachPosition();
    } else {
      approach = this.getHotspotApproachPosition(hotspotId);
    }
    this.player.moveTo(approach, onArrived);
  }

  private getHotspotApproachPosition(hotspotId: string): THREE.Vector3 {
    const world = this.room.getHotspotWorldPosition(hotspotId);
    if (!world) return this.player.position.clone();

    const face = this.room.getHotspotWallFace(hotspotId) ?? 'floor';
    const inward = new THREE.Vector3();

    if (face === 'floor') {
      inward.subVectors(this.player.position, world);
      inward.y = 0;
      if (inward.lengthSq() < 0.04) {
        inward.set(0, 0, 1);
      } else {
        inward.normalize();
      }
    } else {
      inward.copy(INWARD_BY_WALL[face]);
    }

    const standoff = face === 'floor' ? HOTSPOT_STANDOFF_FLOOR : HOTSPOT_STANDOFF_WALL;
    return new THREE.Vector3(
      world.x + inward.x * standoff,
      0,
      world.z + inward.z * standoff,
    );
  }

  private performHotspotAction(hotspotId: string): void {
    if (hotspotId.startsWith('portal_')) {
      const target = this.room.getPortalTarget(hotspotId);
      if (target) this.enterPortal(target);
      return;
    }
    const action = this.puzzleManager.getHotspotAction(hotspotId);
    if (action === 'locked') {
      this.narrative.showThought(hotspotId === 'door' ? 'door_locked' : 'locked_hint');
      return;
    }
    let handled = false;
    if (this.inventory.selectedItem) {
      if (this.puzzleManager.tryUseItemOnHotspot(this.inventory.selectedItem, hotspotId)) {
        handled = true;
      }
    }
    if (!handled) {
      if (hotspotId === 'wall_safe') {
        this.handleWallSafe();
        return;
      }
      switch (action) {
        case 'pickup':
          this.handlePickup(hotspotId);
          break;
        case 'open_puzzle':
          if (hotspotId === 'wall_clock' && this.inspectClockIfNeeded()) {
            break;
          }
          this.openPuzzle(hotspotId);
          break;
        case 'combine':
          this.puzzleUI.openCombine();
          break;
        case 'examine':
          if (hotspotId === 'desk') {
            if (!this.isDetailZoomed) this.zoomToDesk();
          } else if (hotspotId === 'wall_notes') {
            if (!this.isDetailZoomed) {
              this.showHotspotExamine('wall_notes');
              this.zoomToWallNotes();
            }
          } else {
            this.handleExamine(hotspotId);
          }
          break;
        default:
          this.showHotspotExamine(hotspotId);
      }
    }
  }

  private showHotspotExamine(hotspotId: string): void {
    this.examineAnchorHotspotId = hotspotId;
    this.narrative.onExamine(hotspotId);
  }

  private updateExamineDismiss(): void {
    if (!this.hud.isExamineOpen() || !this.examineAnchorHotspotId || this.isDetailZoomed) return;

    const world = this.room.getHotspotWorldPosition(this.examineAnchorHotspotId);
    if (!world) return;

    const face = this.room.getHotspotWallFace(this.examineAnchorHotspotId) ?? 'floor';
    const standoff = face === 'floor' ? HOTSPOT_STANDOFF_FLOOR : HOTSPOT_STANDOFF_WALL;
    const maxDistSq = (standoff + EXAMINE_DISMISS_EXTRA) ** 2;

    const dx = this.player.position.x - world.x;
    const dz = this.player.position.z - world.z;
    if (dx * dx + dz * dz > maxDistSq) {
      this.hud.hideExamine();
    }
  }

  private handleExamine(hotspotId: string): void {
    if (hotspotId === 'painting') {
      this.handlePaintingExamine();
      return;
    }
    if (hotspotId === 'desk_drawer' && this.gameState.hasFlag('desk_drawer_unlocked')) {
      if (!this.inventory.hasItem('photo_set')) this.inventory.addItem('photo_set');
      if (!this.inventory.hasItem('receipt_stub')) this.inventory.addItem('receipt_stub');
    }
    this.showHotspotExamine(hotspotId);
  }

  private handleWallSafe(): void {
    if (!this.gameState.hasFlag('painting_moved')) return;

    if (this.gameState.hasFlag('safe_unlocked')) {
      if (!this.inventory.hasItem('key_blade')) this.inventory.addItem('key_blade');
      if (!this.inventory.hasItem('phone')) this.inventory.addItem('phone');
      this.syncSafeVisuals();
      this.showHotspotExamine('wall_safe');
      return;
    }

    if (this.gameState.hasFlag('safe_combo_known')) {
      this.puzzleManager.requestPuzzle('wall_safe_lock');
      return;
    }

    this.showHotspotExamine('wall_safe_locked');
  }

  private syncSafeVisuals(): void {
    this.room.syncSafeContents(
      this.gameState.hasFlag('painting_moved'),
      this.gameState.hasFlag('safe_unlocked'),
      this.inventory.hasItem('phone'),
    );
  }

  private syncPickupProps(): void {
    if (this.currentRoomId !== 'bedroom') return;
    const scrapTaken = this.puzzleManager.getHotspotDef('calendar_scrap').disabled;
    this.room.setPropVisible('CalendarScrap', !scrapTaken);
  }

  private handlePaintingExamine(): void {
    const openPhotoIfReady = (): void => {
      if (
        this.inventory.hasItem('photo_set')
        && !this.gameState.isPuzzleSolved('photo_cipher')
      ) {
        this.puzzleManager.requestPuzzle('photo_cipher');
      }
    };

    this.showHotspotExamine('painting');

    if (this.gameState.hasFlag('painting_moved')) {
      openPhotoIfReady();
      return;
    }

    if (this.room.paintingReveal.isAnimating()) return;

    this.room.paintingReveal.swingOpen(() => {
      this.puzzleManager.applyConsequence('set_flag:painting_moved');
      openPhotoIfReady();
    });
  }

  private handlePickup(hotspotId: string): void {
    const def = this.puzzleManager.getHotspotDef(hotspotId);
    const itemId = def.item ?? '';
    if (!itemId) {
      this.showHotspotExamine(hotspotId);
      return;
    }
    if (this.inventory.addItem(itemId)) {
      this.puzzleManager.applyConsequence(`disable_hotspot:${hotspotId}`);
      this.showHotspotExamine(hotspotId);
    }
  }

  private handleDetailZoomClick(clientX: number, clientY: number): void {
    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    this.detailZoomRaycaster.setFromCamera(mouse, this.isoCamera.camera);

    if (this.isDeskZoomed) {
      const hit = this.deskSketchSpread.raycastHit(this.detailZoomRaycaster);
      if (!hit) {
        if (this.deskSketchSpread.isInspecting()) {
          this.deskSketchSpread.dismissInspect();
        }
        return;
      }
      if (hit.type === 'sketchbook') {
        this.audio.playSfx('click');
        this.deskSketchSpread.toggleNotebook();
        return;
      }
      if (hit.type === 'paper') {
        this.audio.playSfx('click');
        this.deskSketchSpread.inspectPaper(hit.index);
      }
      return;
    }

    if (this.isWallNotesZoomed) {
      const hit = this.room.wallNotesCluster.raycastHit(this.detailZoomRaycaster);
      if (!hit) {
        if (this.room.wallNotesCluster.isInspecting()) {
          this.room.wallNotesCluster.dismissInspect();
        }
        return;
      }
      if (hit.type === 'paper') {
        this.audio.playSfx('click');
        this.room.wallNotesCluster.inspectPaper(hit.index);
      }
    }
  }

  /** Called from e2e tests and dev tooling. */
  handleDeskExamine(): void {
    if (this.isDetailZoomed) return;
    this.walkToHotspot('desk', () => {
      this.zoomToDesk();
    });
  }

  private getWallNotesApproachPosition(): THREE.Vector3 {
    const focus = getWallNotesFocusOnWall();
    return new THREE.Vector3(focus.x, 0, 1.3);
  }

  private getWallNotesTarget(): THREE.Vector3 {
    const northWall = this.room.wallMeshes.get('north');
    const localTarget = getWallNotesFocusOnWall();
    if (northWall) {
      northWall.updateMatrixWorld(true);
      return localTarget.applyMatrix4(northWall.matrixWorld);
    }
    return new THREE.Vector3(localTarget.x, 1.55, -2.92);
  }

  private zoomToWallNotes(): void {
    this.isWallNotesZoomed = true;
    this.player.root.visible = false;
    this.isoCamera.zoomTo(this.getWallNotesTarget(), 1.15, 0, 0);
    this.hud.showZoomControls(true);
    this.hud.setCursorHintVisible(false);
  }

  private zoomOutFromWallNotes(): void {
    if (!this.isWallNotesZoomed) return;
    this.isWallNotesZoomed = false;
    this.player.root.visible = true;
    this.room.wallNotesCluster.resetInspect();
    this.hud.hideExamine();

    const currentViewYaw = this.isoCamera.getYawForViewIndex(this.isoCamera.getViewIndex());
    const ISO_PITCH = THREE.MathUtils.degToRad(-35);
    this.isoCamera.zoomTo(new THREE.Vector3(0, 0.9, 0.0), 10, ISO_PITCH, currentViewYaw);
    this.hud.showZoomControls(false);
    this.hud.setCursorHintVisible(true);
  }

  private zoomOutFromDetail(): void {
    if (this.isDeskZoomed) this.zoomOutFromDesk();
    else if (this.isWallNotesZoomed) this.zoomOutFromWallNotes();
  }

  /** First visit to the clock is examine-only; unlocks the first meditation portal afterward. */
  private inspectClockIfNeeded(): boolean {
    if (this.gameState.hasFlag('clock_inspected')) return false;
    this.gameState.setFlag('clock_inspected');
    this.showHotspotExamine('wall_clock');
    return true;
  }

  private updateMeditateAvailability(): void {
    this.hud.setMeditateAvailable(this.currentRoomId === 'bedroom');
  }

  private toggleMeditate(): void {
    if (this.inMenu || this.introActive || this.thoughtActive || this.isDetailZoomed || this.fallActive) return;
    if (this.currentRoomId !== 'bedroom') return;
    if (this.meditateActive) {
      this.exitMeditate();
    } else {
      this.enterMeditate();
    }
  }

  private enterMeditate(): void {
    if (this.escapeMenuOpen) this.toggleEscapeMenu();
    this.player.cancelMovement();
    this.preMeditateCamera = this.isoCamera.captureSnapshot();

    const head = this.player.getHeadWorldPosition();
    const faceYaw = this.player.getFacingYaw();
    this.isoCamera.zoomTo(
      head,
      0.88,
      THREE.MathUtils.degToRad(-6),
      faceYaw,
    );

    const canOpenPortal = this.currentRoomId === 'bedroom'
      && this.gameState.hasFlag('clock_inspected')
      && !this.gameState.hasFlag('meditation_portal_opened');

    this.meditation.show(this.narrative.getMeditationFragments(), {
      canOpenPortal,
      onPortalUnlocked: () => {
        this.gameState.setFlag('meditation_portal_opened', true);
        this.saveGame();
      },
    });
    this.meditateActive = true;
    this.hud.setMeditating(true);
    this.hud.setCursorHintVisible(false);
    this.audio.playSfx('click');
  }

  private exitMeditate(): void {
    if (this.preMeditateCamera) {
      this.isoCamera.restoreSnapshot(this.preMeditateCamera);
      this.preMeditateCamera = null;
    }
    this.meditation.hide();
    this.meditateActive = false;
    this.hud.setMeditating(false);
    this.hud.setCursorHintVisible(true);

    // Reveal the ship portal after the first successful meditation hold.
    if (
      this.currentRoomId === 'bedroom'
      && this.gameState.hasFlag('meditation_portal_opened')
    ) {
      const wasShipVisible = this.room.portals.get('portal_ship')?.group.visible ?? false;
      this.syncPortals();
      if (!wasShipVisible) {
        this.room.revealPortals(['portal_ship']);
      }
      this.refreshHotspotVisibility();
    }
  }

  private enterPortal(targetRoom: string): void {
    if (this.fallActive) return;
    this.fallActive = true;
    this.player.cancelMovement();
    this.audio.playSfx('rotate');
    this.fallTransition.playFall(
      () => {
        this.loadRoom(targetRoom);
        this.player.setPosition(this.room.playerSpawn);
        this.saveGame();
      },
      () => {
        this.fallActive = false;
        this.onPortalArrival(targetRoom);
      },
    );
  }

  private onPortalArrival(roomId: string): void {
    if (roomId === 'pirate_ship') {
      this.narrative.addJournalEntry('ship_arrival');
      this.narrative.showThought('ship_arrival');
      return;
    }
    this.narrative.onRoomArrival();
  }

  private loadRoom(roomId: string): void {
    this.scene.remove(this.room.root);
    this.room.disposePortals();
    this.disposeObject3D(this.room.root);
    this.wallCtrl.reset();
    this.wallCtrl.setInMenu(this.inMenu);

    this.room = new RoomBuilder(this.wallCtrl, roomId);
    this.currentRoomId = roomId;
    this.scene.add(this.room.root);

    if (roomId === 'bedroom') {
      this.room.propsRoot.add(this.deskSketchSpread.group);
    }

    this.puzzleManager.loadRoom(roomId);
    this.narrative.loadRoom(roomId);

    this.input.setTargets(this.room.floorMeshes, this.room.hotspots.map((h) => h.mesh));
    this.devMover.setRoom(this.room);

    this.scene.background = new THREE.Color(ROOM_BACKGROUNDS[roomId] ?? ROOM_BACKGROUNDS.bedroom);
    this.hud.setRoomTitle(ROOM_TITLES[roomId] ?? 'Bedroom');
    this.updateMeditateAvailability();
    this.hud.setReturnToRoomVisible(PORTAL_LEVEL_ROOMS.has(roomId));

    this.refreshHotspotVisibility();

    if (roomId === 'bedroom') {
      this.syncSafeVisuals();
      this.syncPickupProps();
      this.room.syncPaintingReveal(
        this.gameState.hasFlag('painting_moved'),
        this.gameState.hasFlag('safe_unlocked'),
        this.inventory.hasItem('phone'),
      );
      this.syncPortals();
    }

    this.isoCamera.setViewIndex(0);
    this.wallCtrl.setViewIndex(0);
  }

  private returnToBedroom(): void {
    if (this.currentRoomId === 'bedroom' || this.inMenu || this.fallActive) return;
    this.fallActive = true;
    this.player.cancelMovement();
    this.audio.playSfx('click');
    this.fallTransition.playReturn(
      () => {
        this.loadRoom('bedroom');
        this.player.setPosition(this.room.playerSpawn);
        this.saveGame();
      },
      () => {
        this.fallActive = false;
      },
    );
  }

  private refreshHotspotVisibility(): void {
    for (const hs of this.room.hotspots) {
      const def = this.puzzleManager.getHotspotDef(hs.id);
      this.room.setHotspotVisible(hs.id, !def.disabled);
    }
  }

  private getSolvedPortalIds(): string[] {
    const solved: string[] = [];
    if (this.gameState.hasFlag('lesson_1')) {
      solved.push('portal_ship');
    }
    for (const [portalId, flag] of Object.entries(PORTAL_LESSON_FLAGS)) {
      if (this.gameState.hasFlag(flag)) {
        solved.push(portalId);
      }
    }
    return solved;
  }

  private getRevealedPortalIds(): string[] {
    const revealed: string[] = [];
    if (this.gameState.hasFlag('meditation_portal_opened')) {
      revealed.push('portal_ship');
    }
    for (const [portalId, lessonFlag] of Object.entries(PORTAL_LESSON_FLAGS)) {
      if (this.gameState.hasFlag(lessonFlag)) {
        revealed.push(portalId);
      }
    }
    return revealed;
  }

  private syncPortals(): void {
    if (this.currentRoomId !== 'bedroom') return;
    const revealedIds = this.getRevealedPortalIds();
    for (const id of PORTAL_HOTSPOTS) {
      if (revealedIds.includes(id)) {
        this.puzzleManager.applyConsequence(`enable_hotspot:${id}`);
      } else {
        this.puzzleManager.applyConsequence(`disable_hotspot:${id}`);
      }
    }
    this.room.syncPortals(revealedIds, this.getSolvedPortalIds());
    this.refreshHotspotVisibility();
  }

  private disposeObject3D(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else if (material) {
        (material as THREE.Material).dispose();
      }
    });
  }

  private getDeskApproachPosition(): THREE.Vector3 {
    const deskMesh = this.room.propsRoot.getObjectByName('Desk') || this.room.root.getObjectByName('Desk');
    if (deskMesh) {
      deskMesh.updateMatrixWorld(true);
      const deskPos = new THREE.Vector3();
      deskMesh.getWorldPosition(deskPos);
      // Stand south of the desk (+Z), clear of chair/desk collision boxes
      return new THREE.Vector3(deskPos.x - 0.3, 0, deskPos.z + 1.15);
    }
    return new THREE.Vector3(1.5, 0, 0.85);
  }

  private getDeskSurfaceTarget(): THREE.Vector3 {
    const deskMesh = this.room.propsRoot.getObjectByName('Desk') || this.room.root.getObjectByName('Desk');
    const deskTarget = new THREE.Vector3();
    if (deskMesh) {
      deskMesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(deskMesh);
      deskTarget.set(
        (box.min.x + box.max.x) * 0.5,
        box.max.y,
        (box.min.z + box.max.z) * 0.5,
      );
    } else {
      deskTarget.set(1.8, 0.75, 0.0);
    }
    return deskTarget;
  }

  private zoomToDesk(): void {
    this.isDeskZoomed = true;
    this.isoCamera.zoomTo(this.getDeskSurfaceTarget(), 1.4, -Math.PI / 2, 0);
    this.hud.showZoomControls(true);
    this.hud.setCursorHintVisible(false);
  }

  private zoomOutFromDesk(): void {
    if (!this.isDeskZoomed) return;
    this.isDeskZoomed = false;
    this.deskSketchSpread.reset();

    const deskTarget = this.getDeskSurfaceTarget();
    deskTarget.y += 0.1;
    const currentViewYaw = this.isoCamera.getYawForViewIndex(this.isoCamera.getViewIndex());
    const ISO_PITCH = THREE.MathUtils.degToRad(-35);
    this.isoCamera.zoomTo(deskTarget, 3.5, ISO_PITCH, currentViewYaw);
    this.hud.showZoomControls(false);
    this.hud.setCursorHintVisible(true);
  }

  private openPuzzle(hotspotId: string): void {
    const def = this.puzzleManager.getHotspotDef(hotspotId);
    const puzzleId = def.puzzle ?? '';
    if (!puzzleId) {
      this.showHotspotExamine(hotspotId);
      return;
    }
    this.puzzleManager.requestPuzzle(puzzleId);
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.isoCamera.resize(window.innerWidth, window.innerHeight);
  }

  private initMainMenu(): void {
    const mainMenuEl = document.getElementById('main-menu');
    if (!mainMenuEl) return;

    for (let slot = 1; slot <= 3; slot++) {
      this.refreshSlotCard(slot);
    }

    mainMenuEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target || !target.classList.contains('menu-btn')) return;

      if (target.id === 'menu-back-btn') {
        this.closeLoadSaveScreen();
        return;
      }

      const slotAttr = target.getAttribute('data-slot');
      if (!slotAttr) return;
      const slot = parseInt(slotAttr, 10);

      if (target.classList.contains('new-game-btn')) {
        this.startNewGame(slot);
      } else if (target.classList.contains('load-game-btn')) {
        this.loadGame(slot);
      } else if (target.classList.contains('delete-btn')) {
        this.deleteSlot(slot);
      }
    });
  }

  private refreshSlotCard(slot: number): void {
    const infoEl = document.getElementById(`slot-info-${slot}`);
    const cardEl = document.getElementById(`slot-card-${slot}`);
    const loadBtn = document.querySelector(`.load-game-btn[data-slot="${slot}"]`);
    const deleteBtn = document.querySelector(`.delete-btn[data-slot="${slot}"]:not(.new-game-btn)`);
    const newBtn = document.querySelector(`.new-game-btn[data-slot="${slot}"]`);

    if (!infoEl || !cardEl || !newBtn) return;

    if (this.saveLoad.hasSave(slot)) {
      cardEl.classList.add('in-progress');
      const data = this.saveLoad.load(slot);
      let infoText = 'In Progress';
      if (data && data.timestamp) {
        const date = new Date(data.timestamp as number);
        infoText = `Saved:<br>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      infoEl.innerHTML = infoText;

      loadBtn?.classList.remove('hidden');
      deleteBtn?.classList.remove('hidden');
      newBtn.textContent = 'Reset Slot';
      newBtn.classList.add('delete-btn');
    } else {
      cardEl.classList.remove('in-progress');
      infoEl.textContent = 'Empty Slot';

      loadBtn?.classList.add('hidden');
      deleteBtn?.classList.add('hidden');
      newBtn.textContent = 'New Game';
      newBtn.classList.remove('delete-btn');
    }
  }

  private startNewGame(slot: number): void {
    this.saveLoad.delete(slot);
    this.currentSlot = slot;
    if (this.currentRoomId !== 'bedroom') {
      this.loadRoom('bedroom');
    }
    this.resetSessionForNewGame();
    this.player.setPosition(this.room.playerSpawn);
    this.transitionToGame();
    this.saveGame();
  }

  private resetSessionForNewGame(): void {
    this.gameState.resetForNewGame();
    this.inventory.resetForNewGame();
    this.narrative.resetForNewGame();
    this.puzzleManager.resetForNewGame();

    this.introActive = false;
    this.meditateActive = false;
    this.fallActive = false;
    this.escapeMenuOpen = false;
    this.isDeskZoomed = false;
    this.isWallNotesZoomed = false;
    this.wordsClickedCount = 0;

    this.meditation.hide();
    this.deskSketchSpread.reset();
    this.room.wallNotesCluster.resetInspect();
    this.room.syncPaintingReveal(false, false, false);
    this.syncPortals();
    this.syncSafeVisuals();

    document.getElementById('escape-menu')?.classList.add('hidden');
    document.getElementById('win-overlay')?.classList.add('hidden');
    document.getElementById('intro-words-overlay')?.classList.add('hidden');
    document.getElementById('meditate-overlay')?.classList.add('hidden');
    document.getElementById('hud')?.classList.add('hidden');

    for (const id of this.room.hotspots.map((h) => h.id)) {
      const def = this.puzzleManager.getHotspotDef(id);
      this.room.setHotspotVisible(id, !def.disabled);
    }

    this.hud.refreshJournal();
    this.hud.showZoomControls(false);
    this.hud.setMeditating(false);
    this.hud.setRoomTitle('Bedroom');
    this.updateMeditateAvailability();
    this.hud.setReturnToRoomVisible(false);
  }

  private loadGame(slot: number): void {
    const data = this.saveLoad.load(slot);
    if (!data) return;

    this.currentSlot = slot;

    if (data.gameState) {
      this.gameState.loadSaveData(data.gameState as any);
    }
    if (data.inventory) {
      this.inventory.loadSaveData(data.inventory as any);
    }
    if (data.narrative) {
      this.narrative.loadSaveData(data.narrative as any);
    }

    const savedRoom = (data.currentRoom as string) ?? 'bedroom';
    this.loadRoom(savedRoom);

    if (data.puzzleManager) {
      this.puzzleManager.loadSaveData(data.puzzleManager as any);
    }
    this.refreshHotspotVisibility();

    if (data.playerPosition) {
      const pos = data.playerPosition as { x: number; y: number; z: number };
      this.player.setPosition(pos);
    }

    if (savedRoom === 'bedroom') {
      this.syncSafeVisuals();
      this.room.syncPaintingReveal(
        this.gameState.hasFlag('painting_moved'),
        this.gameState.hasFlag('safe_unlocked'),
        this.inventory.hasItem('phone'),
      );
      this.syncPortals();
    }

    this.updateMeditateAvailability();
    this.transitionToGame();
  }

  private deleteSlot(slot: number): void {
    if (confirm(`Are you sure you want to delete Slot ${slot}?`)) {
      this.saveLoad.delete(slot);
      this.refreshSlotCard(slot);
    }
  }

  private transitionToGame(): void {
    this.inMenu = false;
    this.loadMenuFromPause = false;
    this.wallCtrl.setInMenu(false);

    this.isoCamera.setViewIndex(0);
    this.wallCtrl.setViewIndex(0);

    const menuEl = document.getElementById('main-menu');
    if (menuEl) {
      menuEl.classList.add('fade-out');
      setTimeout(() => menuEl.classList.add('hidden'), 500);
    }
    document.getElementById('menu-back-btn')?.classList.add('hidden');

    if (!this.gameState.hasFlag('intro_words_cleared')) {
      this.introActive = true;
      this.startIntroSequence();
    } else {
      this.introActive = false;
      const hudEl = document.getElementById('hud');
      if (hudEl) {
        hudEl.classList.remove('hidden');
      }
    }

    this.hud.refreshJournal();
  }

  private startIntroSequence(): void {
    this.wordsClickedCount = 0;
    const overlay = document.getElementById('intro-words-overlay');
    if (!overlay) return;

    document.getElementById('hud')?.classList.add('hidden');
    document.getElementById('meditate-overlay')?.classList.add('hidden');

    overlay.innerHTML = '';
    overlay.classList.remove('hidden', 'fade-out');

    this.spawnIntroWords(overlay);
  }
  private spawnIntroWords(overlay: HTMLElement): void {
    // Generate grid slots (8x9 = 72 slots) to avoid overlapping 65 words
    const slots: { col: number; row: number }[] = [];
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 9; r++) {
        slots.push({ col: c, row: r });
      }
    }

    // Shuffle slots
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    this.INTRO_WORDS.forEach((word, idx) => {
      if (idx >= slots.length) return;
      const slot = slots[idx];

      const containerEl = document.createElement('div');
      containerEl.className = 'intro-word-container';

      const wordEl = document.createElement('span');
      wordEl.className = 'intro-word';
      wordEl.textContent = word;

      // Randomize coordinates within slot boundaries
      // Column width: 100/8 = 12.5%. Keep X between 2% and 94% total.
      const left = 2 + slot.col * 12 + Math.random() * 8;

      // Row height: 100/9 = 11.1%. Keep Y between 5% and 92% total.
      const top = 5 + slot.row * 10 + Math.random() * 6;

      containerEl.style.left = `${left}%`;
      containerEl.style.top = `${top}%`;

      // Random size with a wide difference: between 0.7rem (very small) and 5.5rem (very large)
      // ~33% very small, ~33% medium, ~34% very large (about 1/3 very large)
      const randVal = Math.random();
      let fontSize = 1.8; // Default medium size
      if (randVal < 0.33) {
        // ~33% chance of being very small: 0.7rem to 1.2rem
        fontSize = 0.7 + Math.random() * 0.5;
      } else if (randVal < 0.66) {
        // ~33% chance of being medium: 1.4rem to 3.0rem
        fontSize = 1.4 + Math.random() * 1.6;
      } else {
        // ~34% chance of being very large: 3.5rem to 5.5rem
        fontSize = 3.5 + Math.random() * 2.0;
      }
      wordEl.style.fontSize = `${fontSize}rem`;

      // Randomize float animation properties on the container
      const duration = 8 + Math.random() * 8; // 8s to 16s
      const delay = -Math.random() * duration; // Negative delay so they start animated
      containerEl.style.animationDuration = `${duration}s`;
      containerEl.style.animationDelay = `${delay}s`;

      wordEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleIntroWordClick(wordEl);
      });
      containerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleIntroWordClick(wordEl);
      });

      containerEl.appendChild(wordEl);
      overlay.appendChild(containerEl);
    });
  }
  private handleIntroWordClick(wordEl: HTMLElement): void {
    if (wordEl.classList.contains('clicked')) return;
    wordEl.classList.add('clicked');
    this.audio.playSfx('click');

    this.wordsClickedCount++;

    if (this.wordsClickedCount >= 5) {
      this.completeIntroSequence();
    }
  }

  private completeIntroSequence(): void {
    const overlay = document.getElementById('intro-words-overlay');
    if (!overlay) return;

    overlay.querySelectorAll('.intro-word').forEach((word) => {
      word.classList.add('clicked');
    });

    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
    }, 1000);

    this.introActive = false;
    this.gameState.setFlag('intro_words_cleared', true);
    this.narrative.showThought('wake_beside_bed');
    this.saveGame();

    const hudEl = document.getElementById('hud');
    if (hudEl) {
      hudEl.classList.remove('hidden');
    }
  }

  private saveGame(): void {
    if (this.inMenu || this.currentSlot === null) return;
    this.saveLoad.save(
      this.gameState,
      this.inventory,
      this.narrative,
      this.puzzleManager,
      this.player.position,
      this.currentSlot,
      this.currentRoomId,
    );
  }

  private frame(): void {
    const dt = this.clock.getDelta();
    if (this.inMenu) {
      this.isoCamera.menuRotate(dt);
      this.isoCamera.update(dt);
      this.wallCtrl.update(dt);
      this.player.update(dt);
      this.renderer.render(this.scene, this.isoCamera.camera);
      return;
    }

    const wasMoving = this.player.isMoving;
    this.isoCamera.update(dt);
    this.wallCtrl.update(dt);
    this.deskSketchSpread.update(dt);
    this.room.paintingReveal.update(dt);
    this.room.wallNotesCluster.update(dt);
    this.room.updatePortals(dt);
    this.player.update(dt, this.room.obstacles, this.room.shellSize);
    this.updateExamineDismiss();

    if (wasMoving && !this.player.isMoving) {
      this.saveGame();
    }

    this.renderer.render(this.scene, this.isoCamera.camera);
  }

  private initEscapeMenu(): void {
    const resumeBtn = document.getElementById('resume-btn');
    const loadSaveBtn = document.getElementById('load-save-btn');
    const muteMusicCheck = document.getElementById('mute-music') as HTMLInputElement;
    const musicVolumeSlider = document.getElementById('music-volume') as HTMLInputElement;
    const devToggleBtn = document.getElementById('dev-toggle-btn');

    resumeBtn?.addEventListener('click', () => this.toggleEscapeMenu());
    loadSaveBtn?.addEventListener('click', () => this.openLoadSaveScreen());
    devToggleBtn?.addEventListener('click', () => this.toggleDevMode());

    muteMusicCheck?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.audio.setBgmMuted(target.checked);
    });

    musicVolumeSlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.audio.setBgmVolume(parseFloat(target.value));
    });
  }

  private toggleEscapeMenu(): void {
    if (this.inMenu) return;
    this.escapeMenuOpen = !this.escapeMenuOpen;

    const escapeMenuEl = document.getElementById('escape-menu');
    const muteMusicCheck = document.getElementById('mute-music') as HTMLInputElement;
    const musicVolumeSlider = document.getElementById('music-volume') as HTMLInputElement;

    if (this.escapeMenuOpen) {
      if (muteMusicCheck) {
        muteMusicCheck.checked = this.audio.isBgmMuted();
      }
      if (musicVolumeSlider) {
        musicVolumeSlider.value = this.audio.getBgmVolume().toString();
      }
      escapeMenuEl?.classList.remove('hidden');
    } else {
      escapeMenuEl?.classList.add('hidden');
    }
  }

  private openLoadSaveScreen(): void {
    this.escapeMenuOpen = false;
    document.getElementById('escape-menu')?.classList.add('hidden');

    this.loadMenuFromPause = true;
    this.inMenu = true;
    this.wallCtrl.setInMenu(true);

    for (let slot = 1; slot <= 3; slot++) {
      this.refreshSlotCard(slot);
    }

    const menuEl = document.getElementById('main-menu');
    menuEl?.classList.remove('hidden', 'fade-out');
    document.getElementById('menu-back-btn')?.classList.remove('hidden');
  }

  private closeLoadSaveScreen(): void {
    this.loadMenuFromPause = false;
    this.inMenu = false;
    this.wallCtrl.setInMenu(false);

    const menuEl = document.getElementById('main-menu');
    menuEl?.classList.add('hidden');
    menuEl?.classList.remove('fade-out');
    document.getElementById('menu-back-btn')?.classList.add('hidden');
  }
}
