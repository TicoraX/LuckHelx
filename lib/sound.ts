'use client';

// Web Audio API Synthesizer for UI sound effects (Zero external files/dependencies)

// Grabación real de una apertura de caja de CS:GO. El archivo dura 20s y no arranca en
// el momento útil: la caja se abre alrededor del segundo 5 y a partir de ahí corre el
// carrete. Se reproduce desde ese offset para que el "clac" de apertura coincida con el
// arranque del giro en pantalla.
//
// Si el audio y el carrete se separan, la perilla está en Ajustes: el offset de acá y la
// duración del giro. No hay forma de derivarlos del archivo, dependen de la grabación.
//
// El offset viaja como fragmento de medios (`#t=`), que el navegador resuelve solo.
// Asignar `currentTime` acá no sirve: hasta que no cargó la metadata, el seteo se ignora
// en silencio y el audio arranca desde cero.
//
// El valor por defecto vale hasta que la app lea el guardado en Ajustes: el carrete puede
// abrirse antes de que la config llegue, y quedarse mudo por eso seria peor que sonar
// con el default.
const OPENING_FILE_BUNDLED = '/sounds/case-open.mp3';
// El sample propio no se sirve como archivo estatico: vive junto a la base, fuera de
// `public/`, porque en el paquete de Electron `public/` es de solo lectura.
const OPENING_FILE_CUSTOM = '/api/sounds/opening';
const OPENING_START_S_DEFAULT = 5;

class SoundFX {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.8;
  private opening: HTMLAudioElement | null = null;
  private openingStartS: number = OPENING_START_S_DEFAULT;
  private openingCustom = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sound_enabled');
      this.enabled = stored !== 'false';
      const storedVol = localStorage.getItem('sound_volume');
      if (storedVol !== null) {
        const v = Number(storedVol);
        if (Number.isFinite(v) && v >= 0 && v <= 1) this.volume = v;
      }
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    if (Number.isFinite(vol) && vol >= 0 && vol <= 1) {
      this.volume = vol;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sound_volume', String(vol));
      }
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Offset y fuente del sample. Se configura desde Ajustes. */
  public configureOpening(offsetSeconds: number, custom?: boolean) {
    if (Number.isFinite(offsetSeconds) && offsetSeconds >= 0) this.openingStartS = offsetSeconds;
    if (custom !== undefined) this.openingCustom = custom;
  }

  private openingUrl(): string {
    const file = this.openingCustom ? OPENING_FILE_CUSTOM : OPENING_FILE_BUNDLED;
    return `${file}#t=${this.openingStartS}`;
  }

  public isEnabled() {
    return this.enabled;
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_enabled', String(this.enabled));
    }
    return this.enabled;
  }

  /**
   * Deja el sample cargado y listo para sonar, sin reproducirlo. Se llama durante la
   * etapa de preparación del carrete: si la descarga y el decodificado pasan recién en el
   * momento de arrancar, el audio entra tarde o a destiempo respecto de la animación.
   *
   * Resuelve igual si el archivo no está: quien decide el fallback es `start`.
   */
  public prepareOpeningSample(capMs = 2000): Promise<void> {
    if (!this.enabled || typeof window === 'undefined') return Promise.resolve();

    this.stopOpeningSample();
    const audio = new Audio(this.openingUrl());
    audio.preload = 'auto';
    this.opening = audio;
    audio.load();

    return new Promise((resolve) => {
      const done = () => resolve();
      audio.addEventListener('canplaythrough', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      // Techo: si el archivo tarda, arrancamos igual. Mejor la animación puntual con el
      // audio entrando un pelo tarde que la app esperando a un asset que quizá no está.
      setTimeout(done, capMs);
    });
  }

  /**
   * Reproduce el sample ya preparado. Rechaza si el archivo no está (borrado, o no
   * clonado en otra máquina) y ahí el carrete vuelve a los ticks sintetizados, que no
   * dependen de ningún asset.
   */
  public startOpeningSample(): Promise<void> {
    if (!this.enabled || typeof window === 'undefined') return Promise.reject(new Error('sound off'));

    const audio = this.opening ?? new Audio(this.openingUrl());
    this.opening = audio;

    return audio.play().catch((error) => {
      this.opening = null;
      throw error;
    });
  }

  public isOpeningSamplePlaying(): boolean {
    return this.opening !== null && !this.opening.paused;
  }

  public stopOpeningSample() {
    if (!this.opening) return;
    this.opening.pause();
    this.opening = null;
  }

  // Authentic CS:GO / CS2 case opening roulette tick sound (sharp metallic click + transient pop)
  public playReelTick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // High metallic click transient
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.018);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.018);

    // Subtle mechanical pop
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.008);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

      noise.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
    } catch {}
  }

  // Play a rewarding chime on completing a task
  public playTaskComplete() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.35); // C6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Play a chest open fanfare sound
  public playChestOpen() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.15); // C#5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.3); // E5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.45); // A5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.7);
  }

  // Play a soft click sound for UI buttons
  public playClick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

    gain.gain.setValueAtTime(0.08 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Play a level up fanfare
  public playLevelUp() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + idx * 0.08;
      gain.gain.setValueAtTime(0.12 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  // Play mechanical latch unlock sound
  public playCaseUnlock() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    gain.gain.setValueAtTime(0.15 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Play rarity drop sound based on skin tier
  public playRarityDrop(rarity: 'common' | 'rare' | 'epic' | 'legendary') {
    if (!this.enabled) return;
    if (rarity === 'legendary') {
      this.playLevelUp();
      return;
    }

    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs =
      rarity === 'epic'
        ? [440, 554.37, 659.25, 880]
        : rarity === 'rare'
        ? [523.25, 659.25]
        : [350, 280];

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = rarity === 'epic' ? 'triangle' : 'sine';
      osc.frequency.value = freq;

      const startTime = now + idx * 0.09;
      gain.gain.setValueAtTime(0.1 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }
}

export const soundFX = new SoundFX();
