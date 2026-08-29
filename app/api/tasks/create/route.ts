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

  const { title, description, category, recurrence, dueDate } = body as {
    title: unknown;
    description: unknown;
    category?: unknown;
    recurrence?: unknown;
    dueDate?: unknown;
  };
  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'title invalido' }, { status: 400 });
  }

  const validRecurrences = ['none', 'daily', 'weekly'];
  const safeRecurrence = typeof recurrence === 'string' && validRecurrences.includes(recurrence)
    ? (recurrence as 'none' | 'daily' | 'weekly')
    : 'none';

  const safeCategory = typeof category === 'string' && category.trim().length > 0
    ? category.trim().toLowerCase()
    : 'general';

  const safeDueDate = typeof dueDate === 'string' && dueDate.trim().length > 0 ? dueDate.trim() : null;

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
      dueDate: safeDueDate,
      aiRationale: xpReasoning,
      xpValue,
      xpReasoning,
    });

    return NextResponse.json({ task: row });
  } catch {
    return NextResponse.json({ error: 'no se pudo evaluar la tarea' }, { status: 500 });
  }
}
