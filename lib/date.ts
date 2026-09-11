export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
  } catch {
    return '—';
  }
}

