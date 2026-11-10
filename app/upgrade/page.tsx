'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Confetti from '@/components/Confetti';
import Header from '@/components/Header';
import {
  IconCheck,
  IconChest,
  IconDashboard,
  IconGift,
  IconLedger,
  IconLightning,
  IconShield,
  IconUpgrade,
} from '@/components/Icons';
import MobileNav from '@/components/MobileNav';
import Modal from '@/components/Modal';
import SkinGradeBadge from '@/components/SkinGradeBadge';
import Toast, { useToast } from '@/components/Toast';
import UpgradeWheel from '@/components/upgrade/UpgradeWheel';
import { getCs2Grade } from '@/lib/cs2-grade';
import { soundFX } from '@/lib/sound';
import type { RevealedSeed, UpgradeResult, UpgradeRow } from '@/lib/upgrade';
import {
  calculateUpgradeOdds,
  formatMultiplier,
  formatPercent,
  formatUsdCents,
  type SectorMode,
  UPGRADE_DEFAULT_EDGE,
  UPGRADE_MAX_LIST_MULT,
  UPGRADE_MAX_PROBABILITY,
  UPGRADE_MIN_MULT,
  UPGRADE_MIN_PROBABILITY,
  UPGRADE_MULTIPLIERS,
  type UpgradeCalculation,
  type UpgradeOutcome,
  type UpgradeTargetCatalogItem,
  valueCentsOf,
} from '@/lib/upgrade-math';
import { formatXp } from '@/lib/xp';

interface InventoryItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  count: number;
  priceUsd: number | null;
  priceIsFallback: boolean;
}

interface TargetList {
  items: UpgradeTargetCatalogItem[];
  total: number;
  maxValueCents: number;
  byMultiplier: Record<string, UpgradeTargetCatalogItem | null>;
}

interface Pick {
  item: UpgradeTargetCatalogItem | null;
  /** Multiplicador con el que se eligio; null si se eligio a mano o al azar. */
  mult: number | null;
}

const MULTIPLIERS = UPGRADE_MULTIPLIERS;
const MOBILE_COLLAPSED = 8;
const DEFAULT_MULT = 2;
const SEARCH_DEBOUNCE_MS = 250;
const NOTICE_UNAVAILABLE =
  'El objetivo ya no está disponible para esta entrada. Elige otro, usa un multiplicador o "Al azar".';
const LOADING_REASON = 'Actualizando objetivos…';
const EMPTY_TARGETS: TargetList = { items: [], total: 0, maxValueCents: 0, byMultiplier: {} };

// Misma regla que executeUpgrade: precio de la API de inventario (real o por rareza) con piso de 1.
const inventoryValueCents = (item: InventoryItem) =>
  valueCentsOf(item.priceUsd, item.name, item.rarity);

const inRange = (valueCents: number, entryCents: number) =>
  valueCents > entryCents * UPGRADE_MIN_MULT && valueCents <= entryCents * UPGRADE_MAX_LIST_MULT;

