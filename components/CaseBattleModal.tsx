'use client';

import { useEffect, useRef, useState } from 'react';
import Confetti from '@/components/Confetti';
import {
  IconBot,
  IconCheck,
  IconClose,
  IconCpu,
  IconCrosshair,
  IconCrown,
  IconFastForward,
  IconScale,
  IconShield,
  IconSwords,
  IconTarget,
  IconUser,
} from '@/components/Icons';
import { BOTS, type CaseBattleBot, type CaseBattleResult } from '@/lib/case-battle';
import {
  BATTLE_CELL_WIDTH,
  buildReel,
  CELL_GAP,
  COMPACT_CELL_WIDTH,
  COMPACT_VIEWPORT_PX,
  highestRarity,
  type ReelChestItem,
  type ReelResult,
  reelTickTimes,
  SPIN_EASING,
  WINNER_INDEX,
} from '@/lib/chest-reel';
import { soundFX } from '@/lib/sound';
import { formatXp } from '@/lib/xp';
import Modal from './Modal';

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

const BATTLE_SPIN_DURATION_MS = 5000;

// Mismos valores y propósito que en components/ChestReel.tsx: techo de la preparación
// (imágenes del CDN de Steam + clips) y ventaja del desbloqueo sobre el arranque del giro.
const PREPARE_CAP_MS = 2000;
const UNLOCK_LEAD_MS = 1000;
// Retardo de la fanfarria de victoria o derrota respecto del revelado (ver endBattleAudio).
const JINGLE_DELAY_MS = 500;

