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

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private sceneBg = new THREE.Color(0x141820);
  private isoCamera: IsoCamera;
  private wallCtrl: ViewWallController;
  private room: RoomBuilder;
  private player: PlayerMover;
  private input: InputController;

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
  private introActive = false;
  private wordsClickedCount = 0;
  private readonly INTRO_WORDS = [
    'fuzzy', 'tired', 'memory', 'gone', 'here', 'nowhere',
    'fear', 'peace', 'sleep', 'wake', 'dream', 'calm', 'alone'
  ];

  get isInputBlocked(): boolean {
    return this.inMenu || this.escapeMenuOpen || this.introActive;
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
    this.input.onFirstInput = () => {
      this.narrative.onFirstInput();
      this.audio.startOnFirstInteraction();
    };
    this.input.onMove = (point) => this.player.moveTo(point);
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
      if (this.inMenu) return;
      if (e.repeat) return;
      if (e.key === 'Escape') {
        if (this.introActive) return;
        this.toggleEscapeMenu();
        return;
      }
      if (this.isInputBlocked) return;
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'Q') this.rotateView('left');
      else if (e.key === 'ArrowRight' || e.key === 'e' || e.key === 'E') this.rotateView('right');
    });
  }

  private rotateView(direction: 'left' | 'right'): void {
    if (this.isInputBlocked) return;
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
          this.handleExamine(hotspotId);
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

    const hint = document.createElement('div');
    hint.id = 'intro-hint';
    hint.textContent = 'Focus your mind: click 5 words';
    overlay.appendChild(hint);

    this.spawnIntroWords(overlay);
  }

  private spawnIntroWords(overlay: HTMLElement): void {
    // Generate grid slots (4x4) to avoid overlapping
    const slots: { col: number; row: number }[] = [];
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
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

      const wordEl = document.createElement('div');
      wordEl.className = 'intro-word';
      wordEl.textContent = word;

      // Randomize coordinates within slot boundaries
      const minX = 5 + slot.col * 25;
      const maxX = 18 + slot.col * 25;
      const left = minX + Math.random() * (maxX - minX);

      const minY = 15 + slot.row * 18;
      const maxY = 28 + slot.row * 18;
      const top = minY + Math.random() * (maxY - minY);

      wordEl.style.left = `${left}%`;
      wordEl.style.top = `${top}%`;

      // Random size: between 1.6rem and 3.4rem
      const fontSize = 1.6 + Math.random() * 1.8;
      wordEl.style.fontSize = `${fontSize}rem`;

      // Randomize float animation properties
      const duration = 8 + Math.random() * 8; // 8s to 16s
      const delay = -Math.random() * duration; // Negative delay so they start animated
      wordEl.style.animationDuration = `${duration}s`;
      wordEl.style.animationDelay = `${delay}s`;

      wordEl.addEventListener('click', () => this.handleIntroWordClick(wordEl));

      overlay.appendChild(wordEl);
    });
  }

  private handleIntroWordClick(wordEl: HTMLElement): void {
    if (wordEl.classList.contains('clicked')) return;
    wordEl.classList.add('clicked');
    this.audio.playSfx('click');

    this.wordsClickedCount++;

    const hint = document.getElementById('intro-hint');
    if (hint) {
      const remaining = 5 - this.wordsClickedCount;
      if (remaining > 0) {
        hint.textContent = `Focus your mind: click ${remaining} more`;
      } else {
        hint.textContent = 'Your mind clears...';
      }
    }

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
    this.player.update(dt);

    if (wasMoving && !this.player.isMoving) {
      this.saveGame();
    }

    this.renderer.render(this.scene, this.isoCamera.camera);
  }

  private initEscapeMenu(): void {
    const resumeBtn = document.getElementById('resume-btn');
    const muteMusicCheck = document.getElementById('mute-music') as HTMLInputElement;
    const musicVolumeSlider = document.getElementById('music-volume') as HTMLInputElement;

    resumeBtn?.addEventListener('click', () => this.toggleEscapeMenu());

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
