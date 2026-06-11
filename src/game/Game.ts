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

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene.background = this.sceneBg;

    this.isoCamera = new IsoCamera(window.innerWidth / window.innerHeight);
    this.wallCtrl = new ViewWallController();
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

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
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
      this.saveLoad.delete();
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
    this.canvas.addEventListener('click', (e) => {
      this.audio.startOnFirstInteraction();
      this.input.handleClick(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      this.input.onHover = (_id, hint) => this.hud.setCursorHint(hint, e.clientX, e.clientY);
      this.input.handleMove(e.clientX, e.clientY, (id) => this.hud.getHintForHotspot(id));
    });
    this.canvas.addEventListener('wheel', (e) => {
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
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'Q') this.rotateView('left');
      else if (e.key === 'ArrowRight' || e.key === 'e' || e.key === 'E') this.rotateView('right');
    });
  }

  private rotateView(direction: 'left' | 'right'): void {
    if (this.wallCtrl.isAnimating() || this.isoCamera.isRotating()) return;
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
    if (this.inventory.selectedItem) {
      if (this.puzzleManager.tryUseItemOnHotspot(this.inventory.selectedItem, hotspotId)) return;
    }
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

  private frame(): void {
    const dt = this.clock.getDelta();
    this.isoCamera.update(dt);
    this.wallCtrl.update(dt);
    this.player.update(dt);
    this.renderer.render(this.scene, this.isoCamera.camera);
  }
}
