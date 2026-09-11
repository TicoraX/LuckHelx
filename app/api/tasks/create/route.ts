import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDeepseekKey } from '@/lib/settings-store';
import { insertTask } from '@/lib/tasks-store';
import { evaluateAndCacheXp } from '@/lib/sync';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'cuerpo de solicitud invalido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'cuerpo de solicitud invalido' }, { status: 400 });
  }

  const { title, description, category, recurrence, dueDate, priority, estimatedMinutes } = body as {
    title: unknown;
    description: unknown;
    category?: unknown;
    recurrence?: unknown;
    dueDate?: unknown;
    priority?: unknown;
    estimatedMinutes?: unknown;
  };
  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'title invalido' }, { status: 400 });
  }

  const validRecurrences = ['none', 'daily', 'weekly'];
  const safeRecurrence = typeof recurrence === 'string' && validRecurrences.includes(recurrence)
    ? (recurrence as 'none' | 'daily' | 'weekly')
    : 'none';

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const safePriority = typeof priority === 'string' && validPriorities.includes(priority)
    ? (priority as 'low' | 'medium' | 'high' | 'urgent')
    : 'medium';

  const safeEstimatedMinutes = typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
    ? Math.max(1, Math.round(estimatedMinutes))
    : null;

  const safeCategory = typeof category === 'string' && category.trim().length > 0
    ? category.trim().toLowerCase()
    : 'general';

  const DUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  let safeDueDate: string | null = null;
  if (typeof dueDate === 'string') {
    const trimmed = dueDate.trim();
    if (DUE_DATE_REGEX.test(trimmed)) {
      const d = new Date(trimmed);
      if (!Number.isNaN(d.getTime())) {
        safeDueDate = trimmed;
      }
    }
  }

  const db = getDb();
  const apiKey = getDeepseekKey(db);
  if (!apiKey) {
    return NextResponse.json({ error: 'configura tu clave de DeepSeek primero' }, { status: 400 });
  }

  const taskInput = { title: title.trim(), description: typeof description === 'string' ? description : '' };

  try {
    const { xpValue, xpReasoning, normalized } = await evaluateAndCacheXp(db, apiKey, taskInput);

    const row = insertTask(db, {
      title: taskInput.title,
      description: taskInput.description,
      descriptionNormalized: normalized,
      category: safeCategory,
      recurrence: safeRecurrence,
      priority: safePriority,
      estimatedMinutes: safeEstimatedMinutes,
      dueDate: safeDueDate,
      aiRationale: xpReasoning,
      xpValue,
      xpReasoning,
    });

    return NextResponse.json({ task: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'no se pudo evaluar la tarea';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
