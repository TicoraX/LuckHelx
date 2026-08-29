export interface CsvTransactionRow {
  date: string;
  type: string;
  concept: string;
  detail: string;
  xpChange: string;
  balanceAfter: string;
}

function escapeCsvField(val: string): string {
  let safeVal = val;
  const trimmed = val.trimStart();
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@')
  ) {
    safeVal = `'${val}`;
  }

  if (safeVal.includes(',') || safeVal.includes('"') || safeVal.includes('\n') || safeVal.includes('\r')) {
    return `"${safeVal.replace(/"/g, '""')}"`;
  }
  return safeVal;
}

export function generateLedgerCsv(rows: CsvTransactionRow[]): string {
  const header = ['Fecha', 'Tipo', 'Concepto', 'Detalle', 'XP', 'Saldo'];
  const lines = [header.join(',')];

  for (const r of rows) {
    const line = [
      escapeCsvField(r.date),
      escapeCsvField(r.type),
      escapeCsvField(r.concept),
      escapeCsvField(r.detail),
      escapeCsvField(r.xpChange),
      escapeCsvField(r.balanceAfter),
    ].join(',');
    lines.push(line);
  }

  return lines.join('\n');
}
