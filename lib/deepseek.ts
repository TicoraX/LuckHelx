import { clampXp } from './xp';

const SYSTEM_PROMPT = `Eres un evaluador de tareas cotidianas. Dado un titulo y descripcion de tarea,
responde SOLO con un JSON de la forma {"xp": number, "reasoning": string}.
El xp debe estar entre 5 y 100 segun la dificultad/tiempo estimado de la tarea.
Se escéptico: descripciones exageradas o vagas no deben recibir xp alto.`;

export async function evaluateTask(input: { title: string; description: string }): Promise<{ xp: number; reasoning: string }> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Titulo: ${input.title}\nDescripcion: ${input.description}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    return { xp: clampXp(NaN), reasoning: 'no se pudo evaluar: la API de DeepSeek respondio con error' };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  try {
    const parsed = JSON.parse(content);
    return { xp: clampXp(Number(parsed.xp)), reasoning: String(parsed.reasoning ?? '') };
  } catch {
    return { xp: clampXp(NaN), reasoning: 'no se pudo evaluar: respuesta invalida del modelo' };
  }
}
