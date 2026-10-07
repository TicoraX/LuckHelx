'use client';

import { useEffect, useRef, useState } from 'react';
import Confetti from '@/components/Confetti';
import {
  BOTS,
  type CaseBattleBot,
  type CaseBattleResult,
} from '@/lib/case-battle';
import { buildReel, type ReelChestItem, WINNER_INDEX } from '@/lib/chest-reel';
import { soundFX } from '@/lib/sound';
import { formatXp } from '@/lib/xp';
import {
  IconClose,
  IconSwords,
  IconUser,
  IconBot,
  IconCrown,
  IconTarget,
  IconCrosshair,
  IconShield,
  IconCpu,
  IconFastForward,
  IconCheck,
  IconScale,
} from '@/components/Icons';

interface ChestInfo {
  id: string;
  name: string;
  xp_cost: number;
  image?: string | null;
}

interface CaseBattleModalProps {
  chest: ChestInfo;
  pool: ReelChestItem[];
  keyCost: number;
  userBalance: number;
  onClose: () => void;
  onBattleComplete?: () => void;
}

const CELL_WIDTH = 150;
const CELL_GAP = 10;
const BATTLE_SPIN_DURATION_MS = 5000;
const SPIN_EASING = 'cubic-bezier(0.12, 0.8, 0.18, 1)';

function rarityColor(rarity: string | null): string {
  if (rarity === 'legendary') return 'var(--rarity-legendary)';
  if (rarity === 'epic') return 'var(--rarity-epic)';
  if (rarity === 'rare') return 'var(--rarity-rare)';
  return 'var(--rarity-common)';
}

function renderBotIcon(avatar: string, size = 16, color = 'currentColor') {
  switch (avatar) {
    case 'crown':
      return <IconCrown size={size} color={color} />;
    case 'target':
      return <IconTarget size={size} color={color} />;
    case 'crosshair':
      return <IconCrosshair size={size} color={color} />;
    case 'cpu':
      return <IconCpu size={size} color={color} />;
    case 'shield':
      return <IconShield size={size} color={color} />;
    default:
      return <IconBot size={size} color={color} />;
  }
}

