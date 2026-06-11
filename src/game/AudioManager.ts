import { Howl } from 'howler';
import { publicUrl } from '../utils/publicUrl';

export class AudioManager {
  private ambient: Howl | null = null;
  private started = false;

  startOnFirstInteraction(): void {
    if (this.started) return;
    this.started = true;
    const path = publicUrl('audio/ambient_bedroom.ogg');
    this.ambient = new Howl({ src: [path], loop: true, volume: 0.35 });
    this.ambient.play();
  }

  playSfx(name: string): void {
    const path = publicUrl(`audio/${name}.ogg`);
    const sfx = new Howl({ src: [path], volume: 0.6 });
    sfx.play();
  }
}
