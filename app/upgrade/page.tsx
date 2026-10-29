'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Confetti from '@/components/Confetti';
import Header from '@/components/Header';
import {
  IconCheck,
  IconChest,
  IconDashboard,
  IconGift,
  IconLedger,
  IconShield,
  IconUpgrade,
} from '@/components/Icons';
import MobileNav from '@/components/MobileNav';
import Modal from '@/components/Modal';
import Toast, { useToast } from '@/components/Toast';
import UpgradeWheel from '@/components/upgrade/UpgradeWheel';
import { soundFX } from '@/lib/sound';
import {
  calculateUpgradeOdds,
  type RevealedSeed,
  type SectorMode,
  type UpgradeCalculation,
  type UpgradeOutcome,
  type UpgradeResult,
  type UpgradeRow,
  type UpgradeTargetCatalogItem,
} from '@/lib/upgrade';
import { formatXp } from '@/lib/xp';

interface InventoryItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  count: number;
  priceUsd: number | null;
}

export default function UpgradePage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [targetOptions, setTargetOptions] = useState<UpgradeTargetCatalogItem[]>([]);
  const [xpBalance, setXpBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Selecciones
  const [selectedInputIds, setSelectedInputIds] = useState<string[]>([]);
  const [xpInputCents, setXpInputCents] = useState<number>(0);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [sectorMode, setSectorMode] = useState<SectorMode>('under');

  // Estado de la tirada
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [targetRollAngle, setTargetRollAngle] = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<UpgradeOutcome | null>(null);
  const [lastResult, setLastResult] = useState<UpgradeResult | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);

  // Historial y Provably Fair
  const [history, setHistory] = useState<UpgradeRow[]>([]);
  const [activeSeed, setActiveSeed] = useState<{
    serverSeedHash: string;
    clientSeed: string;
    currentNonce: number;
  } | null>(null);
  const [lastRevealed, setLastRevealed] = useState<RevealedSeed | null>(null);
  const [rotatingSeed, setRotatingSeed] = useState(false);
  const [showFairModal, setShowFairModal] = useState<boolean>(false);

  const { toasts, showToast, dismissToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [invRes, stateRes, upgRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/state'),
        fetch('/api/upgrade'),
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInventoryItems(invData.items ?? []);
      }

      if (stateRes.ok) {
        const sData = await stateRes.json();
        setXpBalance(sData.xpBalance ?? 0);
      }

      if (upgRes.ok) {
        const uData = await upgRes.json();
        setHistory(uData.history ?? []);
        setActiveSeed(uData.activeSeed ?? null);
        setLastRevealed(uData.lastRevealedSeed ?? null);

        if (Array.isArray(uData.targets) && uData.targets.length > 0) {
          setTargetOptions(uData.targets);
          if (!selectedTargetId) {
            setSelectedTargetId(uData.targets[0].id);
          }
        }
      }
    } catch {
      showToast('Error al cargar datos del Upgrader', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedTargetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cálculo del valor de entrada
  const inputValueCents = useMemo(() => {
    let total = xpInputCents;
    for (const id of selectedInputIds) {
      const item = inventoryItems.find((i) => i.id === id);
      if (item) {
        // Mismo piso que executeUpgrade (lib/upgrade.ts): 1 centavo. Con 50 la pantalla
        // mostraba probabilidades distintas de las que se tiraban.
        const itemValCents = Math.max(1, Math.round((item.priceUsd ?? 0.5) * 100));
        total += itemValCents;
      }
    }
    return total;
  }, [selectedInputIds, inventoryItems, xpInputCents]);

  // Selección del item objetivo
  const targetItem = useMemo(() => {
    return targetOptions.find((t) => t.id === selectedTargetId) ?? null;
  }, [targetOptions, selectedTargetId]);

  const targetValueCents = useMemo(() => {
    if (!targetItem) return 100;
    return targetItem.valueCents;
  }, [targetItem]);

  // Cálculo dinámico de probabilidades
  const calculation = useMemo<UpgradeCalculation>(() => {
    const safeIn = Math.max(1, inputValueCents);
    const safeTarget = Math.max(1, targetValueCents);
    try {
      return calculateUpgradeOdds(safeIn, safeTarget, 0.05, sectorMode);
    } catch {
      return {
        inputValueCents: safeIn,
        targetValueCents: safeTarget,
        edgeRate: 0.05,
        rawProbability: 0.1,
        probability: 0.1,
        winPercentage: 10,
        sectorMode,
        sectorStartAngle: 0,
        sectorEndAngle: 36,
        sectorSpanAngle: 36,
        multiplier: 10,
      };
    }
  }, [inputValueCents, targetValueCents, sectorMode]);

  const toggleInputItem = (id: string) => {
    if (isSpinning) return;
    soundFX.playClick();
    setSelectedInputIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Revelar la semilla activa la cierra: la siguiente tirada ya firma con otra, cuyo hash
  // es el que queda a la vista.
  const rotateSeed = async () => {
    setRotatingSeed(true);
    try {
      const res = await fetch('/api/upgrade/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al rotar la semilla');
      setLastRevealed(data.revealed);
      setActiveSeed({
        serverSeedHash: data.nextSeedHash,
        clientSeed: data.revealed.clientSeed,
        currentNonce: 0,
      });
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setRotatingSeed(false);
    }
  };

  const handleExecuteUpgrade = async () => {
    if (isSpinning) return;
    if (inputValueCents <= 0) {
      showToast('Selecciona al menos una skin o aporta XP', 'error');
      return;
    }
    if (!selectedTargetId) {
      showToast('Selecciona una skin objetivo', 'error');
      return;
    }
    if (inputValueCents >= targetValueCents) {
      showToast('Tu entrada debe ser menor que la skin objetivo para hacer un Upgrade', 'error');
      return;
    }

    soundFX.playClick();
    setIsSpinning(true);
    setLastOutcome(null);
    setTargetRollAngle(null);

    try {
      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputItemIds: selectedInputIds,
          xpSpentCents: xpInputCents > 0 ? xpInputCents : undefined,
          targetItemId: selectedTargetId,
          sectorMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setIsSpinning(false);
        showToast(data.error || 'Error al ejecutar Upgrade', 'error');
        return;
      }

      setLastResult(data as UpgradeResult);
      setLastOutcome(data.outcome);
      setTargetRollAngle(data.provablyFair.rollAngle);
    } catch {
      setIsSpinning(false);
      showToast('Fallo de conexión al servidor', 'error');
    }
  };

  const onSpinEnd = () => {
    setIsSpinning(false);
    if (lastOutcome === 'won') {
      setShowConfetti(true);
      setShowVictoryModal(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      showToast('Upgrade fallido. La skin de entrada ha sido quemada.', 'info');
    }
    // Deseleccionar y recargar datos frescos
    setSelectedInputIds([]);
    setXpInputCents(0);
    loadData();
  };

  return (
    <div className="fade-in">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <Confetti active={showConfetti} />

      <main className="container">
        <Header xpBalance={xpBalance}>
          <a href="/" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconDashboard size={16} /> Dashboard
          </a>
          <a href="/rewards" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconGift size={16} /> Recompensas
          </a>
          <a href="/inventory" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconChest size={16} /> Inventario
          </a>
          <button className="nav-link active" aria-label="Upgrade">
            <IconUpgrade size={16} /> Upgrade
          </button>
          <a href="/ledger" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconLedger size={16} /> Estado de cuenta
          </a>
        </Header>

        {/* Encabezado */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.2rem' }}>CS2 Upgrader</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
              Mejora tus skins por otras más valiosas con cuotas transparentes.
            </p>
          </div>
          <div>
            <button
              className="btn-action"
              onClick={() => {
                soundFX.playClick();
                setShowFairModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <IconShield size={14} />
              <span>Verificación</span>
            </button>
          </div>
        </div>

        {/* Tablero de la Ruleta y Estadísticas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            alignItems: 'center',
            marginBottom: '2rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          {/* Ruleta Circular con Flecha Giratoria */}
          <div style={{ textAlign: 'center' }}>
            <UpgradeWheel
              calculation={calculation}
              isSpinning={isSpinning}
              targetRollAngle={targetRollAngle}
              outcome={lastOutcome}
              onSpinEnd={onSpinEnd}
            />

            {/* Selector de Dirección (Simple y sin tecnicismos) */}
            <div
              style={{
                display: 'inline-flex',
                gap: '0.4rem',
                marginTop: '1.2rem',
                background: 'var(--bg)',
                padding: '0.25rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <button
                className={`btn-action ${sectorMode === 'under' ? 'active' : ''}`}
                disabled={isSpinning}
                onClick={() => {
                  soundFX.playClick();
                  setSectorMode('under');
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.85rem',
                  fontWeight: 600,
                  background: sectorMode === 'under' ? 'var(--accent-primary)' : 'transparent',
                  color: sectorMode === 'under' ? 'var(--on-accent)' : 'var(--text-muted)',
                }}
              >
                Girar Derecha
              </button>
              <button
                className={`btn-action ${sectorMode === 'over' ? 'active' : ''}`}
                disabled={isSpinning}
                onClick={() => {
                  soundFX.playClick();
                  setSectorMode('over');
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.85rem',
                  fontWeight: 600,
                  background: sectorMode === 'over' ? 'var(--accent-primary)' : 'transparent',
                  color: sectorMode === 'over' ? 'var(--on-accent)' : 'var(--text-muted)',
                }}
              >
                Girar Izquierda
              </button>
            </div>
          </div>

          {/* Panel de Control y Resumen de Valores */}
          <div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                marginBottom: '1.2rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.9rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tu Entrada</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  ${(inputValueCents / 100).toFixed(2)} USD
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.9rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Skin Objetivo
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-xp)',
                  }}
                >
                  ${(targetValueCents / 100).toFixed(2)} USD
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.9rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Probabilidad de Éxito
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {calculation.winPercentage.toFixed(2)}% ({calculation.multiplier}x)
                </span>
              </div>
            </div>

            {/* Botón Principal */}
            <button
              className="btn"
              disabled={isSpinning || inputValueCents <= 0 || inputValueCents >= targetValueCents}
              onClick={handleExecuteUpgrade}
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1.05rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: isSpinning
                  ? 'none'
                  : '0 4px 14px color-mix(in srgb, var(--accent-primary) 35%, transparent)',
              }}
            >
              <IconUpgrade size={20} />
              <span>{isSpinning ? 'Girando la flecha...' : 'Hacer Upgrade'}</span>
            </button>
          </div>
        </div>

        {/* Sección de Selección: Inventario vs Objetivos */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          {/* Tu Inventario */}
          <div>
            <h2
              style={{
                fontSize: '1.15rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <IconChest size={17} /> Tu Inventario
            </h2>
            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '0.65rem',
                padding: '0.6rem',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              {inventoryItems.length === 0 ? (
                <div
                  style={{
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    gridColumn: '1 / -1',
                    fontSize: '0.85rem',
                  }}
                >
                  No tienes skins disponibles en tu inventario. Canjea cajas para conseguir skins.
                </div>
              ) : (
                inventoryItems.map((item) => {
                  const isSelected = selectedInputIds.includes(item.id);
                  const valCents = Math.round((item.priceUsd ?? 0.5) * 100);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleInputItem(item.id)}
                      style={{
                        padding: '0.6rem 0.5rem',
                        borderRadius: '6px',
                        background: isSelected
                          ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)'
                          : 'var(--bg)',
                        border: isSelected
                          ? '2px solid var(--accent-primary)'
                          : '1px solid var(--border)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        position: 'relative',
                      }}
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{
                            width: '60px',
                            height: '45px',
                            objectFit: 'contain',
                            margin: '0 auto 0.35rem',
                          }}
                        />
                      )}
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--accent-primary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        ${(valCents / 100).toFixed(2)} USD
                      </div>
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'var(--accent-primary)',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconCheck size={11} color="var(--on-accent)" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Catálogo de Skins Objetivo */}
          <div>
            <h2
              style={{
                fontSize: '1.15rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <IconGift size={17} /> Elige qué skin quieres conseguir
            </h2>
            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '0.65rem',
                padding: '0.6rem',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              {targetOptions.map((target) => {
                const isSelected = selectedTargetId === target.id;
                return (
                  <div
                    key={target.id}
                    onClick={() => {
                      if (isSpinning) return;
                      soundFX.playClick();
                      setSelectedTargetId(target.id);
                    }}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '6px',
                      background: isSelected
                        ? 'color-mix(in srgb, var(--rarity-rare) 18%, transparent)'
                        : 'var(--bg)',
                      border: isSelected
                        ? '2px solid var(--rarity-rare)'
                        : '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    {target.image && (
                      <img
                        src={target.image}
                        alt={target.name}
                        style={{
                          width: '60px',
                          height: '45px',
                          objectFit: 'contain',
                          margin: '0 auto 0.35rem',
                        }}
                      />
                    )}
                    <div
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {target.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--accent-xp)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      ${target.priceUsd.toFixed(2)} USD
                    </div>
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'var(--rarity-rare)',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconCheck size={11} color="var(--on-accent)" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal de Victoria al Ganar Skin */}
        {showVictoryModal && lastResult && lastOutcome === 'won' && (
          <Modal
            onClose={() => setShowVictoryModal(false)}
            closeOnBackdrop={false}
            style={{ background: 'rgba(0,0,0,0.82)', padding: '1rem' }}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                border: '2px solid var(--accent-primary)',
                borderRadius: '10px',
                padding: '2rem 1.5rem',
                maxWidth: '420px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 0 35px color-mix(in srgb, var(--accent-primary) 40%, transparent)',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '0.5rem',
                }}
              >
                ¡Upgrade Exitoso!
              </div>

              <h2 style={{ fontSize: '1.4rem', margin: '0 0 1rem' }}>
                {lastResult.targetItem.name}
              </h2>

              {lastResult.targetItem.image && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    marginBottom: '1rem',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={lastResult.targetItem.image}
                    alt={lastResult.targetItem.name}
                    style={{
                      width: '150px',
                      height: '100px',
                      objectFit: 'contain',
                      margin: '0 auto',
                      filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.7))',
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  fontSize: '1.1rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-xp)',
                  fontWeight: 800,
                  marginBottom: '1.2rem',
                }}
              >
                ${(lastResult.targetItem.valueCents / 100).toFixed(2)} USD (
                {formatXp(lastResult.targetItem.valueCents)} XP)
              </div>

              <p
                style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}
              >
                ¡Felicidades! Esta skin ya se encuentra agregada a tu inventario.
              </p>

              <button
                className="btn"
                onClick={() => setShowVictoryModal(false)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                }}
              >
                Continuar
              </button>
            </div>
          </Modal>
        )}

        {/* Modal de Provably Fair */}
        {showFairModal && (
          <Modal
            onClose={() => setShowFairModal(false)}
            style={{ background: 'rgba(0,0,0,0.75)', padding: '1rem' }}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '500px',
                width: '100%',
              }}
            >
              <h3
                style={{
                  fontSize: '1.2rem',
                  marginBottom: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <IconShield size={18} /> Verificación de Juego Justo
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                El resultado de cada tirada está sellado con una semilla criptográfica antes de
                girar.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Semilla del Servidor (Hash SHA-256):
                  </span>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      wordBreak: 'break-all',
                      background: 'var(--bg)',
                      padding: '0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    {activeSeed?.serverSeedHash || 'Cargando...'}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Semilla del Cliente:</span>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--bg)',
                      padding: '0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    {activeSeed?.clientSeed || 'luckhelx_client'}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Número de Tirada (Nonce):</span>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--bg)',
                      padding: '0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    {activeSeed?.currentNonce ?? 0}
                  </div>
                </div>
              </div>

              {lastRevealed && (
                <div style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Última semilla revelada (firmó {lastRevealed.finalNonce} tiradas):
                  </span>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      wordBreak: 'break-all',
                      background: 'var(--bg)',
                      padding: '0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    {lastRevealed.serverSeed}
                  </div>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Su SHA-256 es {lastRevealed.serverSeedHash.slice(0, 16)}…, el hash que se
                    publicó antes de esas tiradas.
                  </p>
                </div>
              )}

              <div
                style={{
                  marginTop: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn-action"
                  onClick={rotateSeed}
                  disabled={rotatingSeed || isSpinning}
                  style={{ padding: '0.4rem 1rem' }}
                >
                  {rotatingSeed ? 'Revelando…' : 'Revelar y cambiar semilla'}
                </button>
                <button
                  className="btn-action"
                  onClick={() => setShowFairModal(false)}
                  style={{ padding: '0.4rem 1rem' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Historial Reciente de Upgrades (Limpio y sin tecnicismos) */}
        <div style={{ marginTop: '2rem', marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: '1.15rem',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <IconUpgrade size={17} /> Últimas Tiradas
          </h2>
          {loading ? (
            <div
              style={{
                padding: '1rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                fontSize: '0.85rem',
              }}
            >
              Cargando historial...
            </div>
          ) : history.length === 0 ? (
            <div
              style={{
                padding: '1.2rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
              }}
            >
              No hay tiradas de upgrade registradas aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.slice(0, 8).map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.95rem',
                    background: 'var(--bg-card)',
                    border: `1px solid ${row.outcome === 'won' ? 'color-mix(in srgb, var(--accent-primary) 40%, transparent)' : 'var(--border)'}`,
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          row.outcome === 'won'
                            ? 'color-mix(in srgb, var(--accent-primary) 20%, transparent)'
                            : 'color-mix(in srgb, var(--error) 15%, transparent)',
                        color: row.outcome === 'won' ? 'var(--accent-primary)' : 'var(--error)',
                      }}
                    >
                      {row.outcome === 'won' ? 'Éxito' : 'Fallo'}
                    </span>
                    <span style={{ fontWeight: 600 }}>{row.target_item_name}</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span>
                      Probabilidad:{' '}
                      {row.win_probability ? (row.win_probability * 100).toFixed(1) : '0'}%
                    </span>
                    <span
                      style={{
                        color:
                          row.outcome === 'won' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      }}
                    >
                      ${(row.target_value_cents / 100).toFixed(2)} USD
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <MobileNav activeTab="upgrade" />
      </main>
    </div>
  );
}