export default function CaseBattleModal({
  chest,
  pool,
  keyCost,
  userBalance,
  onClose,
  onBattleComplete,
}: CaseBattleModalProps) {
  const [selectedBot, setSelectedBot] = useState<CaseBattleBot>(BOTS[0]);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'finished'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [battleResult, setBattleResult] = useState<CaseBattleResult | null>(null);

  // Reel states
  const [playerReel, setPlayerReel] = useState<ReelChestItem[]>([]);
  const [playerOffset, setPlayerOffset] = useState(0);
  const [botReel, setBotReel] = useState<ReelChestItem[]>([]);
  const [botOffset, setBotOffset] = useState(0);

  const [skip, setSkip] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const playerViewportRef = useRef<HTMLDivElement>(null);
  const botViewportRef = useRef<HTMLDivElement>(null);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalCost = chest.xp_cost + keyCost;
  const canAfford = userBalance >= totalCost;

  // Escape to close or skip
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'spinning') {
          setSkip(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, onClose]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

  async function startBattle() {
    if (!canAfford || loading || phase === 'spinning') return;
    setError('');
    setLoading(true);
    soundFX.playClick();

    try {
      const res = await fetch('/api/case-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chestId: chest.id,
          botId: selectedBot.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al iniciar la batalla');
      }

      const result: CaseBattleResult = await res.json();
      setBattleResult(result);
      onBattleComplete?.();

      const pWidth = playerViewportRef.current?.clientWidth ?? 700;
      const bWidth = botViewportRef.current?.clientWidth ?? 700;

      const pReel = buildReel(pool, result.playerItem.id, CELL_WIDTH, pWidth);
      const bReel = buildReel(pool, result.botItem.id, CELL_WIDTH, bWidth);

      setPlayerReel(pReel.items);
      setBotReel(bReel.items);

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (skip || prefersReduced) {
        setPlayerOffset(pReel.targetOffset);
        setBotOffset(bReel.targetOffset);
        setPhase('finished');
        setLoading(false);
        triggerBattleEndAudio(result.winner);
        return;
      }

      setPhase('spinning');
      setLoading(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          soundFX.playCaseUnlock();
          setPlayerOffset(pReel.targetOffset);
          setBotOffset(bReel.targetOffset);
        });
      });

      spinTimerRef.current = setTimeout(() => {
        setPhase('finished');
        triggerBattleEndAudio(result.winner);
      }, BATTLE_SPIN_DURATION_MS + 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setLoading(false);
      setPhase('idle');
    }
  }

  function triggerBattleEndAudio(winner: 'player' | 'bot' | 'tie') {
    if (winner === 'player') {
      soundFX.playBattleVictory();
      setShowConfetti(true);
    } else if (winner === 'bot') {
      soundFX.playBattleDefeat();
    } else {
      soundFX.playClick();
    }
  }

  function handleSkip() {
    setSkip(true);
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    if (battleResult) {
      const pWidth = playerViewportRef.current?.clientWidth ?? 700;
      const bWidth = botViewportRef.current?.clientWidth ?? 700;
      const pReel = buildReel(pool, battleResult.playerItem.id, CELL_WIDTH, pWidth);
      const bReel = buildReel(pool, battleResult.botItem.id, CELL_WIDTH, bWidth);
      setPlayerOffset(pReel.targetOffset);
      setBotOffset(bReel.targetOffset);
      setPhase('finished');
      triggerBattleEndAudio(battleResult.winner);
    }
  }

  function resetForRematch() {
    setPhase('idle');
    setBattleResult(null);
    setPlayerOffset(0);
    setBotOffset(0);
    setSkip(false);
    setShowConfetti(false);
    setError('');
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-battle-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {showConfetti && <Confetti />}

      <div className="modal-dialog case-battle-dialog">
        {/* Header */}
        <div className="battle-header">
          <div className="battle-title-area">
            <span className="battle-title-icon">
              <IconSwords size={20} />
            </span>
            <div>
              <h2 id="case-battle-modal-title" className="battle-title">
                Case Battle 1v1
                <span className="battle-tag">Winner Takes All</span>
              </h2>
              <p className="battle-subtitle">
                Duelo en tiempo real contra contrincante simulado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{
              padding: '0.4rem',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Cerrar modal"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="battle-body">
          {error && <div className="battle-error-banner">{error}</div>}

          {/* Arena Visuals (Dual Vertical Stacked Reels) */}
          <div className="battle-arena">
            {/* Player Combatant Box */}
            <div
              className={`battle-combatant-card${
                phase === 'finished' && battleResult
                  ? battleResult.winner === 'player'
                    ? ' is-winner'
                    : battleResult.winner === 'bot'
                    ? ' is-loser'
                    : ''
                  : ''
              }`}
            >
              <div className="battle-combatant-header">
                <div className="battle-combatant-identity">
                  <span className="battle-combatant-badge player">
                    <IconUser size={14} />
                  </span>
                  <span className="battle-combatant-name">Tú</span>
                </div>
                {phase === 'finished' && battleResult && (
                  <span className="battle-combatant-value">
                    ${battleResult.playerItem.valueUsd.toFixed(2)} USD
                  </span>
                )}
              </div>

              {/* Player Reel Viewport */}
              <div
                className="reel-viewport battle-reel-viewport"
                ref={playerViewportRef}
                style={{
                  ['--reel-cell-w' as string]: `${CELL_WIDTH}px`,
                  ['--reel-cell-gap' as string]: `${CELL_GAP}px`,
                }}
              >
                {/* Needle center line with pointers */}
                <div className="reel-marker" />

                {/* Track */}
                <div
                  className="reel-track"
                  style={{
                    transform: `translateX(-${playerOffset}px)`,
                    transition:
                      phase === 'spinning' && !skip
                        ? `transform ${BATTLE_SPIN_DURATION_MS}ms ${SPIN_EASING}`
                        : 'none',
                  }}
                >
                  {(playerReel.length > 0 ? playerReel : pool.slice(0, 15)).map((item, idx) => {
                    const isLegendary = item.rarity === 'legendary';
                    const isWinner = phase === 'finished' && idx === WINNER_INDEX;
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        className={`reel-item battle-reel-item${isWinner ? ' is-winner' : ''}${
                          isWinner && isLegendary ? ' is-legendary-winner' : ''
                        }`}
                        style={{ ['--cell-rarity' as string]: rarityColor(item.rarity) }}
                      >
                        {isLegendary ? (
                          <span className="reel-item-star">★</span>
                        ) : item.image ? (
                          <img src={item.image} alt={item.name} className="reel-item-img" />
                        ) : (
                          <div className="reel-item-blank" />
                        )}
                        <span title={item.name} className="battle-item-name">
                          {isLegendary ? 'Objeto especial' : item.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Middle Divider */}
            <div className="battle-vs-divider">
              <div className="battle-vs-line" />
              <span className="battle-vs-badge">
                <IconSwords size={12} /> VS
              </span>
              <div className="battle-vs-line" />
            </div>

            {/* Bot Combatant Box */}
            <div
              className={`battle-combatant-card${
                phase === 'finished' && battleResult
                  ? battleResult.winner === 'bot'
                    ? ' is-winner'
                    : battleResult.winner === 'player'
                    ? ' is-loser'
                    : ''
                  : ''
              }`}
            >
              <div className="battle-combatant-header">
                <div className="battle-combatant-identity">
                  <span className="battle-combatant-badge bot">
                    {renderBotIcon(selectedBot.avatar, 14)}
                  </span>
                  <span className="battle-combatant-name">{selectedBot.name}</span>
                  <span className="battle-combatant-title">({selectedBot.title})</span>
                </div>
                {phase === 'finished' && battleResult && (
                  <span className="battle-combatant-value">
                    ${battleResult.botItem.valueUsd.toFixed(2)} USD
                  </span>
                )}
              </div>

              {/* Bot Reel Viewport */}
              <div
                className="reel-viewport battle-reel-viewport"
                ref={botViewportRef}
                style={{
                  ['--reel-cell-w' as string]: `${CELL_WIDTH}px`,
                  ['--reel-cell-gap' as string]: `${CELL_GAP}px`,
                }}
              >
                {/* Needle center line with pointers */}
                <div className="reel-marker" />

                {/* Track */}
                <div
                  className="reel-track"
                  style={{
                    transform: `translateX(-${botOffset}px)`,
                    transition:
                      phase === 'spinning' && !skip
                        ? `transform ${BATTLE_SPIN_DURATION_MS}ms ${SPIN_EASING}`
                        : 'none',
                  }}
                >
                  {(botReel.length > 0 ? botReel : pool.slice(0, 15)).map((item, idx) => {
                    const isLegendary = item.rarity === 'legendary';
                    const isWinner = phase === 'finished' && idx === WINNER_INDEX;
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        className={`reel-item battle-reel-item${isWinner ? ' is-winner' : ''}${
                          isWinner && isLegendary ? ' is-legendary-winner' : ''
                        }`}
                        style={{ ['--cell-rarity' as string]: rarityColor(item.rarity) }}
                      >
                        {isLegendary ? (
                          <span className="reel-item-star">★</span>
                        ) : item.image ? (
                          <img src={item.image} alt={item.name} className="reel-item-img" />
                        ) : (
                          <div className="reel-item-blank" />
                        )}
                        <span title={item.name} className="battle-item-name">
                          {isLegendary ? 'Objeto especial' : item.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Verdict Banner (when finished) */}
          {phase === 'finished' && battleResult && (
            <div className={`battle-verdict-card ${battleResult.winner}`}>
              <div className="battle-verdict-head">
                {battleResult.winner === 'player' ? (
                  <>
                    <IconCheck size={18} color="var(--accent-primary)" />
                    <h4>Victoria: Obtienes ambas piezas</h4>
                  </>
                ) : battleResult.winner === 'bot' ? (
                  <>
                    <IconClose size={18} color="#ef4444" />
                    <h4>Derrota: El contrincante se lleva ambas piezas</h4>
                  </>
                ) : (
                  <>
                    <IconScale size={18} color="var(--text-muted)" />
                    <h4>Empate: Cada participante conserva su drop</h4>
                  </>
                )}
              </div>
              <p className="battle-verdict-desc">
                {battleResult.winner === 'player'
                  ? `Tu skin superó la de ${selectedBot.name} en cotización ($${battleResult.playerItem.valueUsd.toFixed(
                      2
                    )} vs $${battleResult.botItem.valueUsd.toFixed(2)} USD). Ambas piezas acreditadas en tu inventario.`
                  : battleResult.winner === 'bot'
                  ? `${selectedBot.name} obtuvo una skin de mayor cotización ($${battleResult.botItem.valueUsd.toFixed(
                      2
                    )} vs $${battleResult.playerItem.valueUsd.toFixed(2)} USD). Costo debitado sin premio.`
                  : `Ambas piezas cotizaron en valor equivalente ($${battleResult.playerItem.valueUsd.toFixed(
                      2
                    )} USD). Conservas tu recompensa en el inventario.`}
              </p>
            </div>
          )}

          {/* Controls and Bot Selector (when idle) */}
          {phase === 'idle' && (
            <div>
              {/* Bot Selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div
                  role="heading"
                  aria-level={4}
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '0.4rem',
                  }}
                >
                  Elige a tu Contendiente:
                </div>
                <div className="bot-selector-grid">
                  {BOTS.map((bot) => (
                    <button
                      key={bot.id}
                      type="button"
                      onClick={() => {
                        soundFX.playClick();
                        setSelectedBot(bot);
                      }}
                      className={`bot-card${selectedBot.id === bot.id ? ' selected' : ''}`}
                    >
                      <span className="bot-card-icon">
                        {renderBotIcon(bot.avatar, 18)}
                      </span>
                      <div className="bot-card-info">
                        <div className="bot-card-name">{bot.name}</div>
                        <div className="bot-card-title">{bot.title}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="bot-quote">
                  &ldquo;{selectedBot.personality}&rdquo;
                </div>
              </div>

              {/* Battle Price Info */}
              <div className="battle-cost-summary">
                <div>
                  <span className="battle-cost-label">
                    Costo de Inscripción (Cofre + Llave):
                  </span>
                  <span className="battle-cost-val">
                    {formatXp(totalCost)} XP
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="battle-cost-label">Tu Saldo Actual:</span>
                  <span
                    className={`battle-cost-val ${
                      canAfford ? 'affordable' : 'unaffordable'
                    }`}
                  >
                    {formatXp(userBalance)} XP
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="battle-actions">
            {phase === 'spinning' && (
              <button
                type="button"
                onClick={handleSkip}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <IconFastForward size={16} /> Saltar Giro
              </button>
            )}

            {phase === 'finished' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={resetForRematch}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <IconSwords size={16} /> Revancha
                </button>
              </>
            )}

            {phase === 'idle' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={startBattle}
                  disabled={!canAfford || loading}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <IconSwords size={16} />
                  {loading
                    ? 'Preparando duelo...'
                    : canAfford
                    ? `Iniciar Duelo (${formatXp(totalCost)} XP)`
                    : 'XP Insuficiente'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
