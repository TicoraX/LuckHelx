import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listTasks } from '@/lib/tasks-store';
import { listRedemptions, listSales } from '@/lib/rewards-store';
import { generateLedgerCsv, type CsvTransactionRow } from '@/lib/csv-export';
import { formatXp } from '@/lib/xp';

export async function GET() {
  const db = getDb();

  const credits = listTasks(db)
    .filter((t) => t.status === 'credited' && t.completed_at)
    .map((t) => ({
      kind: 'Crédito' as const,
      concept: t.title,
      detail: t.ai_rationale ?? t.xp_reasoning ?? 'Tarea completada',
      xpChange: t.xp_value ?? 0,
      at: t.completed_at as string,
    }));

  const debits = listRedemptions(db).map((r) => ({
    kind: 'Débito' as const,
    concept: r.reward_name,
    detail: r.won_item_name ? `Premio: ${r.won_item_name} (${r.won_item_rarity ?? 'común'})` : 'Canje directo',
    xpChange: -r.xp_spent,
    at: r.redeemed_at,
  }));

  const sales = listSales(db).map((s) => ({
    kind: 'Venta' as const,
    concept: `Venta de skin: ${s.item_name}`,
    detail: s.unit_usd ? `Cotización Steam: $${s.unit_usd.toFixed(2)} USD` : 'Venta de inventario',
    xpChange: s.xp_credited,
    at: s.sold_at,
  }));

  // Sort chronological ascending to calculate running balance
  const ascending = [...credits, ...debits, ...sales].sort((a, b) => (a.at > b.at ? 1 : a.at < b.at ? -1 : 0));

  let runningBalance = 0;
  const rowsWithBalance: { row: CsvTransactionRow; at: string }[] = [];

  for (const item of ascending) {
    runningBalance += item.xpChange;
    const formattedChange = item.xpChange >= 0 ? `+${formatXp(item.xpChange)}` : `-${formatXp(Math.abs(item.xpChange))}`;
    rowsWithBalance.push({
      at: item.at,
      row: {
        date: new Date(item.at).toISOString().split('T')[0],
        type: item.kind,
        concept: item.concept,
        detail: item.detail,
        xpChange: formattedChange,
        balanceAfter: formatXp(runningBalance),
      },
    });
  }

  // Display newest first in the CSV output
  rowsWithBalance.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const csvContent = generateLedgerCsv(rowsWithBalance.map((r) => r.row));

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="estado-de-cuenta.csv"',
    },
  });
}
