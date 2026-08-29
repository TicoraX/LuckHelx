export interface CsvTransactionRow {
  date: string;
  type: string;
  concept: string;
  detail: string;
  xpChange: string;
  balanceAfter: string;
}

function escapeCsvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
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
