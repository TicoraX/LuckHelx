export interface InputRailsResult {
  allowed: boolean;
  sanitizedTitle: string;
  sanitizedDescription: string;
  violationReason?: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*:\s*you\s+are/i,
  /forget\s+(the\s+)?rules/i,
  /act\s+as\s+an?\s+unrestricted/i,
  /developer\s+mode/i,
  /maximum\s+xp/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /override\s+system/i,
];

export function validateTaskInputRails(input: {
  title: string;
  description?: string;
}): InputRailsResult {
  const rawTitle = (input.title ?? '').trim();
  const rawDesc = (input.description ?? '').trim();
  const combined = `${rawTitle} ${rawDesc}`;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        allowed: false,
        sanitizedTitle: rawTitle.slice(0, 140),
        sanitizedDescription: rawDesc.slice(0, 500),
        violationReason: 'Intento de manipulación de instrucciones (Prompt Injection / Jailbreak detectado por Guardrails).',
      };
    }
  }

  // Strip control characters and clamp lengths
  const sanitizedTitle = rawTitle.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').slice(0, 140);
  const sanitizedDescription = rawDesc.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').slice(0, 500);

  return {
    allowed: true,
    sanitizedTitle,
    sanitizedDescription,
  };
}

export function validateEvaluationOutputRails(rawXp: number): number {
  if (!Number.isFinite(rawXp) || rawXp < 1) {
    return 1;
  }
  // Hard upper limit of 200 XP per individual task to avoid hallucinated infinite economies
  return Math.min(200, Math.round(rawXp));
}
