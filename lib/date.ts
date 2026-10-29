export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
  } catch {
    return '—';
  }
}

// El dia es el del reloj de la PC donde corre la app, no el de UTC. Con UTC, en Colombia el
// dia cambiaba a las 19:00: de noche se podia volver a girar, las misiones de "hoy" eran las
// de manana y una tarea de las 20:00 contaba para la racha del dia siguiente.
//
// El indice son los componentes locales puestos en UTC: restar dos da multiplos exactos de un
// dia aunque el huso tenga horario de verano, y `getUTC*` sobre el lee el dia local.
export function localDayIndex(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function localDayKey(date: Date): string {
  return new Date(localDayIndex(date)).toISOString().slice(0, 10);
}
