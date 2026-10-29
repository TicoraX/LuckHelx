'use client';

// Sintetizador de efectos de UI sobre Web Audio. Ningún archivo de audio: todo sale de
// osciladores y ruido. Las recetas de click, tick, desbloqueo, revelado, tarea, venta y
// error vienen del lab que aprobó el dueño (2026-10-22); no se retocan sin volver a
// escucharlas ahí.

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Dónde cuelga un sonido: la salida seca y el envío a la reverb compartida. */
interface Bus {
  dry: AudioNode;
  send: AudioNode;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

// Un segundo de ruido blanco, creado una sola vez por contexto. Antes cada tick generaba
// su propio buffer, y el carrete dispara decenas por apertura.
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

// Respuesta de impulso estéreo: ruido con caída exponencial, oscurecido con un pasa-bajos
// de un polo para que la cola no sisee. Canales distintos dan ancho estéreo.
function impulse(ctx: BaseAudioContext, seconds = 1.8, decay = 3.5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const x = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
      y += 0.28 * (x - y);
      data[i] = y;
    }
  }
  return buffer;
}

// Variación aleatoria por reproducción: el mismo sonido repetido idéntico suena a máquina.
const vary = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

function out(ctx: BaseAudioContext, node: AudioNode, bus: Bus, wet: number, pan: number) {
  let n = node;
  if (pan && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    n.connect(panner);
    n = panner;
  }
  n.connect(bus.dry);
  if (wet > 0) {
    const g = ctx.createGain();
    g.gain.value = wet;
    n.connect(g);
    g.connect(bus.send);
  }
}

// Ataque y caída exponenciales; nunca rampa a 0, que exponentialRamp no admite.
function env(param: AudioParam, t: number, peak: number, a: number, d: number) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + a);
  param.exponentialRampToValueAtTime(0.0001, t + a + d);
}

interface ToneOptions {
  t: number;
  f: number;
  type?: OscillatorType;
  peak?: number;
  a?: number;
  d?: number;
  detune?: number;
  fEnd?: number;
  lp?: number;
  wet?: number;
  pan?: number;
}

function tone(ctx: BaseAudioContext, bus: Bus, o: ToneOptions) {
  const { t, f, type = 'sine', peak = 0.2, a = 0.004, d = 0.3, detune = 0, fEnd, lp } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (fEnd) osc.frequency.exponentialRampToValueAtTime(fEnd, t + a + d);
  osc.detune.value = detune;
  const g = ctx.createGain();
  env(g.gain, t, peak, a, d);
  let n: AudioNode = osc;
  if (lp) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lp;
    osc.connect(filter);
    n = filter;
  }
  n.connect(g);
  out(ctx, g, bus, o.wet ?? 0, o.pan ?? 0);
  osc.start(t);
  osc.stop(t + a + d + 0.05);
}

interface NoiseOptions {
  t: number;
  dur: number;
  type?: BiquadFilterType;
  f?: number;
  fEnd?: number;
  Q?: number;
  peak?: number;
  a?: number;
  wet?: number;
  pan?: number;
}

function noise(ctx: BaseAudioContext, bus: Bus, o: NoiseOptions) {
  const { t, dur, type = 'bandpass', f = 3000, fEnd, Q = 1, peak = 0.2, a = 0.0008 } = o;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(f, t);
  if (fEnd) filter.frequency.exponentialRampToValueAtTime(fEnd, t + a + dur);
  filter.Q.value = Q;
  const g = ctx.createGain();
  env(g.gain, t, peak, a, dur);
  src.connect(filter);
  filter.connect(g);
  out(ctx, g, bus, o.wet ?? 0, o.pan ?? 0);
  // Arranca en un punto al azar del buffer para que dos ruidos seguidos no sean idénticos.
  src.start(t, Math.random() * 0.5);
  src.stop(t + a + dur + 0.05);
}

interface BellOptions {
  t: number;
  f: number;
  peak?: number;
  d?: number;
  ratio?: number;
  index?: number;
  wet?: number;
  pan?: number;
}

