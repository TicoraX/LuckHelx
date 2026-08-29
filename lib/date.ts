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
    const target = new Date(iso);
    if (Number.isNaN(target.getTime())) return '—';

    const diffMs = now.getTime() - target.getTime();

    // Future dates
    if (diffMs < 0) {
      const absDiffSecs = Math.floor(Math.abs(diffMs) / 1000);
      const absDiffMins = Math.floor(absDiffSecs / 60);
      const absDiffHours = Math.floor(absDiffMins / 60);
      const absDiffDays = Math.floor(absDiffHours / 24);

      if (absDiffSecs < 60) return 'en breve';
      if (absDiffMins < 60) return `en ${absDiffMins}m`;
      if (absDiffHours < 24) return `en ${absDiffHours}h`;
      return `en ${absDiffDays}d`;
    }

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
