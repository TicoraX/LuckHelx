/**
 * El XP se guarda como entero en centésimas, nunca como decimal.
 *
 * El motivo es la economía de las cajas: la más barata del catálogo vale US$0,39 y las
 * skins comunes valen centavos. Con el XP redondeado a entero todo eso costaba 1 XP, o
 * sea que abrir y revender salía gratis y el saldo se volvía una impresora.
 *
 * Con flotantes el problema cambia de forma pero no se va: 0,1 + 0,2 no da 0,3, y un saldo
 * que se suma y se resta miles de veces acumula el error hasta que el número que muestra
 * la pantalla no es el que tiene la base.
 *
 * Entero en centésimas resuelve las dos cosas a la vez. 1 XP = 100 unidades, y como
 * `usdToXpUnits` mapea US$1 a 1 XP, una unidad es exactamente un centavo de dólar.
 *
 * La regla: la base, las rutas y todo el cálculo hablan SIEMPRE en unidades. La conversión
 * pasa solo en tres bordes: `formatXp` para mostrar, `parseXpInput` para leer lo que
 * escribe el usuario, y `clampXpUnits` para lo que devuelve el modelo.
 */
export const XP_SCALE = 100;

/** XP entero → unidades. */
export function toXpUnits(xp: number): number {
  return Math.round(xp * XP_SCALE);
}

export const MIN_XP_UNITS = toXpUnits(5);
export const MAX_XP_UNITS = toXpUnits(100);

/**
 * El modelo devuelve XP entero de 5 a 100: su prompt habla en esa escala y pedirle
 * centésimas no tendría sentido para una tarea. La conversión pasa acá, que es el único
 * punto por donde ese número entra al sistema.
 */
export function clampXpUnits(rawXp: number): number {
  if (!Number.isFinite(rawXp)) return MIN_XP_UNITS;
  return Math.min(MAX_XP_UNITS, Math.max(MIN_XP_UNITS, toXpUnits(rawXp)));
}

/**
 * Unidades → texto. Sin decimales cuando el valor es XP entero, que es el caso de todas
 * las tareas: `1200` → `"12"`, `39` → `"0,39"`, `1693700` → `"16.937"`.
 *
 * Formateado a mano y no con `Intl`: esto se renderiza en cliente y servidor, y una
 * diferencia de locale entre los dos es un error de hidratación.
 */
export function formatXp(units: number): string {
  const rounded = Math.round(units);
  const abs = Math.abs(rounded);
  const whole = String(Math.floor(abs / XP_SCALE)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = abs % XP_SCALE;
  const body = cents === 0 ? whole : `${whole},${String(cents).padStart(2, '0')}`;
  return rounded < 0 ? `-${body}` : body;
}

/**
 * Lo que escribe el usuario → unidades. Acepta coma o punto como separador decimal, que
 * es lo que sale de un teclado en es-419. Devuelve null si no es un número usable, para
 * que quien llama decida el mensaje en vez de recibir un NaN silencioso.
 */
export function parseXpInput(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '' || !/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? toXpUnits(value) : null;
}

export function normalizeDescription(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
