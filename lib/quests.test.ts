import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertTask, completeTask } from './tasks-store';
import { getXpBalance } from './settings-store';
import { listQuestsWithProgress, claimQuest } from './quests';

describe('Daily Quests System', () => {
  it('generates 3 daily quests and 1 weekly quest with progress', () => {
    const db = createTestDb();
    const quests = listQuestsWithProgress(db, '2026-08-28T12:00:00.000Z');

    expect(quests.length).toBe(4);
    expect(quests.map((q) => q.type)).toEqual(['daily', 'daily', 'daily', 'weekly']);
    expect(quests.every((q) => q.progress === 0 && !q.completed && !q.claimed)).toBe(true);
  });

  it('tracks progress when tasks are completed on the same date', () => {
    const db = createTestDb();
    const today = '2026-08-28T10:00:00.000Z';

    const t1 = insertTask(db, {
      title: 'Reporte',
      description: '',
      descriptionNormalized: 'reporte',
      category: 'trabajo',
      xpValue: 3000,
      xpReasoning: 'buen trabajo',
    });
    completeTask(db, t1.id);
    db.prepare("UPDATE tasks SET completed_at = ? WHERE id = ?").run(today, t1.id);

    const quests = listQuestsWithProgress(db, today);
    const taskQuest = quests.find((q) => q.id.startsWith('daily_tasks'));
    expect(taskQuest?.progress).toBe(1);

    const xpQuest = quests.find((q) => q.id.startsWith('daily_xp'));
    expect(xpQuest?.progress).toBe(30); // 30 XP in natural units
  });

  it('claims completed quest, awards bonus XP, and prevents double claim', () => {
    const db = createTestDb();
    const today = '2026-08-28T10:00:00.000Z';

    // Complete 3 tasks to satisfy daily_tasks quest
    for (let i = 0; i < 3; i++) {
      const t = insertTask(db, {
        title: `Tarea ${i}`,
        description: '',
        descriptionNormalized: `tarea ${i}`,
        category: 'general',
        xpValue: 1000,
        xpReasoning: 'ok',
      });
      completeTask(db, t.id);
      db.prepare("UPDATE tasks SET completed_at = ? WHERE id = ?").run(today, t.id);
    }

    const quests = listQuestsWithProgress(db, today);
    const taskQuest = quests.find((q) => q.id.startsWith('daily_tasks'))!;
    expect(taskQuest.completed).toBe(true);
    expect(taskQuest.claimed).toBe(false);

    const initialXp = getXpBalance(db);
    const claimRes = claimQuest(db, taskQuest.id, today);

    expect(claimRes.xpAwarded).toBe(taskQuest.bonusXp);
    expect(getXpBalance(db)).toBe(initialXp + taskQuest.bonusXp);

    // Double claim must fail
    expect(() => claimQuest(db, taskQuest.id, today)).toThrow(/ya fue reclamada/);
  });

  it('rejects concurrent double claiming of same quest via unique index defense', () => {
    const db = createTestDb();
    const today = '2026-08-28T10:00:00.000Z';
    const dateKey = '2026-08-28';

    db.prepare(
      'INSERT INTO quest_claims (id, quest_id, claimed_date, xp_awarded, claimed_at) VALUES (?, ?, ?, ?, ?)'
    ).run('claim-1', 'daily_test_quest', dateKey, 500, today);

    expect(() => {
      db.prepare(
        'INSERT INTO quest_claims (id, quest_id, claimed_date, xp_awarded, claimed_at) VALUES (?, ?, ?, ?, ?)'
      ).run('claim-2', 'daily_test_quest', dateKey, 500, today);
    }).toThrow(/UNIQUE constraint failed/);
  });
});