export default function UpgradePage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [xpBalance, setXpBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Selecciones
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [xpInputCents, setXpInputCents] = useState<number>(0);
  const [sectorMode, setSectorMode] = useState<SectorMode>('under');

  // Objetivos: lista del servidor para la entrada y la busqueda actuales
  const [targets, setTargets] = useState<TargetList>(EMPTY_TARGETS);
  const [loadedKey, setLoadedKey] = useState<string>('0|');
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick>({ item: null, mult: DEFAULT_MULT });
  const pickRef = useRef(pick);
  const targetGridRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [invExpanded, setInvExpanded] = useState(false);
  const [targetsExpanded, setTargetsExpanded] = useState(false);

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

  // En <= 640 px las listas arrancan con 8 tarjetas para no obligar a recorrer 50 antes de llegar al otro panel.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const choose = useCallback((next: Pick) => {
    pickRef.current = next;
    setPick(next);
  }, []);

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
      }
    } catch {
      showToast('Error al cargar datos del Upgrader', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Valor de la entrada: misma funcion de valoracion que el servidor
  const inputValueCents = useMemo(() => {
    let total = xpInputCents;
    for (const item of inventoryItems) {
      total += inventoryValueCents(item) * (selectedQty[item.id] ?? 0);
    }
    return total;
  }, [selectedQty, inventoryItems, xpInputCents]);

  const selection = useMemo(() => {
    let count = 0;
    let cents = 0;
    for (const item of inventoryItems) {
      count += item.count;
      cents += inventoryValueCents(item) * item.count;
    }
    return { count, cents };
  }, [inventoryItems]);

  const searchText = query.trim();
  const targetsKey = `${inputValueCents}|${searchText}`;
  const targetsFresh = loadedKey === targetsKey;

  // Pide los objetivos al servidor cuando cambia la entrada o la busqueda. El debounce evita un
  // fetch por pulsacion y `cancelled` descarta respuestas que llegan fuera de orden.
  useEffect(() => {
    void retryTick;
    const key = `${inputValueCents}|${searchText}`;
    const cur = pickRef.current;

    if (inputValueCents <= 0) {
      if (cur.item) setNotice('Sin entrada: se deseleccionó el objetivo.');
      choose({ item: null, mult: DEFAULT_MULT });
      setTargets(EMPTY_TARGETS);
      setTargetsError(null);
      setLoadedKey(key);
      return;
    }

    // Decision 9: un objetivo elegido a mano que queda fuera de rango se deselecciona y se avisa.
    if (cur.mult === null && cur.item && !inRange(cur.item.valueCents, inputValueCents)) {
      choose({ item: null, mult: null });
      setNotice(
        'El objetivo elegido ya no está en rango para esta entrada. Elige otro, usa un multiplicador o "Al azar".'
      );
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ entryCents: String(inputValueCents) });
        if (searchText) params.set('q', searchText);
        const res = await fetch(`/api/upgrade?${params}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error ?? `El servidor respondió ${res.status}`);
        const list = data?.targets as TargetList | undefined;
        if (!list || !Array.isArray(list.items)) throw new Error('Respuesta de objetivos inválida');
        setTargets(list);
        setTargetsError(null);
        setLoadedKey(key);
        // Decision 9: si se eligio por multiplicador, se recalcula con el multiplicador vigente.
        const now = pickRef.current;
        if (now.mult !== null) {
          const near = list.byMultiplier?.[String(now.mult)] ?? null;
          // Mismo id: no se reemplaza el objeto, para no reiniciar la rueda ni recalcular.
          if (near?.id !== now.item?.id) choose({ item: near, mult: now.mult });
          if (near) setNotice(null);
          else if (now.item) setNotice(NOTICE_UNAVAILABLE);
        }
      } catch (error) {
        if (cancelled) return;
        setTargets(EMPTY_TARGETS);
        setTargetsError((error as Error).message || 'No se pudieron cargar los objetivos');
        setLoadedKey(key);
        if (pickRef.current.mult !== null) choose({ item: null, mult: pickRef.current.mult });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inputValueCents, searchText, retryTick, choose]);

  // Lleva la grilla de objetivos hasta el elegido sin mover la pagina
  const pickedId = pick.item?.id ?? null;
  useEffect(() => {
    const grid = targetGridRef.current;
    if (!grid || !pickedId) return;
    const card = grid.querySelector<HTMLElement>(`[data-target-id="${pickedId}"]`);
    if (!card) return;
    grid.scrollTo({ top: card.offsetTop - grid.clientHeight / 2 + card.clientHeight / 2 });
  }, [pickedId, targets]);

  const targetItem = pick.item;

  const collapseInv = isMobile && !invExpanded && inventoryItems.length > MOBILE_COLLAPSED;
  const shownInventory = collapseInv ? inventoryItems.slice(0, MOBILE_COLLAPSED) : inventoryItems;
  const collapseTargets = isMobile && !targetsExpanded && targets.items.length > MOBILE_COLLAPSED;
  const baseTargets = collapseTargets ? targets.items.slice(0, MOBILE_COLLAPSED) : targets.items;
  // El objetivo elegido se ve siempre, primero, aunque no este en la muestra o en las 8 primeras.
  const shownTargets =
    targetItem && !baseTargets.some((t) => t.id === targetItem.id)
      ? [targetItem, ...baseTargets]
      : baseTargets;

  // Probabilidad real: la misma funcion y los mismos valores que usa el servidor al girar
  const calculation = useMemo<UpgradeCalculation | null>(() => {
    if (inputValueCents <= 0 || !targetItem || targetItem.valueCents <= inputValueCents) {
      return null;
    }
    return calculateUpgradeOdds(
      inputValueCents,
      targetItem.valueCents,
      UPGRADE_DEFAULT_EDGE,
      sectorMode
    );
  }, [inputValueCents, targetItem, sectorMode]);

  const multOptions = useMemo(
    () =>
      MULTIPLIERS.map((m) => {
        const goal = inputValueCents * m;
        let reason: 'entry' | 'max' | 'empty' | 'loading' | null = null;
        let near: UpgradeTargetCatalogItem | null = null;
        if (inputValueCents <= 0) reason = 'entry';
        else if (goal > targets.maxValueCents && targetsFresh) reason = 'max';
        else if (!targetsFresh) reason = 'loading';
        else {
          near = targets.byMultiplier[String(m)] ?? null;
          if (!near) reason = 'empty';
        }
        return { m, reason, near };
      }),
    [inputValueCents, targets, targetsFresh]
  );

  const multNotes = useMemo(() => {
    const notes: string[] = [];
    const byMax = multOptions
      .filter((o) => o.reason === 'max')
      .map((o) => `x${formatMultiplier(o.m)}`);
    if (byMax.length > 0) {
      notes.push(
        `${byMax.join(', ')} no disponible: ninguna skin llega a ese valor (la más cara del catálogo vale ~US$ ${formatUsdCents(targets.maxValueCents)}).`
      );
    }
    if (multOptions.some((o) => o.reason === 'empty')) {
      notes.push('No hay skins en el rango de esta entrada.');
    }
    if (searchText && targetsFresh && targets.total === 0 && inputValueCents > 0) {
      notes.push(`Sin resultados para "${searchText}" en este rango.`);
    }
    if (inputValueCents <= 0) notes.push('Los multiplicadores se activan al elegir una entrada.');
    return notes;
  }, [
    multOptions,
    targets.maxValueCents,
    targets.total,
    targetsFresh,
    searchText,
    inputValueCents,
  ]);

  const spinBlock = isSpinning
    ? null
    : inputValueCents <= 0
      ? 'Selecciona una skin o aporta XP para empezar.'
      : !targetsFresh
        ? LOADING_REASON
        : targetsError
          ? 'No se pudieron cargar los objetivos.'
          : !targetItem
            ? 'Elige una skin objetivo, un multiplicador o "Al azar".'
            : !calculation
              ? 'El objetivo debe valer más que tu entrada.'
              : null;

  const toggleInputItem = (item: InventoryItem) => {
    if (isSpinning) return;
    soundFX.playClick();
    // Cada toque suma una copia; al llegar a todas, la siguiente las quita.
    setSelectedQty((prev) => {
      const qty = prev[item.id] ?? 0;
      return { ...prev, [item.id]: qty >= item.count ? 0 : qty + 1 };
    });
  };

  const selectAll = () => {
    if (isSpinning) return;
    soundFX.playClick();
    setSelectedQty(Object.fromEntries(inventoryItems.map((i) => [i.id, i.count])));
  };

  const selectNone = () => {
    if (isSpinning) return;
    soundFX.playClick();
    setSelectedQty({});
  };

  const pickTarget = (item: UpgradeTargetCatalogItem) => {
    if (isSpinning) return;
    soundFX.playClick();
    setNotice(null);
    choose({ item, mult: null });
  };

  const pickMultiplier = (m: number, near: UpgradeTargetCatalogItem | null) => {
    if (isSpinning || !near) return;
    soundFX.playClick();
    setNotice(null);
    choose({ item: near, mult: m });
  };

  const pickRandom = () => {
    if (isSpinning || targets.items.length === 0) return;
    soundFX.playClick();
    setNotice(null);
    // El azar solo decide que objetivo mostrar; la tirada la resuelve el servidor.
    choose({ item: targets.items[Math.floor(Math.random() * targets.items.length)], mult: null });
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
    if (spinBlock || !targetItem) {
      showToast(spinBlock ?? 'Selecciona una skin objetivo', 'error');
      return;
    }

    soundFX.playClick();
    setIsSpinning(true);
    setLastOutcome(null);
    setTargetRollAngle(null);

    try {
      const operationId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : undefined;

      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          // Un id por copia seleccionada
          inputItemIds: inventoryItems.flatMap((i) =>
            Array.from({ length: selectedQty[i.id] ?? 0 }, () => i.id)
          ),
          xpSpentCents: xpInputCents > 0 ? xpInputCents : undefined,
          targetItemId: targetItem.id,
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
    // Entrada gastada: sin objetivo ni aviso, y datos frescos
    choose({ item: null, mult: DEFAULT_MULT });
    setNotice(null);
    setSelectedQty({});
    setXpInputCents(0);
    loadData();
  };

  const clampNote = calculation
    ? calculation.rawProbability > UPGRADE_MAX_PROBABILITY
      ? 'limitada al 95%'
      : calculation.rawProbability < UPGRADE_MIN_PROBABILITY
        ? 'limitada al 0,01%'
        : null
    : null;

  return (
    <div className="fade-in">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <Confetti active={showConfetti} />

      <main className="container">
        <Header xpBalance={xpBalance}>
          <a href="/" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
            <IconDashboard size={16} /> Dashboard
          </a>
          <a href="/rewards" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
            <IconGift size={16} /> Recompensas
          </a>
          <a href="/inventory" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
            <IconChest size={16} /> Inventario
          </a>
          <button className="nav-link nav-page active" aria-label="Upgrade">
            <IconUpgrade size={16} /> Upgrade
          </button>
          <a href="/ledger" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
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
              className="btn-action upg-tap"
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
        <div className="upg-board">
          {/* Ruleta Circular con Flecha Giratoria */}
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <UpgradeWheel
              calculation={calculation}
              isSpinning={isSpinning}
              targetRollAngle={targetRollAngle}
              outcome={lastOutcome}
              onSpinEnd={onSpinEnd}
            />

            <p className="upg-note" style={{ marginTop: '0.9rem' }}>
              Valores estimados por rareza salvo donde dice mercado. La probabilidad usa estos
              mismos valores para calcular y para cobrar.
            </p>

            {/* Selector de Dirección (Simple y sin tecnicismos) */}
            <div
              style={{
                display: 'inline-flex',
                gap: '0.4rem',
                marginTop: '0.6rem',
                background: 'var(--bg)',
                padding: '0.25rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <button
                className={`btn-action upg-tap ${sectorMode === 'under' ? 'active' : ''}`}
                disabled={isSpinning}
                aria-pressed={sectorMode === 'under'}
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
                className={`btn-action upg-tap ${sectorMode === 'over' ? 'active' : ''}`}
                disabled={isSpinning}
                aria-pressed={sectorMode === 'over'}
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
          <div style={{ minWidth: 0 }}>
            <div className="upg-summary">
              <div className="upg-summary-row">
                <span className="upg-label">Tu Entrada</span>
                <span className="upg-value">
                  ~US$ {formatUsdCents(inputValueCents)}
                  {xpInputCents > 0 && (
                    <small
                      style={{ marginLeft: '0.4rem', color: 'var(--accent-xp)', fontWeight: 600 }}
                    >
                      (+{formatXp(xpInputCents)})
                    </small>
                  )}
                </span>
              </div>

              <div className="upg-summary-row">
                <span className="upg-label">Skin Objetivo</span>
                <span className="upg-value" style={{ color: 'var(--accent-xp)', minWidth: 0 }}>
                  {targetItem ? (
                    <>
                      <span className="upg-target-name" title={targetItem.name}>
                        {targetItem.name}
                      </span>
                      ~US$ {formatUsdCents(targetItem.valueCents)}
                      {!targetItem.priceIsFallback && <span className="upg-chip">mercado</span>}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>

              <div className="upg-summary-row">
                <span className="upg-label">Probabilidad de Éxito</span>
                <span className="upg-value" style={{ color: 'var(--accent-primary)' }}>
                  {calculation
                    ? `${formatPercent(calculation.winPercentage)}% (x${formatMultiplier(calculation.multiplier)})`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Probabilidad y motivo del boton, anunciados al lector de pantalla */}
            <p className="upg-live" aria-live="polite">
              {calculation
                ? `Probabilidad de éxito ${formatPercent(calculation.winPercentage)}%${clampNote ? `, ${clampNote}` : ''}.`
                : ''}
              {spinBlock && spinBlock !== LOADING_REASON ? ` ${spinBlock}` : ''}
            </p>

            {/* Botón Principal */}
            <button
              className="btn"
              disabled={isSpinning || spinBlock !== null}
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
        <div className="upg-columns">
          {/* Tu Inventario */}
          <div style={{ minWidth: 0 }}>
            <h2 className="upg-h2">
              <IconChest size={17} /> Tu Inventario
            </h2>

            {/* Aporte de XP directo o complementario */}
            <div className="upg-xp-box">
              <div className="upg-xp-header">
                <span className="upg-xp-title">
                  <IconLightning size={16} color="var(--accent-xp)" /> Aportar XP de saldo
                </span>
                <span className="upg-xp-bal">
                  Saldo: <strong>{formatXp(xpBalance)}</strong>
                </span>
              </div>
              <div className="upg-xp-body">
                <div className="upg-xp-input-wrapper">
                  <input
                    type="number"
                    min={0}
                    max={Number((xpBalance / 100).toFixed(2))}
                    step={0.5}
                    value={xpInputCents > 0 ? (xpInputCents / 100).toString() : ''}
                    placeholder="0.00"
                    disabled={isSpinning || xpBalance <= 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (Number.isNaN(val) || val <= 0) {
                        setXpInputCents(0);
                      } else {
                        const cents = Math.min(Math.round(val * 100), xpBalance);
                        setXpInputCents(cents);
                      }
                    }}
                    className="upg-xp-input"
                    aria-label="Cantidad de XP a aportar al upgrade"
                  />
                  <span className="upg-xp-unit">XP</span>
                </div>
                <div className="upg-xp-actions">
                  <button
                    type="button"
                    className="btn-action upg-quick-btn"
                    disabled={isSpinning || xpBalance < 100}
                    onClick={() => {
                      soundFX.playClick();
                      setXpInputCents((prev) => Math.min(prev + 100, xpBalance));
                    }}
                  >
                    +1 XP
                  </button>
                  <button
                    type="button"
                    className="btn-action upg-quick-btn"
                    disabled={isSpinning || xpBalance < 250}
                    onClick={() => {
                      soundFX.playClick();
                      setXpInputCents((prev) => Math.min(prev + 250, xpBalance));
                    }}
                  >
                    +2.50 XP
                  </button>
                  <button
                    type="button"
                    className="btn-action upg-quick-btn"
                    disabled={isSpinning || xpBalance < 500}
                    onClick={() => {
                      soundFX.playClick();
                      setXpInputCents((prev) => Math.min(prev + 500, xpBalance));
                    }}
                  >
                    +5 XP
                  </button>
                  <button
                    type="button"
                    className="btn-action upg-quick-btn"
                    disabled={isSpinning || xpBalance <= 0 || xpInputCents === xpBalance}
                    onClick={() => {
                      soundFX.playClick();
                      setXpInputCents(xpBalance);
                    }}
                  >
                    Máx
                  </button>
                  {xpInputCents > 0 && (
                    <button
                      type="button"
                      className="btn-action upg-quick-btn"
                      disabled={isSpinning}
                      onClick={() => {
                        soundFX.playClick();
                        setXpInputCents(0);
                      }}
                      title="Quitar aporte de XP"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="upg-tools">
              <button
                type="button"
                className="btn-action"
                onClick={selectAll}
                disabled={isSpinning || selection.count === 0}
              >
                Seleccionar todo: {selection.count} · ~US$ {formatUsdCents(selection.cents)}
              </button>
              <button
                type="button"
                className="btn-action"
                onClick={selectNone}
                disabled={isSpinning || inputValueCents === 0}
              >
                Nada
              </button>
            </div>
            <div className="upg-grid">
              {inventoryItems.length === 0 ? (
                <div className="upg-empty">
                  No tienes skins disponibles en tu inventario. Canjea cajas para conseguir skins.
                </div>
              ) : (
                shownInventory.map((item) => {
                  const qty = selectedQty[item.id] ?? 0;
                  const valCents = inventoryValueCents(item);
                  const grade = getCs2Grade(item);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className="upg-card"
                      aria-pressed={qty > 0}
                      disabled={isSpinning}
                      title={`${item.name}: ~US$ ${formatUsdCents(valCents)}`}
                      style={{ borderBottom: `3px solid ${grade.hex}` }}
                      onClick={() => toggleInputItem(item)}
                    >
                      {item.image && <img src={item.image} alt="" className="upg-img" />}
                      <span className="upg-name">{item.name}</span>
                      <SkinGradeBadge grade={grade} size="xs" variant="text" />
                      <span className="upg-price">
                        ~US$ {formatUsdCents(valCents)}
                        {!item.priceIsFallback && <span className="upg-chip">mercado</span>}
                      </span>
                      {item.count > 1 && (
                        <span className="upg-qty">
                          {qty} de {item.count}
                        </span>
                      )}
                      {qty > 0 && (
                        <span className="upg-check" aria-hidden="true">
                          <IconCheck size={11} color="var(--on-accent)" />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {isMobile && inventoryItems.length > MOBILE_COLLAPSED && (
              <button
                type="button"
                className="btn-action upg-more"
                aria-expanded={invExpanded}
                onClick={() => setInvExpanded((v) => !v)}
              >
                {invExpanded ? 'Mostrar menos' : `Mostrar todas (${inventoryItems.length})`}
              </button>
            )}
          </div>

          {/* Catálogo de Skins Objetivo */}
          <div style={{ minWidth: 0 }}>
            <h2 className="upg-h2">
              <IconGift size={17} /> Elige qué skin quieres conseguir
            </h2>

            <div className="upg-tools" role="group" aria-label="Multiplicador">
              {multOptions.map(({ m, reason, near }) => {
                const real = near && inputValueCents > 0 ? near.valueCents / inputValueCents : m;
                const differs = formatMultiplier(real) !== formatMultiplier(m);
                return (
                  <button
                    type="button"
                    key={m}
                    className="btn-action upg-mult"
                    aria-pressed={pick.mult === m && targetItem !== null}
                    disabled={isSpinning || reason !== null}
                    onClick={() => pickMultiplier(m, near)}
                  >
                    x{formatMultiplier(m)}
                    {differs && <small> (x{formatMultiplier(real)})</small>}
                  </button>
                );
              })}
              <button
                type="button"
                className="btn-action"
                disabled={isSpinning || !targetsFresh || targets.items.length === 0}
                onClick={pickRandom}
              >
                Al azar
              </button>
            </div>
            <p className="upg-note">{multNotes.join(' ')}</p>

            <label className="upg-search">
              <span className="upg-label">Buscar por nombre</span>
              <input
                type="search"
                value={query}
                maxLength={60}
                disabled={isSpinning}
                placeholder="AK-47, Karambit, Redline…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            {notice && (
              <p className="upg-note upg-warn" role="status">
                {notice}
              </p>
            )}
            {targetsError && (
              <p className="upg-note upg-warn" role="alert">
                No se pudieron cargar los objetivos: {targetsError}{' '}
                <button
                  type="button"
                  className="btn-action upg-tap"
                  disabled={isSpinning}
                  onClick={() => setRetryTick((n) => n + 1)}
                >
                  Reintentar
                </button>
              </p>
            )}
            {inputValueCents > 0 && !targetsError && (
              <p className="upg-note">
                {targetsFresh
                  ? `Mostrando ${targets.items.length} de ${targets.total} skins que valen entre x${formatMultiplier(UPGRADE_MIN_MULT)} y x${UPGRADE_MAX_LIST_MULT} tu entrada.`
                  : LOADING_REASON}
              </p>
            )}

            <div
              ref={targetGridRef}
              className="upg-grid"
              aria-busy={!targetsFresh}
              style={{ opacity: targetsFresh ? 1 : 0.55 }}
            >
              {shownTargets.length === 0 && (
                <div className="upg-empty">
                  {inputValueCents <= 0
                    ? 'Elige skins de tu inventario o aporta XP para ver a qué puedes mejorar.'
                    : targetsError
                      ? 'Sin lista de objetivos.'
                      : targetsFresh
                        ? searchText
                          ? `Sin resultados para "${searchText}".`
                          : 'No hay skins en ese rango.'
                        : 'Cargando…'}
                </div>
              )}
              {shownTargets.map((target) => {
                const targetGrade = getCs2Grade(target);
                return (
                  <button
                    type="button"
                    key={target.id}
                    data-target-id={target.id}
                    className="upg-card upg-card-target"
                    aria-pressed={targetItem?.id === target.id}
                    disabled={isSpinning}
                    title={`${target.name}: ~US$ ${formatUsdCents(target.valueCents)}`}
                    style={{ borderBottom: `3px solid ${targetGrade.hex}` }}
                    onClick={() => pickTarget(target)}
                  >
                    {target.image && <img src={target.image} alt="" className="upg-img" />}
                    <span className="upg-name">{target.name}</span>
                    <SkinGradeBadge grade={targetGrade} size="xs" variant="text" />
                    <span className="upg-price" style={{ color: 'var(--accent-xp)' }}>
                      ~US$ {formatUsdCents(target.valueCents)}
                      {!target.priceIsFallback && <span className="upg-chip">mercado</span>}
                    </span>
                    {targetItem?.id === target.id && (
                      <span className="upg-check upg-check-target" aria-hidden="true">
                        <IconCheck size={11} color="var(--on-accent)" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {isMobile && targets.items.length > MOBILE_COLLAPSED && (
              <button
                type="button"
                className="btn-action upg-more"
                aria-expanded={targetsExpanded}
                onClick={() => setTargetsExpanded((v) => !v)}
              >
                {targetsExpanded ? 'Mostrar menos' : `Mostrar todas (${targets.items.length})`}
              </button>
            )}
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

              <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem' }}>
                {lastResult.targetItem.name}
              </h2>

              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                <SkinGradeBadge item={lastResult.targetItem} size="md" showDot />
              </div>

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
                ~US$ {formatUsdCents(lastResult.targetItem.valueCents)} (
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
                        color: 'var(--text-main)',
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
                    <span>Probabilidad: {formatPercent((row.win_probability ?? 0) * 100)}%</span>
                    <span
                      style={{
                        color:
                          row.outcome === 'won' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      }}
                    >
                      ~US$ {formatUsdCents(row.target_value_cents)}
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
