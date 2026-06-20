import * as THREE from 'three';
import { AudioManager } from './AudioManager';
import { GameState } from './GameState';
import { InputController } from './InputController';
import { Inventory } from './Inventory';
import { NarrativeManager } from './NarrativeManager';
import { PlayerMover } from './PlayerMover';
import { PuzzleManager } from './PuzzleManager';
import { SaveLoad } from './SaveLoad';
import { IsoCamera } from '../scene/IsoCamera';
import { RoomBuilder } from '../scene/RoomBuilder';
import { ViewWallController } from '../scene/ViewWallController';
import { HUD } from '../ui/HUD';
import { PuzzleUI } from '../ui/PuzzleUI';
import { DevMover } from './DevMover';

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
  private inMenu = true;
  private escapeMenuOpen = false;
  private isDeskZoomed = false;
  private introActive = false;
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

  get isInputBlocked(): boolean {
    return this.inMenu || this.escapeMenuOpen || this.introActive || (this.devMover && this.devMover.isActive());
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

    this.wireInput();
    this.wireViewRotation();

    this.puzzleManager.events.on('hotspotStateChanged', (id) => {
      const def = this.puzzleManager.getHotspotDef(id);
      this.room.setHotspotVisible(id, !def.disabled);
    });

    // Wire up autosave event listeners
    this.gameState.events.on('flagChanged', () => this.saveGame());
    this.gameState.events.on('puzzleSolved', () => this.saveGame());
    this.inventory.events.on('changed', () => this.saveGame());
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
    this.hud.onZoomBack = () => this.zoomOutFromDesk();

    this.input.onFirstInput = () => {
      this.narrative.onFirstInput();
      this.audio.startOnFirstInteraction();
    };
    this.input.onMove = (point) => {
      if (this.isDeskZoomed) {
        this.zoomOutFromDesk();
        return;
      }
      if (this.player.isSitting) {
        this.standUp();
      }
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
      this.audio.startOnFirstInteraction();
      this.input.handleClick(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isInputBlocked) return;
      if (this.isDeskZoomed) return; // Block rotation drag when zoomed top-down
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
      if (this.isDeskZoomed) return; // Block wheel zoom when zoomed top-down
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

      if (this.inMenu) return;
      if (e.repeat) return;

      if (this.isDeskZoomed) {
        if (e.key === 'Escape') {
          this.zoomOutFromDesk();
          return;
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          return; // Block rotation
        }
      }

      if (e.key === 'Escape') {
        if (this.introActive) return;
        if (this.devMover && this.devMover.isActive()) return; // Let devMover handle Escape deselect
        this.toggleEscapeMenu();
        return;
      }

      const isDevActive = this.devMover && this.devMover.isActive();
      if (this.inMenu || this.escapeMenuOpen || this.introActive) return;

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
    if (this.inMenu || this.introActive) return;
    if (this.player.isSitting) {
      this.standUp();
    }
    const active = !this.devMover.isActive();
    this.devMover.setActive(active);
  }

  private rotateView(direction: 'left' | 'right'): void {
    if (this.inMenu || this.escapeMenuOpen || this.introActive) return;
    if (this.wallCtrl.isAnimating() || this.isoCamera.isRotating()) return;
    if (this.player.isSitting) {
      this.standUp();
    }
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
    const action = this.puzzleManager.getHotspotAction(hotspotId);
    if (action === 'locked') {
      this.narrative.showThought('locked_hint');
      return;
    }
    let handled = false;
    if (this.inventory.selectedItem) {
      if (this.puzzleManager.tryUseItemOnHotspot(this.inventory.selectedItem, hotspotId)) {
        handled = true;
      }
    }
    if (!handled) {
      switch (action) {
        case 'pickup':
          this.handlePickup(hotspotId);
          break;
        case 'open_puzzle':
          this.openPuzzle(hotspotId);
          break;
        case 'combine':
          this.puzzleUI.openCombine();
          break;
        case 'examine':
          if (hotspotId === 'desk') {
            if (this.player.isSitting) {
              this.zoomToDesk();
            } else {
              this.handleSit(true);
            }
          } else {
            this.handleExamine(hotspotId);
          }
          break;
        case 'sit':
          this.handleSit();
          break;
        default:
          this.narrative.onExamine(hotspotId);
      }
    }
    this.saveGame();
  }

  private handleExamine(hotspotId: string): void {
    if (hotspotId === 'desk_drawer' && this.gameState.hasFlag('desk_drawer_unlocked')) {
      if (!this.inventory.hasItem('photo_set')) this.inventory.addItem('photo_set');
      if (!this.inventory.hasItem('receipt_stub')) this.inventory.addItem('receipt_stub');
    }
    if (hotspotId === 'wall_safe' && this.gameState.hasFlag('painting_moved')) {
      if (!this.inventory.hasItem('key_blade')) this.inventory.addItem('key_blade');
    }
    this.narrative.onExamine(hotspotId);
  }

  private handlePickup(hotspotId: string): void {
    const def = this.puzzleManager.getHotspotDef(hotspotId);
    const itemId = def.item ?? '';
    if (!itemId) {
      this.narrative.onExamine(hotspotId);
      return;
    }
    if (this.inventory.addItem(itemId)) {
      this.puzzleManager.applyConsequence(`disable_hotspot:${hotspotId}`);
      this.narrative.onExamine(hotspotId);
    }
  }

  private handleSit(zoomTopDown = false): void {
    const chairMesh = this.room.propsRoot.getObjectByName('Chair') || this.room.root.getObjectByName('Chair');
    if (!chairMesh) return;

    // Get chair world position and rotation
    chairMesh.updateMatrixWorld(true);
    const chairWorldPos = new THREE.Vector3();
    chairMesh.getWorldPosition(chairWorldPos);
    
    // Copy chair rotation
    const chairRotation = chairMesh.rotation.clone();

    // Get chair's forward direction to offset the ready-to-sit position in front of it
    const forward = new THREE.Vector3();
    chairMesh.getWorldDirection(forward);
    
    const sitFrontPos = chairWorldPos.clone().addScaledVector(forward, 0.45);
    sitFrontPos.y = 0; // Walk target is on the floor

    // Walk the player to the front of the chair first
    this.player.moveTo(sitFrontPos, () => {
      // Orient the player to match the chair's rotation before sitting down
      this.player.root.rotation.copy(chairRotation);
      this.player.root.rotation.x = 0;
      this.player.root.rotation.z = 0;

      // Make player sit
      this.player.sitOn(chairWorldPos, chairRotation);

      if (zoomTopDown) {
        this.zoomToDesk();
      } else {
        // Get Desk mesh world position to zoom onto it
        const deskMesh = this.room.propsRoot.getObjectByName('Desk') || this.room.root.getObjectByName('Desk');
        const deskTarget = new THREE.Vector3();
        if (deskMesh) {
          deskMesh.updateMatrixWorld(true);
          deskMesh.getWorldPosition(deskTarget);
          deskTarget.y += 0.475; // Focus on the desk top
        } else {
          deskTarget.set(1.8, 0.85, 0.0);
        }

        // Zoom camera to the desk top
        this.isoCamera.zoomTo(deskTarget, 3.5);
      }
    });
  }

  private standUp(): void {
    if (!this.player.isSitting) return;
    this.isDeskZoomed = false;
    this.player.standUp();
    this.isoCamera.resetZoom();
    this.hud.showZoomControls(false);
  }

  private zoomToDesk(): void {
    this.isDeskZoomed = true;

    // Zoom top-down on desk center
    const deskMesh = this.room.propsRoot.getObjectByName('Desk') || this.room.root.getObjectByName('Desk');
    const deskTarget = new THREE.Vector3();
    if (deskMesh) {
      deskMesh.updateMatrixWorld(true);
      deskMesh.getWorldPosition(deskTarget);
      deskTarget.y += 0.375; // Surface at Y = 0.75
    } else {
      deskTarget.set(1.8, 0.75, 0.0);
    }

    // Pitch = -Math.PI / 2 (top down), Yaw = 0 (aligned)
    this.isoCamera.zoomTo(deskTarget, 1.4, -Math.PI / 2, 0);

    // Update HUD controls
    this.hud.showZoomControls(true);
  }

  private zoomOutFromDesk(): void {
    this.isDeskZoomed = false;

    // Zoom back to seated isometric view
    const deskMesh = this.room.propsRoot.getObjectByName('Desk') || this.room.root.getObjectByName('Desk');
    const deskTarget = new THREE.Vector3();
    if (deskMesh) {
      deskMesh.updateMatrixWorld(true);
      deskMesh.getWorldPosition(deskTarget);
      deskTarget.y += 0.475;
    } else {
      deskTarget.set(1.8, 0.85, 0.0);
    }

    const currentViewYaw = this.isoCamera.getYawForViewIndex(this.isoCamera.getViewIndex());
    const ISO_PITCH = THREE.MathUtils.degToRad(-35);
    this.isoCamera.zoomTo(deskTarget, 3.5, ISO_PITCH, currentViewYaw);

    // Update HUD controls
    this.hud.showZoomControls(false);
  }

  private openPuzzle(hotspotId: string): void {
    const def = this.puzzleManager.getHotspotDef(hotspotId);
    const puzzleId = def.puzzle ?? '';
    if (!puzzleId) {
      this.narrative.onExamine(hotspotId);
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
    this.transitionToGame();
    this.saveGame();
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
    if (data.puzzleManager) {
      this.puzzleManager.loadSaveData(data.puzzleManager as any);
    }
    if (data.playerPosition) {
      const pos = data.playerPosition as { x: number; y: number; z: number };
      this.player.setPosition(pos);
    }

    // Refresh wall hotspots state visibility to match loaded state
    const roomHotspots = ['desk_drawer', 'wardrobe', 'painting', 'wall_safe', 'door', 'cipher_disk_pickup', 'stillpoint_letter'];
    for (const id of roomHotspots) {
      const def = this.puzzleManager.getHotspotDef(id);
      if (def) {
        this.room.setHotspotVisible(id, !def.disabled);
      }
    }

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
    this.wallCtrl.setInMenu(false);

    this.isoCamera.setViewIndex(0);
    this.wallCtrl.setViewIndex(0);

    const menuEl = document.getElementById('main-menu');
    if (menuEl) {
      menuEl.classList.add('fade-out');
      setTimeout(() => menuEl.classList.add('hidden'), 500);
    }

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

    overlay.innerHTML = '';
    overlay.classList.remove('hidden');
    overlay.classList.remove('fade-out');

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

      wordEl.addEventListener('click', () => this.handleIntroWordClick(wordEl));

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
    // Add clicked class to all remaining words so they fade away slowly
    const remainingWords = document.querySelectorAll('.intro-word');
    remainingWords.forEach((word) => {
      word.classList.add('clicked');
    });

    const overlay = document.getElementById('intro-words-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.innerHTML = '';
      }, 1000);
    }

    this.introActive = false;
    this.gameState.setFlag('intro_words_cleared', true);
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
    this.player.update(dt, this.room.obstacles, this.room.shellSize);

    if (wasMoving && !this.player.isMoving) {
      this.saveGame();
    }

    this.renderer.render(this.scene, this.isoCamera.camera);
  }

  private initEscapeMenu(): void {
    const resumeBtn = document.getElementById('resume-btn');
    const muteMusicCheck = document.getElementById('mute-music') as HTMLInputElement;
    const musicVolumeSlider = document.getElementById('music-volume') as HTMLInputElement;
    const devToggleBtn = document.getElementById('dev-toggle-btn');

    resumeBtn?.addEventListener('click', () => this.toggleEscapeMenu());
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
}
