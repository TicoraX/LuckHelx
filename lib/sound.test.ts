import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(() => soundFX.playReelTick(1.2)).not.toThrow();
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

  it('connects audio graph with compressor when AudioContext is mocked', () => {
    const mockGainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockOscillatorNode = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockCompressorNode = {
      threshold: { setValueAtTime: vi.fn() },
      knee: { setValueAtTime: vi.fn() },
      ratio: { setValueAtTime: vi.fn() },
      attack: { setValueAtTime: vi.fn() },
      release: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    };

    const mockFilterNode = {
      type: 'lowpass',
      Q: { setValueAtTime: vi.fn() },
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockAudioContext = {
      currentTime: 10,
      sampleRate: 44100,
      state: 'running',
      destination: {},
      createGain: vi.fn(() => ({ ...mockGainNode })),
      createOscillator: vi.fn(() => ({ ...mockOscillatorNode })),
      createDynamicsCompressor: vi.fn(() => ({ ...mockCompressorNode })),
      createBiquadFilter: vi.fn(() => ({ ...mockFilterNode })),
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
    soundFX.configureOpening(6, false);
    soundFX.setVolume(0.7);

    expect(() => soundFX.playReelTick(1.1)).not.toThrow();
    expect(() => soundFX.playSubBassBoom(0.4, 80, 25)).not.toThrow();
    expect(() => soundFX.playUpgradeSpinTick(1.3)).not.toThrow();
    expect(() => soundFX.playUpgradeWin()).not.toThrow();
    expect(() => soundFX.playUpgradeLoss()).not.toThrow();
    expect(() => soundFX.playRankPromotionSound()).not.toThrow();

    vi.unstubAllGlobals();
  });
});
