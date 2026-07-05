import { describe, it, expect } from 'vitest';
import { diffTasks, RemoteTask, LocalTask } from './google-tasks';

describe('diffTasks', () => {
  it('finds a remote task that has no local counterpart as new', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: false }];
    const local: LocalTask[] = [];

    const { newTasks } = diffTasks(remote, local);

    expect(newTasks).toEqual(remote);
  });

  it('finds a local task marked completed=false but remote completed=true as newly completed', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: true }];
    const local: LocalTask[] = [{ googleTaskId: 'g1', status: 'evaluated' }];

    const { newlyCompleted } = diffTasks(remote, local);

    expect(newlyCompleted).toEqual(local);
  });

  it('does not re-flag a task already credited', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: true }];
    const local: LocalTask[] = [{ googleTaskId: 'g1', status: 'credited' }];

    const { newlyCompleted } = diffTasks(remote, local);

    expect(newlyCompleted).toEqual([]);
  });

  it('does not flag a remote task already tracked locally as new', () => {
    const remote: RemoteTask[] = [{ googleTaskId: 'g1', title: 'Lavar platos', description: '', completed: false }];
    const local: LocalTask[] = [{ googleTaskId: 'g1', status: 'pending' }];

    const { newTasks } = diffTasks(remote, local);

    expect(newTasks).toEqual([]);
  });
});
