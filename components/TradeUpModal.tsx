'use client';

import { useCallback, useEffect, useState } from 'react';
import Confetti from '@/components/Confetti';
import { IconClose, IconSparkles } from '@/components/Icons';
import Modal from '@/components/Modal';
import {
  CS2_GRADES,
  getCs2Grade,
  getNextGrade,
  TRADE_UP_INPUT_GRADES,
  type Cs2GradeId,
} from '@/lib/cs2-grade';
import { soundFX } from '@/lib/sound';
import type { TradeUpPreviewResult } from '@/lib/trade-up';
import type { RewardRow } from '@/lib/rewards-store';

export interface TradeUpInventoryItem {
  id: string;
  name: string;
  rarity: string | null;
  rarity_color?: string | null;
  chest_id?: string | null;
  image: string | null;
  count: number;
}

interface TradeUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventory: TradeUpInventoryItem[];
}

export default function TradeUpModal({
  isOpen,
  onClose,
  onSuccess,
  inventory,
}: TradeUpModalProps) {
  const [selectedGrade, setSelectedGrade] = useState<Cs2GradeId>('milspec');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<TradeUpPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm' | 'reveal'>('select');
  const [wonItem, setWonItem] = useState<RewardRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedIds([]);
    setPreview(null);
    setWonItem(null);
    setError(null);
    setShowConfetti(false);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  // Filtrar objetos del inventario por el grado seleccionado
  const eligibleInventory = inventory.filter((item) => {
    const grade = getCs2Grade(item);
    return grade.id === selectedGrade && item.count > 0;
  });

  // Conteo de items seleccionados por id
  const selectedCounts = selectedIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});

  // Reiniciar selecciones al cambiar de grado
  const handleGradeChange = (gradeId: Cs2GradeId) => {
    soundFX.playClick();
    setSelectedGrade(gradeId);
    setSelectedIds([]);
    setPreview(null);
    setError(null);
  };

  // Añadir una skin al contrato
  const handleAddItem = (item: TradeUpInventoryItem) => {
    if (selectedIds.length >= 10) return;
    const currentCount = selectedCounts[item.id] ?? 0;
    if (currentCount >= item.count) return;

    soundFX.playClick();
    setSelectedIds((prev) => [...prev, item.id]);
    setError(null);
  };

  // Quitar una skin del contrato por su índice en el slot
  const handleRemoveSlot = (index: number) => {
    soundFX.playClick();
    setSelectedIds((prev) => prev.filter((_, i) => i !== index));
    setPreview(null);
  };

  // Quitar todas las instancias de un item
  const handleRemoveItem = (id: string) => {
    soundFX.playClick();
    setSelectedIds((prev) => {
      const idx = prev.lastIndexOf(id);
      if (idx === -1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
    setPreview(null);
  };

  // Cargar previsualización de probabilidades cuando hay 10 skins
  const fetchPreview = useCallback(async (ids: string[], signal: AbortSignal) => {
    if (ids.length !== 10) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch('/api/inventory/trade-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: ids, preview: true }),
        signal,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Error al calcular probabilidades');
      }
      setPreview(data);
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Error al calcular probabilidades');
      setPreview(null);
    } finally {
      if (!signal.aborted) setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (selectedIds.length === 10) {
      fetchPreview(selectedIds, controller.signal);
    } else {
      setPreview(null);
      setLoadingPreview(false);
    }
    return () => controller.abort();
  }, [selectedIds, fetchPreview]);

  // Ejecutar el contrato
  const handleSignContract = async () => {
    if (selectedIds.length !== 10 || submitting) return;
    soundFX.playClick();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/inventory/trade-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputGrade: selectedGrade,
          itemIds: selectedIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Error al ejecutar el contrato');
      }

      setWonItem(data.wonItem);
      setStep('reveal');

      const wonGrade = getCs2Grade(data.wonItem);
      if (wonGrade.id === 'classified' || wonGrade.id === 'covert' || wonGrade.id === 'extraordinary') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4500);
      }

      soundFX.playCaseUnlock();
      setTimeout(() => {
        const soundRarity =
          data.wonItem.rarity === 'common' ||
          data.wonItem.rarity === 'rare' ||
          data.wonItem.rarity === 'epic' ||
          data.wonItem.rarity === 'legendary'
            ? data.wonItem.rarity
            : 'rare';
        soundFX.playReveal(soundRarity);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el contrato');
      setStep('select');
    } finally {
      setSubmitting(false);
    }
  };

  // Cerrar y refrescar
  const handleFinish = () => {
    soundFX.playClick();
    resetState();
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  const currentGradeInfo = CS2_GRADES[selectedGrade];
  const targetGradeInfo = getNextGrade(selectedGrade);

  // Mapear slots ocupados con datos del inventario
  const filledSlots = selectedIds.map((id) => {
    return eligibleInventory.find((it) => it.id === id) || {
      id,
      name: 'Skin',
      image: null,
      rarity: null,
      rarity_color: currentGradeInfo.hex,
      count: 1,
    };
  });

  return (
    <Modal onClose={step === 'reveal' ? handleFinish : onClose}>
      <div
        className="modal-dialog trade-up-dialog"
        style={{
          maxWidth: '820px',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderTop: `4px solid ${currentGradeInfo.hex}`,
          overflow: 'hidden',
          padding: 0,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-up-title"
      >
        {showConfetti && <Confetti active={showConfetti} durationMs={4500} />}

        {/* Encabezado del modal */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: currentGradeInfo.hex,
                }}
              />
              <h2 id="trade-up-title" style={{ fontSize: '1.3rem', margin: 0 }}>
                Contrato Trade-Up de CS2
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              10 skins de {currentGradeInfo.nameEs} &rarr; 1 skin de {targetGradeInfo?.nameEs ?? 'Grado Superior'}
            </p>
          </div>
          {step !== 'reveal' && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.4rem',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Cerrar contrato"
            >
              <IconClose size={20} />
            </button>
          )}
        </div>

        {/* Cuerpo del modal según el paso */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
          }}
        >
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'color-mix(in srgb, var(--error) 15%, transparent)',
                border: '1px solid var(--error)',
                borderRadius: '4px',
                color: 'var(--error)',
                fontSize: '0.88rem',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {step === 'reveal' && wonItem && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '2rem 1rem',
                gap: '1.2rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.82rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  color: getCs2Grade(wonItem).hex,
                  fontWeight: 700,
                }}
              >
                &iexcl;Contrato Firmado con &Eacute;xito!
              </span>

              <div
                style={{
                  width: '240px',
                  height: '180px',
                  borderRadius: '8px',
                  background: 'var(--bg)',
                  border: `3px solid ${getCs2Grade(wonItem).hex}`,
                  boxShadow: `0 0 28px color-mix(in srgb, ${getCs2Grade(wonItem).hex} 40%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                  position: 'relative',
                }}
              >
                {wonItem.image ? (
                  <img
                    src={wonItem.image}
                    alt={wonItem.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <IconSparkles size={48} color={getCs2Grade(wonItem).hex} />
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '1.4rem', margin: '0 0 0.4rem' }}>{wonItem.name}</h3>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    background: 'color-mix(in srgb, var(--border) 50%, transparent)',
                    color: getCs2Grade(wonItem).hex,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {getCs2Grade(wonItem).nameEs}
                </span>
              </div>

              <button
                type="button"
                className="btn-action"
                onClick={handleFinish}
                style={{
                  marginTop: '1rem',
                  padding: '0.65rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: 'var(--accent-primary)',
                  color: 'var(--bg)',
                }}
              >
                Enviar al inventario
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.2rem',
                padding: '0.5rem 0',
              }}
            >
              <div
                style={{
                  padding: '1rem',
                  background: 'color-mix(in srgb, var(--accent-xp) 12%, transparent)',
                  border: '1px solid var(--accent-xp)',
                  borderRadius: '6px',
                }}
              >
                <h4 style={{ margin: '0 0 0.4rem', color: 'var(--accent-xp)' }}>
                  Confirmaci&oacute;n de Contrato Irreversible
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Las 10 skins seleccionadas ser&aacute;n destruidas permanentemente para obtener 1 skin
                  de grado <strong>{targetGradeInfo?.nameEs}</strong>.
                </p>
              </div>

              {preview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Probabilidades por Colecci&oacute;n:
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.6rem',
                    }}
                  >
                    {preview.collections.map((col) => (
                      <div
                        key={col.chestId}
                        style={{
                          padding: '0.6rem 0.8rem',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{col.chestName}</div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {col.inputCount} skins ({col.weightPercent.toFixed(1)}%) &rarr; {col.outcomeCount} resultados
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1rem',
                }}
              >
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => setStep('select')}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-action"
                  onClick={handleSignContract}
                  disabled={submitting}
                  style={{
                    background: 'var(--accent-primary)',
                    color: 'var(--bg)',
                    fontWeight: 700,
                  }}
                >
                  {submitting ? 'Firmando...' : 'Firmar y Ejecutar Contrato'}
                </button>
              </div>
            </div>
          )}

          {step === 'select' && (
            <>
              {/* Selector de grado de entrada */}
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '0.5rem',
                  }}
                >
                  Selecciona el grado de las 10 skins
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {TRADE_UP_INPUT_GRADES.map((gradeId) => {
                    const info = CS2_GRADES[gradeId];
                    const countInInv = inventory
                      .filter((it) => getCs2Grade(it).id === gradeId)
                      .reduce((sum, it) => sum + it.count, 0);
                    const isSelected = selectedGrade === gradeId;

                    return (
                      <button
                        key={gradeId}
                        type="button"
                        onClick={() => handleGradeChange(gradeId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.82rem',
                          borderRadius: '4px',
                          border: `1px solid ${isSelected ? info.hex : 'var(--border)'}`,
                          background: isSelected ? info.hex : 'transparent',
                          color: isSelected ? '#000' : 'var(--text)',
                          fontWeight: isSelected ? 700 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isSelected ? '#000' : info.hex,
                          }}
                        />
                        <span>{info.nameEs}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({countInInv})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 10 Slots superiores del contrato */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Skins en el Contrato: {selectedIds.length} / 10
                  </span>
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      className="nav-link"
                      style={{ fontSize: '0.78rem', padding: 0 }}
                      onClick={() => {
                        soundFX.playClick();
                        setSelectedIds([]);
                        setPreview(null);
                      }}
                    >
                      Vaciar slots
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '0.5rem',
                  }}
                >
                  {Array.from({ length: 10 }).map((_, index) => {
                    const item = filledSlots[index];
                    const isFilled = index < selectedIds.length;

                    return (
                      <button
                        type="button"
                        key={index}
                        disabled={!isFilled}
                        onClick={() => isFilled && handleRemoveSlot(index)}
                        style={{
                          height: '84px',
                          borderRadius: '4px',
                          border: isFilled
                            ? `1px solid ${currentGradeInfo.hex}`
                            : '1px dashed var(--border)',
                          background: isFilled ? 'var(--bg-card)' : 'transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.3rem',
                          textAlign: 'center',
                          cursor: isFilled ? 'pointer' : 'default',
                          position: 'relative',
                          width: '100%',
                          color: 'inherit',
                          font: 'inherit',
                        }}
                        aria-label={
                          isFilled
                            ? `Slot ${index + 1}: ${item.name}. Presiona para remover del contrato`
                            : `Slot ${index + 1}: Vacío`
                        }
                        title={isFilled ? `Hacer clic para remover ${item.name}` : undefined}
                      >
                        {isFilled ? (
                          <>
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                style={{ maxHeight: '42px', maxWidth: '100%', objectFit: 'contain' }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.75rem' }}>Skin</span>
                            )}
                            <span
                              style={{
                                fontSize: '0.68rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                marginTop: '0.2rem',
                              }}
                            >
                              {item.name}
                            </span>
                            <span
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                fontSize: '0.65rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              &times;
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {index + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vista previa de probabilidades si 10 skins están seleccionadas */}
              {loadingPreview && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Calculando balance de cajas y probabilidades de CS2...
                </div>
              )}

              {preview && (
                <div
                  style={{
                    padding: '0.8rem 1rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Posibles Resultados ({preview.totalOutcomes} skins):
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: preview.targetGrade.hex,
                      }}
                    >
                      Grado {preview.targetGrade.nameEs}
                    </span>
                  </div>

                  <div
                    style={{
                      maxHeight: '130px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    {preview.outcomes.map((out) => (
                      <div
                        key={out.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '3px',
                          background: 'var(--bg)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: out.grade.hex,
                            }}
                          />
                          <span>{out.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            ({out.chestName})
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: out.grade.hex,
                          }}
                        >
                          {out.chancePercent.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventario disponible para el grado elegido */}
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                  }}
                >
                  Tus skins disponibles de {currentGradeInfo.nameEs} ({eligibleInventory.length})
                </span>

                {eligibleInventory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                    No tienes skins de {currentGradeInfo.nameEs} en tu inventario. Abre cofres para
                    conseguir skins de este grado.
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '0.5rem',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      padding: '0.2rem',
                    }}
                  >
                    {eligibleInventory.map((item) => {
                      const selectedCount = selectedCounts[item.id] ?? 0;
                      const remainingCount = item.count - selectedCount;
                      const isFullyUsed = remainingCount <= 0;

                      return (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                              if (!isFullyUsed && selectedIds.length < 10) {
                                handleAddItem(item);
                              }
                            }
                          }}
                          style={{
                            padding: '0.6rem',
                            borderRadius: '4px',
                            border: `1px solid ${selectedCount > 0 ? currentGradeInfo.hex : 'var(--border)'}`,
                            background: 'var(--bg-card)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '0.25rem',
                            opacity: isFullyUsed ? 0.4 : 1,
                            cursor: isFullyUsed || selectedIds.length >= 10 ? 'default' : 'pointer',
                          }}
                        >
                          <div style={{ height: '48px', display: 'flex', alignItems: 'center' }}>
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                style={{ maxHeight: '44px', maxWidth: '100%', objectFit: 'contain' }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.75rem' }}>Skin</span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '100%',
                            }}
                          >
                            {item.name}
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%',
                              marginTop: '0.35rem',
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <span>Disp: {remainingCount}</span>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              {selectedCount > 0 && (
                                <button
                                  type="button"
                                  className="btn-action"
                                  style={{
                                    padding: 0,
                                    minWidth: '32px',
                                    minHeight: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveItem(item.id);
                                  }}
                                  aria-label={`Quitar una unidad de ${item.name}`}
                                  title="Quitar una"
                                >
                                  -
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-action"
                                style={{
                                  padding: 0,
                                  minWidth: '32px',
                                  minHeight: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddItem(item);
                                }}
                                disabled={isFullyUsed || selectedIds.length >= 10}
                                aria-label={`Añadir ${item.name} al contrato`}
                                title="Añadir al contrato"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botón de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => setStep('confirm')}
                  disabled={selectedIds.length !== 10}
                  style={{
                    padding: '0.6rem 1.4rem',
                    fontWeight: 700,
                    background: selectedIds.length === 10 ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: selectedIds.length === 10 ? 'var(--bg)' : 'var(--text-muted)',
                    borderColor: selectedIds.length === 10 ? 'var(--accent-primary)' : 'var(--border)',
                  }}
                >
                  {selectedIds.length === 10
                    ? 'Revisar y Firmar Contrato'
                    : `Faltan ${10 - selectedIds.length} skins`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
