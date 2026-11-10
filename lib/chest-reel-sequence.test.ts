import { describe, expect, it } from 'vitest';
import {
  prepareReelMedia,
  REEL_PREPARE_CAP_MS,
  REEL_UNLOCK_LEAD_MS,
} from './chest-reel-sequence';

describe('chest-reel-sequence', () => {
  it('exports canonical timing constants', () => {
    expect(REEL_PREPARE_CAP_MS).toBe(2000);
    expect(REEL_UNLOCK_LEAD_MS).toBe(1000);
  });

  it('prepares media without throwing even with empty urls', async () => {
    await expect(prepareReelMedia([])).resolves.toBeUndefined();
  });

  it('respects prepareCapMs timeout when preloading hangs', async () => {
    const start = Date.now();
    await prepareReelMedia(['https://example.com/fake-image.png'], 50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