/** Calienta el caché del navegador para que el <img> del carrete ya esté en disco al montar. */
function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);
}

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
  const [cellWidth, setCellWidth] = useState(BATTLE_CELL_WIDTH);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelTicksRef = useRef<(() => void) | null>(null);
  const stopUnlockRef = useRef<(() => void) | null>(null);
  const reelsRef = useRef<{ player: ReelResult; bot: ReelResult } | null>(null);
  // Cierre idempotente: el temporizador de frenado, saltear y el modo sin animación
  // convergen en el mismo final y solo el primero suena y lanza el confeti.
  const endedRef = useRef(false);
  // Falso tras desmontar: un fetch o una preparación en vuelo no arranca sonidos ni giros.
  const aliveRef = useRef(true);

  // keyCost llega ya resuelto por caja (effectiveKeyCostUnits): 0 en las que no usan llave.
  const totalCost = chest.xp_cost + keyCost;
  const canAfford = userBalance >= totalCost;

  function stopAll() {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    cancelTicksRef.current?.();
    cancelTicksRef.current = null;
    stopUnlockRef.current?.();
    stopUnlockRef.current = null;
  }

  // aliveRef se reafirma en el montaje: StrictMode monta, limpia y vuelve a montar.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopAll();
    };
    // stopAll solo toca refs, no hace falta como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (!aliveRef.current) return;

      // Mismo corte que la media query de .reel-item (max-width: 480px).
      const cw = window.matchMedia(`(max-width: ${COMPACT_VIEWPORT_PX}px)`).matches
        ? COMPACT_CELL_WIDTH
        : BATTLE_CELL_WIDTH;
      const pWidth = playerViewportRef.current?.clientWidth ?? 700;
      const bWidth = botViewportRef.current?.clientWidth ?? 700;

      const pReel = buildReel(pool, result.playerItem.id, cw, pWidth);
      const bReel = buildReel(pool, result.botItem.id, cw, bWidth);
      reelsRef.current = { player: pReel, bot: bReel };
      endedRef.current = false;
      setCellWidth(cw);
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
        // Diferido un tick: en dev, StrictMode monta, limpia y vuelve a montar, y en línea
        // sonaría dos veces. El cleanup cancela el primero.
        timersRef.current.push(setTimeout(() => endBattleAudio(result), 0));
        return;
      }

      // Preparación (el botón sigue en "Preparando duelo..."): imágenes de ambas tiras y
      // clips, con techo de 2 s.
      const urls = Array.from(
        new Set(
          [...pReel.items, ...bReel.items].map((i) => i.image).filter((u): u is string => !!u)
        )
      );
      await Promise.race([
        Promise.all([preloadImages(urls), soundFX.prepareCaseClips(PREPARE_CAP_MS)]),
        new Promise((resolve) => setTimeout(resolve, PREPARE_CAP_MS)),
      ]);
      if (!aliveRef.current) return;

      let unlockPlayed = false;
      const startSpin = () => {
        if (!aliveRef.current || endedRef.current) return;
        setPhase('spinning');
        setLoading(false);

        // Doble frame: el primero pinta las tiras en su posición inicial; la transición
        // arranca en el segundo, junto con los ticks.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!aliveRef.current || endedRef.current) return;
            if (!unlockPlayed) soundFX.playCaseUnlock();
            // Una sola tanda para los dos carretes: tienen la misma celda. Si el viewport
            // del bot mide distinto, mandan los ticks del jugador.
            cancelTicksRef.current = soundFX.scheduleReelTicks(
              reelTickTimes(BATTLE_SPIN_DURATION_MS, pReel)
            );
            setPlayerOffset(pReel.targetOffset);
            setBotOffset(bReel.targetOffset);
          });
        });

        timersRef.current.push(
          setTimeout(() => {
            setPhase('finished');
            endBattleAudio(result);
          }, BATTLE_SPIN_DURATION_MS + 120)
        );
      };

      // La arena sigue quieta mientras suena el desbloqueo; el giro espera su ventaja.
      stopUnlockRef.current = soundFX.playCaseUnlockClip();
      unlockPlayed = stopUnlockRef.current !== null;
      if (unlockPlayed) timersRef.current.push(setTimeout(startSpin, UNLOCK_LEAD_MS));
      else startSpin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setLoading(false);
      setPhase('idle');
    }
  }

  function endBattleAudio(result: CaseBattleResult) {
    if (endedRef.current) return;
    endedRef.current = true;
    soundFX.playReveal(
      highestRarity([result.playerItem.rarity, result.botItem.rarity].filter((r) => r !== null))
    );
    if (result.winner === 'player') setShowConfetti(true);
    // La fanfarria entra después del golpe del revelado (sus primeros ~0,5 s): juntos se
    // tapaban, y la derrota sonaba disonante contra él. stopAll y el cleanup limpian timersRef.
    timersRef.current.push(
      setTimeout(() => {
        if (result.winner === 'player') soundFX.playBattleVictory();
        else if (result.winner === 'bot') soundFX.playBattleDefeat();
        else soundFX.playClick();
      }, JINGLE_DELAY_MS)
    );
  }

  function handleSkip() {
    setSkip(true);
    stopAll();
    const reels = reelsRef.current;
    if (battleResult && reels) {
      setPlayerOffset(reels.player.targetOffset);
      setBotOffset(reels.bot.targetOffset);
      setPhase('finished');
      endBattleAudio(battleResult);
    }
  }

  function resetForRematch() {
    setPhase('idle');
    setBattleResult(null);
    setPlayerOffset(0);
    setBotOffset(0);
    setSkip(false);
    setShowConfetti(false);
    endedRef.current = false;
    setError('');
  }

  return (
    <Modal
      onClose={onClose}
      // Escape durante el giro lo saltea; despues, cierra.
      onEscape={() => (phase === 'spinning' ? handleSkip() : onClose())}
      closeOnBackdrop={false}
      labelledBy="case-battle-modal-title"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
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
              <p className="battle-subtitle">Duelo en tiempo real contra contrincante simulado</p>
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
                  ['--reel-cell-w' as string]: `${cellWidth}px`,
                  ['--reel-cell-gap' as string]: `${CELL_GAP}px`,
                }}
              >
                {/* Needle center line with pointers */}
                <div className="reel-marker" />

                {/* Track */}
                <div
                  className="reel-track"
                  // Los premios no se leen antes de frenar.
                  aria-hidden={phase !== 'finished'}
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
                  ['--reel-cell-w' as string]: `${cellWidth}px`,
                  ['--reel-cell-gap' as string]: `${CELL_GAP}px`,
                }}
              >
                {/* Needle center line with pointers */}
                <div className="reel-marker" />

                {/* Track */}
                <div
                  className="reel-track"
                  aria-hidden={phase !== 'finished'}
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

          {/* Verdict Banner (when finished). La region live existe siempre: una que aparece ya llena no se anuncia. */}
          <div aria-live="polite">
            {phase === 'finished' && battleResult && (
              <div className={`battle-verdict-card ${battleResult.winner}`}>
                <div className="battle-verdict-head">
                  {battleResult.winner === 'player' ? (
                    <>
                      <IconCheck size={18} color="var(--accent-primary)" />
                      <h4>
                        {battleResult.isTiebreaker
                          ? 'Victoria en Muerte Súbita (Desempate 50/50)'
                          : 'Victoria: Obtienes ambas piezas'}
                      </h4>
                    </>
                  ) : battleResult.winner === 'bot' ? (
                    <>
                      <IconClose size={18} color="#ef4444" />
                      <h4>
                        {battleResult.isTiebreaker
                          ? 'Derrota en Muerte Súbita (Desempate 50/50)'
                          : 'Derrota: El contrincante se lleva ambas piezas'}
                      </h4>
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
                    ? battleResult.isTiebreaker
                      ? `¡Desempate Coinflip 50/50 a tu favor! Ambas skins tenían valor equivalente ($${battleResult.playerItem.valueUsd.toFixed(
                          2
                        )} USD), pero la tirada de muerte súbita te otorgó ambas piezas en tu inventario.`
                      : `Tu skin superó la de ${selectedBot.name} en cotización ($${battleResult.playerItem.valueUsd.toFixed(
                          2
                        )} vs $${battleResult.botItem.valueUsd.toFixed(2)} USD). Ambas piezas acreditadas en tu inventario.`
                    : battleResult.winner === 'bot'
                      ? battleResult.isTiebreaker
                        ? `Desempate Coinflip a favor de ${selectedBot.name}. Ambas piezas cotizaron en valor equivalente ($${battleResult.playerItem.valueUsd.toFixed(
                            2
                          )} USD), y el bot se llevó el pozo.`
                        : `${selectedBot.name} obtuvo una skin de mayor cotización ($${battleResult.botItem.valueUsd.toFixed(
                            2
                          )} vs $${battleResult.playerItem.valueUsd.toFixed(2)} USD). Costo debitado sin premio.`
                      : `Ambas piezas cotizaron en valor equivalente ($${battleResult.playerItem.valueUsd.toFixed(
                          2
                        )} USD). Conservas tu recompensa en el inventario.`}
                </p>
              </div>
            )}
          </div>

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
                      // Mientras se prepara el giro el servidor ya resolvió contra este bot:
                      // cambiarlo ahora haría que el veredicto nombrara a otro.
                      disabled={loading}
                      onClick={() => {
                        soundFX.playClick();
                        setSelectedBot(bot);
                      }}
                      aria-pressed={selectedBot.id === bot.id}
                      className={`bot-card${selectedBot.id === bot.id ? ' selected' : ''}`}
                    >
                      <span className="bot-card-icon">{renderBotIcon(bot.avatar, 18)}</span>
                      <div className="bot-card-info">
                        <div className="bot-card-name">{bot.name}</div>
                        <div className="bot-card-title">{bot.title}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="bot-quote">&ldquo;{selectedBot.personality}&rdquo;</div>
              </div>

              {/* Battle Price Info */}
              <div className="battle-cost-summary">
                <div>
                  <span className="battle-cost-label">
                    Costo de Inscripción ({keyCost > 0 ? 'Cofre + Llave' : 'Cofre'}):
                  </span>
                  <span className="battle-cost-val">{formatXp(totalCost)} XP</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="battle-cost-label">Tu Saldo Actual:</span>
                  <span className={`battle-cost-val ${canAfford ? 'affordable' : 'unaffordable'}`}>
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
                <button type="button" onClick={onClose} className="btn btn-secondary">
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
                  disabled={loading}
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
    </Modal>
  );
}
