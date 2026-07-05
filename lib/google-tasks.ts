import { google } from 'googleapis';

export interface RemoteTask {
  googleTaskId: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface LocalTask {
  googleTaskId: string;
  status: 'pending' | 'evaluated' | 'completed' | 'credited';
}

export function diffTasks(remote: RemoteTask[], local: LocalTask[]) {
  const localById = new Map(local.map((t) => [t.googleTaskId, t]));

  const newTasks = remote.filter((r) => !localById.has(r.googleTaskId));

  const newlyCompleted = local.filter((l) => {
    if (l.status === 'credited') return false;
    const match = remote.find((r) => r.googleTaskId === l.googleTaskId);
    return match?.completed === true;
  });

  return { newTasks, newlyCompleted };
}

export async function fetchGoogleTasks(refreshToken: string): Promise<RemoteTask[]> {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: refreshToken });

  const tasksApi = google.tasks({ version: 'v1', auth });
  const lists = await tasksApi.tasklists.list();
  const defaultListId = lists.data.items?.[0]?.id;
  if (!defaultListId) return [];

  // showHidden is required in addition to showCompleted — Google marks completed tasks
  // "hidden" almost immediately, and without this flag they vanish from the response entirely.
  const tasks = await tasksApi.tasks.list({ tasklist: defaultListId, showCompleted: true, showHidden: true });

  return (tasks.data.items ?? []).map((t) => ({
    googleTaskId: t.id!,
    title: t.title ?? '',
    description: t.notes ?? '',
    completed: t.status === 'completed',
  }));
}
