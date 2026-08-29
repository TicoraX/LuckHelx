import { describe, it, expect } from 'vitest';
import { generateLedgerCsv, type CsvTransactionRow } from './csv-export';

describe('CSV Export', () => {
  it('generates a valid CSV with headers and formatted data', () => {
    const transactions: CsvTransactionRow[] = [
      {
        date: '2026-08-28T10:00:00.000Z',
        type: 'Crédito',
        concept: 'Completar reporte, con comas',
        detail: 'Evaluado por IA: "Excelente trabajo"',
        xpChange: '+50.00',
        balanceAfter: '150.00',
      },
      {
        date: '2026-08-28T11:00:00.000Z',
        type: 'Débito',
        concept: 'Cofre Prisma',
        detail: 'Objeto: AK-47 | Redline',
        xpChange: '-20.00',
        balanceAfter: '130.00',
      },
    ];

    const csv = generateLedgerCsv(transactions);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Fecha,Tipo,Concepto,Detalle,XP,Saldo');
    // Row 1 should have escaped quotes and commas
    expect(lines[1]).toContain('"Completar reporte, con comas"');
    expect(lines[1]).toContain('"Evaluado por IA: ""Excelente trabajo"""');
    expect(lines[2]).toContain('Cofre Prisma');
  });

  it('handles empty transaction list gracefully', () => {
    const csv = generateLedgerCsv([]);
    expect(csv).toBe('Fecha,Tipo,Concepto,Detalle,XP,Saldo');
  });
});
