import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reelTickTimes } from './chest-reel';
import { soundFX } from './sound';

describe('SoundFX Engine (GATE-4 Audio Verification)', () => {
  beforeEach(() => {
    // Reset soundFX state
    if (!soundFX.isEnabled()) {
      soundFX.toggleSound();
    }
    soundFX.setVolume(0.8);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manages volume and enabled toggle state safely', () => {
    expect(soundFX.isEnabled()).toBe(true);
    expect(soundFX.getVolume()).toBe(0.8);

    soundFX.setVolume(0.5);
    expect(soundFX.getVolume()).toBe(0.5);

    // Invalid volumes should be ignored
    soundFX.setVolume(-0.1);
    expect(soundFX.getVolume()).toBe(0.5);
    soundFX.setVolume(1.5);
    expect(soundFX.getVolume()).toBe(0.5);

    const toggled = soundFX.toggleSound();
    expect(toggled).toBe(false);
    expect(soundFX.isEnabled()).toBe(false);

    soundFX.toggleSound();
    expect(soundFX.isEnabled()).toBe(true);
  });

  it('handles server-side / headless invocation gracefully without throwing', () => {
    // Without window.AudioContext, all play methods should fail-soft
    expect(() => soundFX.scheduleReelTicks(reelTickTimes(6500))()).not.toThrow();
    expect(() => soundFX.playSale()).not.toThrow();
    expect(() => soundFX.playError()).not.toThrow();
    expect(() => soundFX.playSubBassBoom(0.5, 90, 30)).not.toThrow();
    expect(() => soundFX.playUpgradeSpinTick(1.0)).not.toThrow();
    expect(() => soundFX.playUpgradeWhoosh()).not.toThrow();
    expect(() => soundFX.playUpgradeWin()).not.toThrow();
    expect(() => soundFX.playUpgradeLoss()).not.toThrow();
    expect(() => soundFX.playRankPromotionSound()).not.toThrow();
    expect(() => soundFX.playBattleVictory()).not.toThrow();
    expect(() => soundFX.playBattleDefeat()).not.toThrow();
    expect(() => soundFX.playTaskComplete()).not.toThrow();
  });

  it('connects audio graph with compressor and reverb when AudioContext is mocked', () => {
    // Cada nodo lleva sus propios parámetros: los helpers asignan `.value` y un objeto
    // compartido entre nodos escondería un cruce de cables.
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    });
    const gainNodes: { gain: ReturnType<typeof param> }[] = [];
    const mockGainNode = () => {
      const node = { gain: param(), connect: vi.fn() };
      gainNodes.push(node);
      return node;
    };

    const mockOscillatorNode = () => ({
      type: 'sine',
      frequency: param(),
      detune: param(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });

    const mockCompressorNode = {
      threshold: { setValueAtTime: vi.fn() },
      knee: { setValueAtTime: vi.fn() },
      ratio: { setValueAtTime: vi.fn() },
      attack: { setValueAtTime: vi.fn() },
      release: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    };

    const mockFilterNode = () => ({
      type: 'lowpass',
      Q: param(),
      frequency: param(),
      connect: vi.fn(),
    });

    const mockAudioContext = {
      currentTime: 10,
      sampleRate: 44100,
      state: 'running',
      destination: {},
      createGain: vi.fn(mockGainNode),
      createOscillator: vi.fn(mockOscillatorNode),
      createDynamicsCompressor: vi.fn(() => ({ ...mockCompressorNode })),
      createBiquadFilter: vi.fn(mockFilterNode),
      createConvolver: vi.fn(() => ({ buffer: null, connect: vi.fn() })),
      createStereoPanner: vi.fn(() => ({ pan: param(), connect: vi.fn() })),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(100)),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      resume: vi.fn(),
    };

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => mockAudioContext)
    );
    vi.stubGlobal('window', {
      AudioContext: vi.fn(() => mockAudioContext),
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    });

    // Create a new instance with window & AudioContext available
    soundFX.setVolume(0.7);

    expect(() => soundFX.playClick()).not.toThrow();
    expect(() => soundFX.playCaseUnlock()).not.toThrow();
    for (const rarity of ['common', 'rare', 'epic', 'legendary'] as const) {
      expect(() => soundFX.playRarityDrop(rarity)).not.toThrow();
    }
    expect(() => soundFX.playTaskComplete()).not.toThrow();
    expect(() => soundFX.playSale()).not.toThrow();
    expect(() => soundFX.playError()).not.toThrow();
    expect(() => soundFX.playSubBassBoom(0.4, 80, 25)).not.toThrow();
    expect(() => soundFX.playUpgradeSpinTick(1.3)).not.toThrow();
    expect(() => soundFX.playUpgradeWin()).not.toThrow();
    expect(() => soundFX.playUpgradeLoss()).not.toThrow();
    expect(() => soundFX.playRankPromotionSound()).not.toThrow();

    // La reverb se arma una sola vez, por más sonidos que pasen por ella.
    expect(mockAudioContext.createConvolver).toHaveBeenCalledTimes(1);

    // Los ticks se agendan en el reloj de audio, todos a futuro, y cancelar apaga el bus
    // del giro en vez de dejar sonando los pendientes.
    const oscillatorsBefore = mockAudioContext.createOscillator.mock.results.length;
    const gainsBefore = gainNodes.length;
    const cancel = soundFX.scheduleReelTicks(reelTickTimes(6500));
    const reelOscillators = mockAudioContext.createOscillator.mock.results
      .slice(oscillatorsBefore)
      .map((r) => r.value as ReturnType<typeof mockOscillatorNode>);
    expect(reelOscillators).toHaveLength(34 * 2);
    const starts = reelOscillators.map((osc) => osc.start.mock.calls[0][0] as number);
    expect(Math.min(...starts)).toBeGreaterThan(10);
    expect(Math.max(...starts)).toBeCloseTo(16.5, 3);

    const [reelDry, reelSend] = gainNodes.slice(gainsBefore, gainsBefore + 2);
    cancel();
    expect(reelDry.gain.setTargetAtTime).toHaveBeenCalledWith(0, 10, expect.any(Number));
    expect(reelSend.gain.setTargetAtTime).toHaveBeenCalledWith(0, 10, expect.any(Number));

    vi.unstubAllGlobals();
  });
});
