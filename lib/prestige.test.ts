import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertTask, completeTask } from './tasks-store';
import { getPrestigeStatus, claimPrestige } from './prestige';

describe('Prestige & Service Medals Engine', () => {
  it('calculates prestige eligibility based on completed tasks', () => {
    const db = createTestDb();

    const status1 = getPrestigeStatus(db);
    expect(status1.prestigeLevel).toBe(0);
    expect(status1.canPrestige).toBe(false);
    expect(status1.tasksNeeded).toBe(25);

    // Complete 25 tasks
    for (let i = 0; i < 25; i++) {
      const t = insertTask(db, { title: `Task ${i}`, description: '', descriptionNormalized: `task ${i}` });
      completeTask(db, t.id);
    }

    const status2 = getPrestigeStatus(db);
    expect(status2.canPrestige).toBe(true);

    const claimRes = claimPrestige(db);
    expect(claimRes.newLevel).toBe(1);
    expect(claimRes.medalName).toContain('2026');

    const status3 = getPrestigeStatus(db);
    expect(status3.prestigeLevel).toBe(1);
    expect(status3.canPrestige).toBe(false);
  });
});
