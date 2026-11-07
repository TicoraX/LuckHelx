'use client';

import { useEffect, useState } from 'react';
import { chestDisplayName, RARITY_LABEL } from '@/components/ChestCard';
import { IconClose, IconEdit, IconSwords, IconTrash } from '@/components/Icons';
import { type ChestPriceSummary, formatPercent } from '@/lib/chest-grid';
import type { TierOdds } from '@/lib/rewards';
import { formatXp } from '@/lib/xp';
import Modal from './Modal';

interface ChestDetailModalProps {
  chest: { id: string; name: string; xp_cost: number; image?: string | null };
  odds: TierOdds[];
  openCostUnits: number;
  keyUnits: number;
  xpBalance: number;
  /** Hay una apertura, un lote o un canje en curso: ninguna acción puede despacharse. */
  busy: boolean;
  onRedeem: () => void;
  onBatch: () => void;
  onBattle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const BATCH_COUNT = 5;

export default function ChestDetailModal({
  chest,
  odds,
  openCostUnits,
  keyUnits,
  xpBalance,
  busy,
  onRedeem,
  onBatch,
  onBattle,
  onEdit,
  onDelete,
  onClose,
}: ChestDetailModalProps) {
  const [summary, setSummary] = useState<ChestPriceSummary | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Mejor premio, retorno y cobertura salen de una ruta por caja: calcularlos para las 477
  // en cada render de la grilla es justo lo que la spec descarta.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` solo existe para repetir el pedido desde Reintentar.
  useEffect(() => {
    const ctrl = new AbortController();
    setSummary(null);
    setError('');
    fetch(`/api/rewards/${encodeURIComponent(chest.id)}/summary`, { signal: ctrl.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `respuesta ${res.status}`);
        // Un 200 con un cuerpo que no parsea no puede dejar el detalle en "Calculando" para siempre.
        if (!data || typeof data.marketCount !== 'number') throw new Error('respuesta inválida');
        setSummary(data as ChestPriceSummary);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(`No se pudieron calcular los precios (${e instanceof Error ? e.message : e}).`);
      });
    return () => ctrl.abort();
  }, [chest.id, attempt]);

  const canAfford = xpBalance >= openCostUnits;

  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog chest-detail">
        <div className="chest-detail-head">
          <h2 className="chest-detail-title">{chestDisplayName(chest.name)}</h2>
          <button
            type="button"
            className="btn-action chest-detail-close"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="chest-detail-lead">
          {chest.image && <img src={chest.image} alt="" width={160} height={120} />}
          <div>
            <p className="chest-detail-label">Costo de abrir</p>
            <p className="chest-detail-cost">{formatXp(openCostUnits)} XP</p>
            {keyUnits > 0 && (
              <p className="chest-card-breakdown">
                Caja {formatXp(chest.xp_cost)} + llave {formatXp(keyUnits)}
              </p>
            )}
          </div>
        </div>

        {odds.length > 0 && (
          <div className="chest-detail-block">
            <p className="chest-detail-label">Probabilidad por tier</p>
            <span className="chest-odds">
              {odds.map(({ rarity, percent }) => (
                <span key={rarity} className="chest-odds-tier">
                  <span
                    className="chest-odds-dot"
                    style={{ background: `var(--rarity-${rarity})` }}
                    aria-hidden="true"
                  />
                  {RARITY_LABEL[rarity]} {formatPercent(percent)}
                </span>
              ))}
            </span>
          </div>
        )}

        <div className="chest-detail-block" aria-live="polite">
          {error ? (
            <div className="chest-detail-error" role="alert">
              <p>{error}</p>
              <button type="button" className="btn-action" onClick={() => setAttempt((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          ) : !summary ? (
            <p className="chest-detail-muted">Calculando precios…</p>
          ) : (
            <div className="chest-detail-facts">
              <p className="chest-detail-label">Mejor premio posible</p>
              {summary.best ? (
                <p className="chest-detail-best">
                  <span>{summary.best.name}</span>
                  <span className="chest-detail-num">{formatXp(summary.best.usdUnits)} XP</span>
                  {summary.best.isFallback && <span className="chest-detail-tag">estimado</span>}
                </p>
              ) : (
                <p className="chest-detail-muted">Esta caja no tiene skins vinculadas.</p>
              )}
              {summary.evRatio !== null && (
                <p>
                  Retorno estimado:{' '}
                  <span className="chest-detail-num">{formatPercent(summary.evRatio * 100)}</span>
                </p>
              )}
              {summary.marketCount === 0 && summary.itemCount > 0 && (
                <p>
                  <span className="chest-detail-tag">precios estimados</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="chest-detail-actions">
          <button type="button" className="btn" onClick={onRedeem} disabled={!canAfford || busy}>
            {canAfford
              ? `Abrir por ${formatXp(openCostUnits)} XP`
              : `Faltan ${formatXp(openCostUnits - xpBalance)} XP`}
          </button>
          <div className="chest-detail-secondary">
            <button
              type="button"
              className="btn-action"
              onClick={onBatch}
              disabled={xpBalance < openCostUnits * BATCH_COUNT || busy}
              title="Abrir 5 cajas en lote"
              aria-label={`Abrir ${BATCH_COUNT} cajas en lote`}
            >
              {busy ? '…' : `${BATCH_COUNT}x`}
            </button>
            <button
              type="button"
              className="btn-action"
              onClick={onBattle}
              disabled={!canAfford || busy}
              title="Duelo 1v1 contra bot (Winner takes all)"
              aria-label="Duelo uno contra uno contra un bot"
            >
              <IconSwords size={12} aria-hidden="true" /> 1v1
            </button>
            <button type="button" className="btn-action" onClick={onEdit}>
              <IconEdit size={14} aria-hidden="true" /> Editar
            </button>
            <button type="button" className="btn-action" onClick={onDelete}>
              <IconTrash size={14} aria-hidden="true" /> Borrar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
