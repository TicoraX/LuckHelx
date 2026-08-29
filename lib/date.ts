export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
  } catch {
    return '—';
  }
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  try {
    const past = new Date(iso);
    if (Number.isNaN(past.getTime())) return '—';

    const diffMs = now.getTime() - past.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return `hace ${diffDays}d`;
  } catch {
    return '—';
  }
}
