const HOLD_SECONDS = 5;
const CENTER_RADIUS_PX = 72;
const FLEE_BASE_PX = 200;
const FLEE_DRAG_FACTOR = 0.55;
const FLEE_RELEASE_MULTIPLIER = 5;
const RELEASE_BOOST_SECONDS = 0.85;
const FALLBACK_SENTENCES = [
  'Still.',
  'Point.',
  'Remember.',
  'Forget.',
];

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class MeditationOverlay {
  private readonly root: HTMLElement;
  private readonly wordsHost: HTMLElement;
  private readonly ball: HTMLElement;
  private readonly ballProgress: HTMLElement;
  private readonly portalMessage: HTMLElement | null;
  private canOpenPortal = false;
  private onPortalUnlocked: (() => void) | null = null;
  private portalMessageShown = false;
  private visible = false;
  private holdElapsed = 0;
  private holdThresholdReached = false;
  private drag: DragState | null = null;
  private rafId = 0;
  private lastFrameMs = 0;
  private ballX = 50;
  private ballY = 50;
  private pointerX = -9999;
  private pointerY = -9999;
  private releaseBoostRemaining = 0;

  private boundPointerDown = this.handlePointerDown.bind(this);
  private boundPointerMove = this.handlePointerMove.bind(this);
  private boundPointerUp = this.handlePointerUp.bind(this);

  constructor() {
    this.root = document.getElementById('meditate-overlay')!;
    this.wordsHost = document.getElementById('meditate-words')!;
    this.ball = document.getElementById('meditate-focus-ball')!;
    this.ballProgress = document.getElementById('meditate-ball-progress')!;
    this.portalMessage = document.getElementById('meditate-portal-message');
  }

  isVisible(): boolean {
    return this.visible;
  }

  show(
    fragments: string[],
    opts?: { canOpenPortal?: boolean; onPortalUnlocked?: () => void },
  ): void {
    this.cleanupAnimation();
    this.holdElapsed = 0;
    this.holdThresholdReached = false;
    this.releaseBoostRemaining = 0;
    this.drag = null;
    this.canOpenPortal = opts?.canOpenPortal ?? false;
    this.onPortalUnlocked = opts?.onPortalUnlocked ?? null;
    this.portalMessageShown = false;
    this.portalMessage?.classList.remove('visible');
    this.wordsHost.innerHTML = '';
    this.ballProgress.style.setProperty('--hold-progress', '0');
    this.ball.classList.remove('meditate-ball-centered', 'meditate-ball-complete', 'meditate-ball-still');
    this.root.classList.remove('meditate-fading', 'meditate-words-faded', 'meditate-pulse-glow');
    document.getElementById('game-canvas')?.classList.remove('meditate-glow-pulse');

    const sentences = fragments.length > 0 ? fragments : FALLBACK_SENTENCES;
    this.spawnSentences(sentences);
    this.placeBallOffCenter();

    this.root.classList.remove('hidden');
    document.getElementById('game-canvas')?.classList.add('meditate-blur');
    this.ball.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerUp);

    this.visible = true;
    this.lastFrameMs = performance.now();
    this.rafId = window.requestAnimationFrame((t) => this.tick(t));
  }

  hide(): void {
    this.cleanupAnimation();
    this.root.classList.add('hidden');
    this.portalMessage?.classList.remove('visible');
    this.wordsHost.innerHTML = '';
    document.getElementById('game-canvas')?.classList.remove('meditate-blur', 'meditate-glow-pulse');
    this.ball.removeEventListener('pointerdown', this.boundPointerDown);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
    this.visible = false;
  }

  private cleanupAnimation(): void {
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private spawnSentences(sentences: string[]): void {
    const slots: { col: number; row: number }[] = [];
    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 7; r++) {
        slots.push({ col: c, row: r });
      }
    }
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    sentences.forEach((text, idx) => {
      if (idx >= slots.length) return;
      const slot = slots[idx];

      const containerEl = document.createElement('div');
      containerEl.className = 'meditate-word-container';

      const wordEl = document.createElement('span');
      wordEl.className = 'meditate-word';
      wordEl.textContent = text;

      const left = 3 + slot.col * 15 + Math.random() * 6;
      const top = 6 + slot.row * 12 + Math.random() * 5;
      containerEl.style.left = `${left}%`;
      containerEl.style.top = `${top}%`;

      const randVal = Math.random();
      let fontSize = 1.5;
      if (randVal < 0.35) {
        fontSize = 1.25 + Math.random() * 0.45;
      } else if (randVal < 0.7) {
        fontSize = 1.55 + Math.random() * 0.75;
      } else {
        fontSize = 2.1 + Math.random() * 1.1;
      }
      wordEl.style.fontSize = `${fontSize}rem`;

      const duration = 16 + Math.random() * 14;
      containerEl.style.setProperty('--drift-duration', `${duration}s`);
      containerEl.style.animationDuration = `${duration}s`;
      containerEl.style.animationDelay = `${-Math.random() * duration}s`;
      containerEl.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 36}vw`);
      containerEl.style.setProperty('--drift-y', `${(Math.random() - 0.5) * 28}vh`);

      containerEl.appendChild(wordEl);
      this.wordsHost.appendChild(containerEl);
    });
  }

  private placeBallOffCenter(): void {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    this.ballX = side === 'left'
      ? 8 + Math.random() * 14
      : 78 + Math.random() * 14;
    this.ballY = 34 + Math.random() * 28;
    this.applyBallPosition();
  }

  private applyBallPosition(): void {
    this.ballX = clamp(this.ballX, 4, 96);
    this.ballY = clamp(this.ballY, 8, 92);
    this.ball.style.left = `${this.ballX}%`;
    this.ball.style.top = `${this.ballY}%`;
  }

  private getBallCenterPx(): { x: number; y: number } {
    return {
      x: (this.ballX / 100) * window.innerWidth,
      y: (this.ballY / 100) * window.innerHeight,
    };
  }

  private isBallCentered(): boolean {
    const ball = this.getBallCenterPx();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return Math.hypot(ball.x - cx, ball.y - cy) <= CENTER_RADIUS_PX;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    this.ball.setPointerCapture(e.pointerId);
    this.trackPointer(e.clientX, e.clientY);

    const ball = this.getBallCenterPx();
    this.drag = {
      pointerId: e.pointerId,
      offsetX: e.clientX - ball.x,
      offsetY: e.clientY - ball.y,
    };
    this.updatePulseState();
  }

  private handlePointerMove(e: PointerEvent): void {
    this.trackPointer(e.clientX, e.clientY);

    if (!this.drag || this.drag.pointerId !== e.pointerId || this.holdThresholdReached) return;

    const x = ((e.clientX - this.drag.offsetX) / window.innerWidth) * 100;
    const y = ((e.clientY - this.drag.offsetY) / window.innerHeight) * 100;
    this.ballX = x;
    this.ballY = y;
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.drag?.pointerId === e.pointerId) {
      if (this.ball.hasPointerCapture(e.pointerId)) {
        this.ball.releasePointerCapture(e.pointerId);
      }
      this.drag = null;
      this.releaseBoostRemaining = RELEASE_BOOST_SECONDS;
      this.holdElapsed = 0;
      this.holdThresholdReached = false;
      this.ball.classList.remove('meditate-ball-still');
      this.ballProgress.style.setProperty('--hold-progress', '0');
      this.updateWordsFadedState();
      this.updatePulseState();
      this.updateCenteredState();
    }
  }

  private trackPointer(clientX: number, clientY: number): void {
    this.pointerX = clientX;
    this.pointerY = clientY;
  }

  private applyFleeForce(dt: number): void {
    if (this.holdThresholdReached && this.drag) return;

    const ball = this.getBallCenterPx();
    let dx = ball.x - this.pointerX;
    let dy = ball.y - this.pointerY;
    let dist = Math.hypot(dx, dy);

    if (dist < 8) {
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      dist = 1;
    }

    let speed = FLEE_BASE_PX;
    if (this.releaseBoostRemaining > 0) {
      speed *= FLEE_RELEASE_MULTIPLIER;
    } else if (this.drag) {
      speed *= FLEE_DRAG_FACTOR;
    }

    const proximity = clamp(1.4 - dist / 160, 0.35, 1.8);
    const movePx = speed * proximity * dt;

    this.ballX += (dx / dist) * movePx / window.innerWidth * 100;
    this.ballY += (dy / dist) * movePx / window.innerHeight * 100;
    this.applyBallPosition();
  }

  private updateCenteredState(): void {
    this.ball.classList.toggle('meditate-ball-centered', this.isBallCentered());
  }

  private updatePulseState(): void {
    const pulsing = this.drag !== null && this.isBallCentered();
    this.root.classList.toggle('meditate-pulse-glow', pulsing);
    document.getElementById('game-canvas')?.classList.toggle('meditate-glow-pulse', pulsing);
  }

  private updateWordsFadedState(): void {
    this.root.classList.toggle('meditate-words-faded', this.holdThresholdReached);
  }

  private tick(nowMs: number): void {
    if (!this.visible) return;

    const dt = Math.min(0.05, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;

    if (this.releaseBoostRemaining > 0) {
      this.releaseBoostRemaining = Math.max(0, this.releaseBoostRemaining - dt);
    }

    this.applyFleeForce(dt);
    this.updateCenteredState();
    this.updatePulseState();

    if (this.drag && this.isBallCentered()) {
      this.holdElapsed += dt;
      const progress = Math.min(1, this.holdElapsed / HOLD_SECONDS);
      this.ballProgress.style.setProperty('--hold-progress', `${progress * 100}`);

      if (progress >= 1 && !this.holdThresholdReached) {
        this.holdThresholdReached = true;
        this.ballX = 50;
        this.ballY = 50;
        this.applyBallPosition();
        this.ball.classList.add('meditate-ball-still');
        this.updateWordsFadedState();

        if (this.canOpenPortal && !this.portalMessageShown) {
          this.portalMessageShown = true;
          this.portalMessage?.classList.add('visible');
          this.onPortalUnlocked?.();
        }
      }
    } else if (this.holdElapsed > 0) {
      this.holdElapsed = Math.max(0, this.holdElapsed - dt * 3.5);
      const progress = Math.min(1, this.holdElapsed / HOLD_SECONDS);
      this.ballProgress.style.setProperty('--hold-progress', `${progress * 100}`);
    }

    this.rafId = window.requestAnimationFrame((t) => this.tick(t));
  }
}
