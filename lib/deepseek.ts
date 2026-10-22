import { validateEvaluationOutputRails, validateTaskInputRails } from './guardrails';
import { clampXpUnits } from './xp';

const SYSTEM_PROMPT = `Eres un evaluador de tareas cotidianas. Dado un titulo y descripcion de tarea,
responde SOLO con un JSON de la forma {"xp": number, "reasoning": string}.
El xp debe estar entre 5 y 100 segun la dificultad/tiempo estimado de la tarea.
Se escéptico: descripciones exageradas o vagas no deben recibir xp alto.`;
const REQUEST_TIMEOUT_MS = 10_000;

// Sin evaluacion no hay XP. Antes esto devolvia 5 XP y la tarea se creaba igual, asi que
// una caida de DeepSeek acreditaba un valor que nadie habia calculado.
export class DeepSeekError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DeepSeekError';
  }
}

export async function evaluateTask(
  input: { title: string; description: string },
  apiKey: string
): Promise<{ xp: number; reasoning: string }> {
  // 1. Guardrail Input Rails check
  const inputCheck = validateTaskInputRails(input);
  if (!inputCheck.allowed) {
    throw new Error(
      inputCheck.violationReason ?? 'Entrada neutralizada por Guardrails de seguridad.'
    );
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
          {
            role: 'user',
            content: `Titulo: ${inputCheck.sanitizedTitle}\nDescripcion: ${inputCheck.sanitizedDescription}`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DeepSeekError(`no se pudo evaluar: DeepSeek respondio ${response.status}`);
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    } catch (cause) {
      throw new DeepSeekError('no se pudo evaluar: respuesta invalida del modelo', { cause });
    }

    const content = data.choices?.[0]?.message?.content ?? '';

    let parsed: { xp?: unknown; reasoning?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch (cause) {
      throw new DeepSeekError('no se pudo evaluar: respuesta invalida del modelo', { cause });
    }
    // Un JSON valido sin `xp` numerico tampoco es una evaluacion: el rail lo subiria al minimo.
    const rawXp = parsed.xp;
    if (typeof rawXp !== 'number' || !Number.isFinite(rawXp)) {
      throw new DeepSeekError('no se pudo evaluar: el modelo no devolvio un xp numerico');
    }
    const boundedXp = validateEvaluationOutputRails(rawXp);
    return { xp: clampXpUnits(boundedXp), reasoning: String(parsed.reasoning ?? '') };
  } catch (cause) {
    if (cause instanceof DeepSeekError) throw cause;
    throw new DeepSeekError('no se pudo evaluar: DeepSeek no respondio', { cause });
  } finally {
    clearTimeout(timeoutId);
  }
}