// FM de dos operadores: el índice de modulación decae más rápido que la amplitud, así el
// golpe arranca brillante y se vuelve tono puro, como una campana o un vibráfono.
function bell(ctx: BaseAudioContext, bus: Bus, o: BellOptions) {
  const { t, f, peak = 0.12, d = 0.8, ratio = 3.5, index = 1.6 } = o;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  carrier.frequency.value = f;
  mod.frequency.value = f * ratio;
  modGain.gain.setValueAtTime(f * index, t);
  modGain.gain.exponentialRampToValueAtTime(f * 0.01, t + d * 0.6);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  const g = ctx.createGain();
  env(g.gain, t, peak, 0.002, d);
  carrier.connect(g);
  out(ctx, g, bus, o.wet ?? 0.2, o.pan ?? 0);
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + d + 0.05);
  mod.stop(t + d + 0.05);
}

interface PadOptions {
  t: number;
  notes: number[];
  peak?: number;
  d?: number;
  open?: number;
  wet?: number;
}

// Acorde de sierras desafinadas (±7 cents) con filtro que se abre y se cierra: la sierra
// solo suena "retro" cuando sale cruda; filtrada y en pares suena a sinte moderno.
function pad(ctx: BaseAudioContext, bus: Bus, o: PadOptions) {
  const { t, notes, peak = 0.03, d = 1.2, open = 3200, wet = 0.35 } = o;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(open, t + 0.06);
  filter.frequency.exponentialRampToValueAtTime(900, t + d);
  const g = ctx.createGain();
  env(g.gain, t, 1, 0.02, d);
  filter.connect(g);
  out(ctx, g, bus, wet, 0);
  notes.forEach((f, i) => {
    for (const cents of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = cents + (Math.random() - 0.5) * 3;
      const voice = ctx.createGain();
      voice.gain.value = peak;
      osc.connect(voice);
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = cents > 0 ? 0.3 : -0.3;
        voice.connect(panner);
        panner.connect(filter);
      } else voice.connect(filter);
      osc.start(t + i * 0.012);
      osc.stop(t + d + 0.1);
    }
  });
}

// Tres capas: chasquido (ruido agudo), cuerpo plástico (triángulo filtrado) y golpe grave.
// `pitch` baja a medida que frena el carrete: es la pista de inercia que capta el oído.
function reelTick(ctx: BaseAudioContext, bus: Bus, t: number, pitch: number) {
  const p = pitch * vary(0.03);
  noise(ctx, bus, {
    t,
    dur: 0.006,
    f: 5200 * p,
    Q: 0.9,
    peak: 0.45 * vary(0.12),
    pan: (Math.random() - 0.5) * 0.2,
  });
  tone(ctx, bus, {
    t,
    f: 2400 * p,
    fEnd: 1500 * p,
    type: 'triangle',
    lp: 6000,
    peak: 0.18,
    a: 0.0006,
    d: 0.028,
    wet: 0.06,
  });
  tone(ctx, bus, { t, f: 190 * vary(0.05), fEnd: 120, peak: 0.18, a: 0.001, d: 0.03 });
}

class SoundFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  // Entrada de la reverb compartida. Termina en el MasterGainNode, así que el volumen
  // maestro también manda sobre la cola.
  private reverbSend: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.8;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('sound_enabled');
        this.enabled = stored !== 'false';
        const storedVol = window.localStorage.getItem('sound_volume');
        if (storedVol !== null) {
          const v = Number(storedVol);
          if (Number.isFinite(v) && v >= 0 && v <= 1) this.volume = v;
        }
      } catch {}
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    if (Number.isFinite(vol) && vol >= 0 && vol <= 1) {
      this.volume = vol;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
      }
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        try {
          window.localStorage.setItem('sound_volume', String(vol));
        } catch {}
      }
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        this.ctx = ctx;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, now);

        // Limitador de seguridad, no "pegada": el compresor anterior (-18 dB, 6:1) aplastaba
        // los transitorios que hacen que un tick suene a tick.
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-10, now);
        compressor.knee.setValueAtTime(6, now);
        compressor.ratio.setValueAtTime(4, now);
        compressor.attack.setValueAtTime(0.002, now);
        compressor.release.setValueAtTime(0.15, now);
        this.masterGain.connect(compressor);
        compressor.connect(ctx.destination);

        // Reverb compartida con respuesta generada por código: se crea una sola vez y cada
        // sonido decide cuánto le manda.
        this.reverbSend = ctx.createGain();
        const convolver = ctx.createConvolver();
        convolver.buffer = impulse(ctx);
        const wet = ctx.createGain();
        wet.gain.value = 0.7;
        this.reverbSend.connect(convolver);
        convolver.connect(wet);
        wet.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /** El contexto y el bus maestro, o null si el sonido está apagado o no hay Web Audio. */
  private bus(): { ctx: AudioContext; bus: Bus } | null {
    if (!this.enabled) return null;
    this.initCtx();
    if (!this.ctx || !this.masterGain || !this.reverbSend) return null;
    return { ctx: this.ctx, bus: { dry: this.masterGain, send: this.reverbSend } };
  }

  public isEnabled() {
    return this.enabled;
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        window.localStorage.setItem('sound_enabled', String(this.enabled));
      } catch {}
    }
    return this.enabled;
  }

  /**
   * Agenda los ticks del carrete en el reloj del AudioContext, uno por instante de
   * `timesMs` (ms desde ahora; ver `reelTickTimes`). El reloj de audio no tiene el jitter
   * de los frames, así que cada tick cae donde la celda cruza el marcador.
   *
   * Devuelve la función que cancela los pendientes, para cuando se saltea la animación.
   */
  public scheduleReelTicks(timesMs: readonly number[]): () => void {
    const s = this.bus();
    if (!s) return () => undefined;
    const { ctx, bus } = s;

    // Bus propio del giro: cancelar es apagar este bus, no rastrear los cientos de nodos
    // agendados. La cola de reverb que ya sonó se apaga sola; lo pendiente no entra.
    const dry = ctx.createGain();
    const send = ctx.createGain();
    dry.connect(bus.dry);
    send.connect(bus.send);
    const reelBus = { dry, send };

    const t0 = ctx.currentTime;
    timesMs.forEach((ms, i) => {
      reelTick(ctx, reelBus, t0 + ms / 1000, 1 - 0.1 * (i / timesMs.length));
    });

    return () => {
      // Caída de 5 ms en vez de un corte seco, que en un parlante suena a chasquido.
      const now = ctx.currentTime;
      dry.gain.setTargetAtTime(0, now, 0.005);
      send.gain.setTargetAtTime(0, now, 0.005);
    };
  }

  // Confirmación de dos notas (quinta justa) con campana suave; corta y cálida.
  public playTaskComplete() {
    const s = this.bus();
    if (!s) return;
    const { ctx, bus } = s;
    const t = ctx.currentTime;
    noise(ctx, bus, { t, dur: 0.008, f: 3000, Q: 1.2, peak: 0.06 });
    bell(ctx, bus, { t, f: 659.25, ratio: 2, index: 0.6, peak: 0.14, d: 0.35, wet: 0.2 });
    bell(ctx, bus, {
      t: t + 0.085,
      f: 987.77,
      ratio: 2,
      index: 0.6,
      peak: 0.15,
      d: 0.55,
      wet: 0.25,
    });
  }

  // Dos golpes de moneda: parciales inarmónicos (1, 2.32, 4.25) en vez de una escala. Antes
  // la venta reusaba el sonido de tarea, y vender no es cumplir algo.
  public playSale() {
    const s = this.bus();
    if (!s) return;
    const { ctx, bus } = s;
    const t = ctx.currentTime;
    for (const [dt, f0] of [
      [0, 1567.98],
      [0.075, 2093],
    ]) {
      const tt = t + dt;
      noise(ctx, bus, { t: tt, dur: 0.01, f: 6000, Q: 1.5, peak: 0.07 });
      for (const [r, pk, d] of [
        [1, 0.1, 0.25],
        [2.32, 0.06, 0.18],
        [4.25, 0.035, 0.12],
      ]) {
        tone(ctx, bus, { t: tt, f: f0 * r * vary(0.004), peak: pk, a: 0.001, d, wet: 0.2 });
      }
    }
  }

  // Doble golpe grave y apagado (triángulo bajo pasa-bajos). Avisa sin castigar.
  public playError() {
    const s = this.bus();
    if (!s) return;
    const { ctx, bus } = s;
    const t = ctx.currentTime;
    noise(ctx, bus, { t, dur: 0.03, type: 'lowpass', f: 500, Q: 0.7, peak: 0.06 });
    tone(ctx, bus, { t, f: 233.08, type: 'triangle', lp: 900, peak: 0.22, a: 0.004, d: 0.12 });
    tone(ctx, bus, {
      t: t + 0.11,
      f: 220,
      type: 'triangle',
      lp: 900,
      peak: 0.22,
      a: 0.004,
      d: 0.2,
    });
  }

  // Tic seco: ruido de banda angosta de 10 ms y un cuerpo breve; sin tono reconocible.
  public playClick() {
    const s = this.bus();
    if (!s) return;
    const { ctx, bus } = s;
    const t = ctx.currentTime;
    noise(ctx, bus, { t, dur: 0.01, f: 4200 * vary(0.08), Q: 1.4, peak: 0.3 * vary(0.1) });
    tone(ctx, bus, { t, f: 1800 * vary(0.05), fEnd: 1100, peak: 0.12, a: 0.001, d: 0.03 });
  }

  // Pestillo doble metálico, golpe grave y un soplo de aire que se abre: la caja "respira".
  public playCaseUnlock() {
    const s = this.bus();
    if (!s) return;
    const { ctx, bus } = s;
    const t = ctx.currentTime;
    noise(ctx, bus, { t, dur: 0.012, f: 3200, Q: 2, peak: 0.14, wet: 0.15 });
    tone(ctx, bus, {
      t,
      f: 900,
      fEnd: 500,
      type: 'triangle',
      lp: 4000,
      peak: 0.06,
      a: 0.001,
      d: 0.05,
      wet: 0.15,
    });
    const t2 = t + 0.055;
    noise(ctx, bus, { t: t2, dur: 0.014, f: 2400, Q: 2, peak: 0.12, wet: 0.15 });
    tone(ctx, bus, {
      t: t2,
      f: 700,
      fEnd: 380,
      type: 'triangle',
      lp: 3500,
      peak: 0.05,
      a: 0.001,
      d: 0.06,
      wet: 0.15,
    });
    tone(ctx, bus, { t: t2, f: 95, fEnd: 48, peak: 0.2, a: 0.002, d: 0.22 });
    noise(ctx, bus, {
      t: t2 + 0.01,
      dur: 0.35,
      type: 'lowpass',
      f: 500,
      fEnd: 3000,
      Q: 0.7,
      peak: 0.04,
      a: 0.12,
      wet: 0.3,
    });
  }

  // Revelado por rareza: cuanto más raro, más capas y más cola de reverb.
  public playRarityDrop(rarity: Rarity) {
    const s = this.bus();
    if (!s) return;
    const { ctx, bus } = s;
    const t = ctx.currentTime;

    if (rarity === 'common') {
      noise(ctx, bus, { t, dur: 0.008, f: 2500, Q: 1.2, peak: 0.12 });
      bell(ctx, bus, { t, f: 659.25, ratio: 2, index: 0.8, peak: 0.26, d: 0.4, wet: 0.12 });
      return;
    }
    if (rarity === 'rare') {
      bell(ctx, bus, { t, f: 659.25, index: 1.5, peak: 0.16, d: 0.9, wet: 0.3, pan: -0.15 });
      bell(ctx, bus, {
        t: t + 0.07,
        f: 987.77,
        index: 1.5,
        peak: 0.15,
        d: 1.0,
        wet: 0.35,
        pan: 0.15,
      });
      tone(ctx, bus, { t, f: 329.63, peak: 0.07, a: 0.01, d: 0.5, wet: 0.2 });
      return;
    }
    if (rarity === 'epic') {
      tone(ctx, bus, { t, f: 70, fEnd: 42, peak: 0.55, a: 0.003, d: 0.45 });
      noise(ctx, bus, { t, dur: 0.12, type: 'lowpass', f: 900, Q: 0.7, peak: 0.14, wet: 0.2 });
      pad(ctx, bus, { t, notes: [440, 554.37, 659.25, 830.61], peak: 0.035, d: 1.1, wet: 0.35 });
      bell(ctx, bus, { t: t + 0.05, f: 880, index: 1.4, peak: 0.12, d: 1.2, wet: 0.4 });
      return;
    }

    // Legendario: subida, impacto, acorde brillante, arpegio de campanas y chispas.
    noise(ctx, bus, { t, dur: 0.33, f: 400, fEnd: 4000, Q: 2, peak: 0.085, a: 0.3, wet: 0.3 });
    const hit = t + 0.35;
    tone(ctx, bus, { t: hit, f: 60, fEnd: 35, peak: 0.42, a: 0.003, d: 0.7 });
    noise(ctx, bus, { t: hit, dur: 0.2, type: 'lowpass', f: 1200, Q: 0.7, peak: 0.14, wet: 0.3 });
    pad(ctx, bus, {
      t: hit,
      notes: [587.33, 739.99, 880, 1318.51],
      peak: 0.025,
      d: 1.8,
      open: 5000,
      wet: 0.5,
    });
    [1174.66, 1479.98, 1760, 2349.32].forEach((f, i) => {
      bell(ctx, bus, {
        t: hit + 0.05 + i * 0.07,
        f,
        index: 1.2,
        peak: 0.056,
        d: 1.2,
        wet: 0.5,
        pan: i % 2 ? 0.35 : -0.35,
      });
    });
    for (let i = 0; i < 14; i++) {
      noise(ctx, bus, {
        t: hit + 0.1 + Math.random() * 1.2,
        dur: 0.02,
        f: 7000 + Math.random() * 3000,
        Q: 4,
        peak: 0.035,
        wet: 0.6,
        pan: (Math.random() - 0.5) * 1.4,
      });
    }
  }

  // Play a level up fanfare
  public playLevelUp() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + idx * 0.08;
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  // Impacto visceral con sub-graves (sub-boom cinemático) mediante oscilador + filtro pasa-bajos
  public playSubBassBoom(duration = 0.5, startFreq = 85, endFreq = 28) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;

    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.frequency.exponentialRampToValueAtTime(45, now + duration);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }

  // ==========================================
  // Suite de Audio para Modo UPGRADE
  // ==========================================

  public playUpgradeSpinTick(pitchRatio: number = 1.0) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const safeRatio = Math.max(0.5, Math.min(2.0, pitchRatio));
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 * safeRatio, now);
    osc.frequency.exponentialRampToValueAtTime(350 * safeRatio, now + 0.015);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.015);
  }

  public playUpgradeWhoosh() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;

    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(1.8, now);
      filter.frequency.setValueAtTime(250, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.2);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(now);
      noise.stop(now + 0.4);
    } catch {}
  }

  public playUpgradeWin() {
    if (!this.enabled) return;
    this.playSubBassBoom(0.55, 95, 30);

    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      const startTime = now + idx * 0.08;
      const duration = 0.45;
      gain.gain.setValueAtTime(0.16, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  public playUpgradeLoss() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.28);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.28);

    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.25);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1400, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);

      noise.start(now);
      noise.stop(now + 0.25);
    } catch {}
  }

  // Play triumphant battle victory fanfare
  public playBattleVictory() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      const startTime = now + idx * 0.1;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  // Play battle defeat sound
  public playBattleDefeat() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.4);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Play CS2 Premier rank promotion or milestone fanfare
  public playRankPromotionSound() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.masterGain ?? this.ctx.destination;
    const now = this.ctx.currentTime;
    // Ascending fanfare arpeggio: C5, E5, G5, B5, C6
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      const startTime = now + idx * 0.09;
      const duration = idx === notes.length - 1 ? 0.6 : 0.35;
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }
}

export const soundFX = new SoundFX();
