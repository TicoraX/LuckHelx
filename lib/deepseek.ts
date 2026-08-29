import { clampXpUnits } from './xp';
import { validateTaskInputRails, validateEvaluationOutputRails } from './guardrails';

const SYSTEM_PROMPT = `Eres un evaluador de tareas cotidianas. Dado un titulo y descripcion de tarea,
responde SOLO con un JSON de la forma {"xp": number, "reasoning": string}.
El xp debe estar entre 5 y 100 segun la dificultad/tiempo estimado de la tarea.
Se escéptico: descripciones exageradas o vagas no deben recibir xp alto.`;
const REQUEST_TIMEOUT_MS = 10_000;

function fallback(reasoning: string): { xp: number; reasoning: string } {
  return { xp: clampXpUnits(NaN), reasoning };
}

export async function evaluateTask(
  input: { title: string; description: string },
  apiKey: string
): Promise<{ xp: number; reasoning: string }> {
  // 1. Guardrail Input Rails check
  const inputCheck = validateTaskInputRails(input);
  if (!inputCheck.allowed) {
    throw new Error(inputCheck.violationReason ?? 'Entrada neutralizada por Guardrails de seguridad.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Titulo: ${inputCheck.sanitizedTitle}\nDescripcion: ${inputCheck.sanitizedDescription}` },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return fallback('no se pudo evaluar: la API de DeepSeek respondio con error');
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      return fallback('no se pudo evaluar: respuesta invalida del modelo');
    }

    const content = data.choices?.[0]?.message?.content ?? '';

    try {
      const parsed = JSON.parse(content);
      const boundedXp = validateEvaluationOutputRails(Number(parsed.xp));
      return { xp: clampXpUnits(boundedXp), reasoning: String(parsed.reasoning ?? '') };
    } catch {
      return fallback('no se pudo evaluar: respuesta invalida del modelo');
    }
  } catch {
    return fallback('no se pudo evaluar: la API de DeepSeek respondio con error');
  } finally {
    clearTimeout(timeoutId);
  }
}
