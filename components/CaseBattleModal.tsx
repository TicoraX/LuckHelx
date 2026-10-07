"use client";

import { useEffect, useRef, useState } from "react";
import Confetti from "@/components/Confetti";
import {
	BOTS,
	type CaseBattleBot,
	type CaseBattleResult,
} from "@/lib/case-battle";
import { buildReel, type ReelChestItem, WINNER_INDEX } from "@/lib/chest-reel";
import { soundFX } from "@/lib/sound";
import { formatXp } from "@/lib/xp";

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

const DUAL_CELL_WIDTH = 140;
const DUAL_CELL_GAP = 10;
const BATTLE_SPIN_DURATION_MS = 5000;
const SPIN_EASING = "cubic-bezier(0.12, 0.8, 0.18, 1)";

function rarityColor(rarity: string | null): string {
	if (rarity === "legendary") return "var(--rarity-legendary)";
	if (rarity === "epic") return "var(--rarity-epic)";
	if (rarity === "rare") return "var(--rarity-rare)";
	return "var(--rarity-common)";
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
	const [phase, setPhase] = useState<"idle" | "spinning" | "finished">("idle");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [battleResult, setBattleResult] = useState<CaseBattleResult | null>(
		null,
	);

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
			if (e.key === "Escape") {
				if (phase === "spinning") {
					setSkip(true);
				} else {
					onClose();
				}
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [phase, onClose]);

	// Clean up timer on unmount
	useEffect(() => {
		return () => {
			if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
		};
	}, []);

	async function startBattle() {
		if (!canAfford || loading || phase === "spinning") return;
		setError("");
		setLoading(true);
		soundFX.playClick();

		try {
			const res = await fetch("/api/case-battle", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chestId: chest.id,
					botId: selectedBot.id,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Error al iniciar la batalla");
			}

			const result: CaseBattleResult = await res.json();
			setBattleResult(result);
			onBattleComplete?.();

			// Build reels for both participants
			const pWidth = playerViewportRef.current?.clientWidth ?? 350;
			const bWidth = botViewportRef.current?.clientWidth ?? 350;

			const pReel = buildReel(
				pool,
				result.playerItem.id,
				DUAL_CELL_WIDTH,
				pWidth,
			);
			const bReel = buildReel(pool, result.botItem.id, DUAL_CELL_WIDTH, bWidth);

			setPlayerReel(pReel.items);
			setBotReel(bReel.items);

			const prefersReduced =
				typeof window !== "undefined" &&
				window.matchMedia("(prefers-reduced-motion: reduce)").matches;

			if (skip || prefersReduced) {
				setPlayerOffset(pReel.targetOffset);
				setBotOffset(bReel.targetOffset);
				setPhase("finished");
				setLoading(false);
				triggerBattleEndAudio(result.winner);
				return;
			}

			setPhase("spinning");
			setLoading(false);

			// Double rAF to ensure DOM commit before triggering CSS transition
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					soundFX.playCaseUnlock();
					setPlayerOffset(pReel.targetOffset);
					setBotOffset(bReel.targetOffset);
				});
			});

			spinTimerRef.current = setTimeout(() => {
				setPhase("finished");
				triggerBattleEndAudio(result.winner);
			}, BATTLE_SPIN_DURATION_MS + 100);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error inesperado");
			setLoading(false);
			setPhase("idle");
		}
	}

	function triggerBattleEndAudio(winner: "player" | "bot" | "tie") {
		if (winner === "player") {
			soundFX.playBattleVictory();
			setShowConfetti(true);
		} else if (winner === "bot") {
			soundFX.playBattleDefeat();
		} else {
			soundFX.playClick();
		}
	}

	function handleSkip() {
		setSkip(true);
		if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
		if (battleResult) {
			const pWidth = playerViewportRef.current?.clientWidth ?? 350;
			const bWidth = botViewportRef.current?.clientWidth ?? 350;
			const pReel = buildReel(
				pool,
				battleResult.playerItem.id,
				DUAL_CELL_WIDTH,
				pWidth,
			);
			const bReel = buildReel(
				pool,
				battleResult.botItem.id,
				DUAL_CELL_WIDTH,
				bWidth,
			);
			setPlayerOffset(pReel.targetOffset);
			setBotOffset(bReel.targetOffset);
			setPhase("finished");
			triggerBattleEndAudio(battleResult.winner);
		}
	}

	function resetForRematch() {
		setPhase("idle");
		setBattleResult(null);
		setPlayerOffset(0);
		setBotOffset(0);
		setSkip(false);
		setShowConfetti(false);
		setError("");
	}

	return (
		<div
			className="modal-backdrop"
			role="dialog"
			aria-modal="true"
			aria-labelledby="case-battle-modal-title"
			style={{
				position: "fixed",
				inset: 0,
				backgroundColor: "rgba(0, 0, 0, 0.85)",
				backdropFilter: "blur(8px)",
				zIndex: 1000,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "1rem",
			}}
		>
			{showConfetti && <Confetti />}

			<div
				className="modal-dialog"
				style={{
					width: "100%",
					maxWidth: "960px",
					backgroundColor: "var(--card-bg, #1a1e29)",
					borderRadius: "16px",
					border: "1px solid var(--border-color, #2d3748)",
					boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
					maxHeight: "92vh",
				}}
			>
				{/* Header */}
				<div
					style={{
						padding: "1.25rem 1.75rem",
						borderBottom: "1px solid var(--border-color, #2d3748)",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						background:
							"linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
					}}
				>
					<div
						style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
					>
						<span style={{ fontSize: "1.5rem" }}>⚔️</span>
						<div>
							<h2
								id="case-battle-modal-title"
								style={{
									margin: 0,
									fontSize: "1.25rem",
									fontWeight: 700,
									color: "var(--text-primary, #fff)",
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
								}}
							>
								Case Battle 1v1
								<span
									style={{
										fontSize: "0.75rem",
										padding: "0.2rem 0.5rem",
										borderRadius: "999px",
										backgroundColor: "rgba(234, 179, 8, 0.15)",
										color: "#eab308",
										border: "1px solid rgba(234, 179, 8, 0.3)",
										fontWeight: 600,
									}}
								>
									Winner Takes All
								</span>
							</h2>
							<p
								style={{
									margin: 0,
									fontSize: "0.825rem",
									color: "var(--text-muted, #94a3b8)",
								}}
							>
								Duelo en tiempo real contra bots del sistema con probabilidades
								oficiales
							</p>
						</div>
					</div>

					<button
						type="button"
						onClick={onClose}
						className="btn"
						style={{
							padding: "0.5rem 0.75rem",
							borderRadius: "8px",
							border: "none",
							background: "transparent",
							color: "var(--text-muted, #94a3b8)",
							fontSize: "1.25rem",
							cursor: "pointer",
						}}
						aria-label="Cerrar modal"
					>
						✕
					</button>
				</div>

				{/* Modal Body */}
				<div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
					{error && (
						<div
							style={{
								marginBottom: "1rem",
								padding: "0.75rem 1rem",
								borderRadius: "8px",
								backgroundColor: "rgba(239, 68, 68, 0.15)",
								border: "1px solid rgba(239, 68, 68, 0.3)",
								color: "#ef4444",
								fontSize: "0.875rem",
							}}
						>
							{error}
						</div>
					)}

					{/* Arena Visuals (Dual Reels) */}
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: "1.25rem",
							marginBottom: "1.5rem",
						}}
					>
						{/* Player Column */}
						<div
							style={{
								backgroundColor: "rgba(0, 0, 0, 0.3)",
								border: `2px solid ${
									phase === "finished" && battleResult?.winner === "player"
										? "#22c55e"
										: "var(--border-color, #2d3748)"
								}`,
								borderRadius: "12px",
								padding: "1rem",
								display: "flex",
								flexDirection: "column",
								position: "relative",
								transition: "border-color 0.3s ease",
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: "0.75rem",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
									}}
								>
									<span style={{ fontSize: "1.25rem" }}>👤</span>
									<span style={{ fontWeight: 700, color: "#38bdf8" }}>Tú</span>
								</div>
								{phase === "finished" && battleResult && (
									<span
										style={{
											fontSize: "0.85rem",
											fontWeight: 700,
											color:
												battleResult.winner === "player"
													? "#22c55e"
													: battleResult.winner === "bot"
														? "#ef4444"
														: "#eab308",
										}}
									>
										${battleResult.playerItem.valueUsd.toFixed(2)} USD
									</span>
								)}
							</div>

							{/* Player Reel Viewport */}
							<div
								ref={playerViewportRef}
								style={{
									height: "130px",
									backgroundColor: "#0f172a",
									borderRadius: "8px",
									overflow: "hidden",
									position: "relative",
									border: "1px solid rgba(255, 255, 255, 0.05)",
								}}
							>
								{/* Center marker line */}
								<div
									style={{
										position: "absolute",
										top: 0,
										bottom: 0,
										left: "50%",
										width: "3px",
										transform: "translateX(-50%)",
										backgroundColor: "#eab308",
										zIndex: 10,
										boxShadow: "0 0 10px #eab308",
										pointerEvents: "none",
									}}
								/>

								{/* Track */}
								<div
									style={{
										display: "flex",
										height: "100%",
										transform: `translateX(-${playerOffset}px)`,
										transition:
											phase === "spinning" && !skip
												? `transform ${BATTLE_SPIN_DURATION_MS}ms ${SPIN_EASING}`
												: "none",
										willChange: "transform",
									}}
								>
									{(playerReel.length > 0 ? playerReel : pool.slice(0, 10)).map(
										(item, idx) => (
											<div
												key={`${item.id}-${idx}`}
												style={{
													width: `${DUAL_CELL_WIDTH}px`,
													marginRight: `${DUAL_CELL_GAP}px`,
													flexShrink: 0,
													height: "100%",
													display: "flex",
													flexDirection: "column",
													alignItems: "center",
													justifyContent: "center",
													padding: "0.5rem",
													borderBottom: `4px solid ${rarityColor(item.rarity)}`,
													backgroundColor:
														idx === WINNER_INDEX && phase === "finished"
															? "rgba(255, 255, 255, 0.08)"
															: "transparent",
													textAlign: "center",
												}}
											>
												{item.image ? (
													<img
														src={item.image}
														alt={item.name}
														style={{
															maxHeight: "65px",
															maxWidth: "100%",
															objectFit: "contain",
															filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))",
														}}
													/>
												) : (
													<span style={{ fontSize: "2rem" }}>🎁</span>
												)}
												<span
													style={{
														fontSize: "0.72rem",
														fontWeight: 600,
														color: "#fff",
														marginTop: "0.35rem",
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
														maxWidth: "100%",
													}}
												>
													{item.name}
												</span>
											</div>
										),
									)}
								</div>
							</div>
						</div>

						{/* Bot Column */}
						<div
							style={{
								backgroundColor: "rgba(0, 0, 0, 0.3)",
								border: `2px solid ${
									phase === "finished" && battleResult?.winner === "bot"
										? "#ef4444"
										: "var(--border-color, #2d3748)"
								}`,
								borderRadius: "12px",
								padding: "1rem",
								display: "flex",
								flexDirection: "column",
								position: "relative",
								transition: "border-color 0.3s ease",
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: "0.75rem",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
									}}
								>
									<span style={{ fontSize: "1.25rem" }}>
										{selectedBot.avatar}
									</span>
									<div>
										<span style={{ fontWeight: 700, color: "#f59e0b" }}>
											{selectedBot.name}
										</span>
										<span
											style={{
												fontSize: "0.75rem",
												color: "var(--text-muted, #94a3b8)",
												marginLeft: "0.4rem",
											}}
										>
											({selectedBot.title})
										</span>
									</div>
								</div>
								{phase === "finished" && battleResult && (
									<span
										style={{
											fontSize: "0.85rem",
											fontWeight: 700,
											color:
												battleResult.winner === "bot"
													? "#22c55e"
													: battleResult.winner === "player"
														? "#ef4444"
														: "#eab308",
										}}
									>
										${battleResult.botItem.valueUsd.toFixed(2)} USD
									</span>
								)}
							</div>

							{/* Bot Reel Viewport */}
							<div
								ref={botViewportRef}
								style={{
									height: "130px",
									backgroundColor: "#0f172a",
									borderRadius: "8px",
									overflow: "hidden",
									position: "relative",
									border: "1px solid rgba(255, 255, 255, 0.05)",
								}}
							>
								{/* Center marker line */}
								<div
									style={{
										position: "absolute",
										top: 0,
										bottom: 0,
										left: "50%",
										width: "3px",
										transform: "translateX(-50%)",
										backgroundColor: "#eab308",
										zIndex: 10,
										boxShadow: "0 0 10px #eab308",
										pointerEvents: "none",
									}}
								/>

								{/* Track */}
								<div
									style={{
										display: "flex",
										height: "100%",
										transform: `translateX(-${botOffset}px)`,
										transition:
											phase === "spinning" && !skip
												? `transform ${BATTLE_SPIN_DURATION_MS}ms ${SPIN_EASING}`
												: "none",
										willChange: "transform",
									}}
								>
									{(botReel.length > 0 ? botReel : pool.slice(0, 10)).map(
										(item, idx) => (
											<div
												key={`${item.id}-${idx}`}
												style={{
													width: `${DUAL_CELL_WIDTH}px`,
													marginRight: `${DUAL_CELL_GAP}px`,
													flexShrink: 0,
													height: "100%",
													display: "flex",
													flexDirection: "column",
													alignItems: "center",
													justifyContent: "center",
													padding: "0.5rem",
													borderBottom: `4px solid ${rarityColor(item.rarity)}`,
													backgroundColor:
														idx === WINNER_INDEX && phase === "finished"
															? "rgba(255, 255, 255, 0.08)"
															: "transparent",
													textAlign: "center",
												}}
											>
												{item.image ? (
													<img
														src={item.image}
														alt={item.name}
														style={{
															maxHeight: "65px",
															maxWidth: "100%",
															objectFit: "contain",
															filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))",
														}}
													/>
												) : (
													<span style={{ fontSize: "2rem" }}>🎁</span>
												)}
												<span
													style={{
														fontSize: "0.72rem",
														fontWeight: 600,
														color: "#fff",
														marginTop: "0.35rem",
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
														maxWidth: "100%",
													}}
												>
													{item.name}
												</span>
											</div>
										),
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Verdict Banner (when finished) */}
					{phase === "finished" && battleResult && (
						<div
							style={{
								marginBottom: "1.5rem",
								padding: "1.25rem",
								borderRadius: "12px",
								textAlign: "center",
								backgroundColor:
									battleResult.winner === "player"
										? "rgba(34, 197, 94, 0.12)"
										: battleResult.winner === "bot"
											? "rgba(239, 68, 68, 0.12)"
											: "rgba(234, 179, 8, 0.12)",
								border: `1px solid ${
									battleResult.winner === "player"
										? "#22c55e"
										: battleResult.winner === "bot"
											? "#ef4444"
											: "#eab308"
								}`,
							}}
						>
							<h3
								style={{
									margin: "0 0 0.5rem 0",
									fontSize: "1.5rem",
									fontWeight: 800,
									color:
										battleResult.winner === "player"
											? "#22c55e"
											: battleResult.winner === "bot"
												? "#ef4444"
												: "#eab308",
								}}
							>
								{battleResult.winner === "player"
									? "🏆 ¡VICTORIA TOTAL! GANASTE AMBAS SKINS"
									: battleResult.winner === "bot"
										? "💀 DERROTA: EL BOT SE LLEVA AMBAS SKINS"
										: "🤝 EMPATE: CADA UNO CONSERVA SU SKIN"}
							</h3>
							<p
								style={{
									margin: 0,
									fontSize: "0.9rem",
									color: "var(--text-muted, #94a3b8)",
								}}
							>
								{battleResult.winner === "player"
									? `Has vencido a ${selectedBot.name} ($${battleResult.playerItem.valueUsd.toFixed(
											2,
										)} vs $${battleResult.botItem.valueUsd.toFixed(2)}). ¡2 skins agregadas a tu inventario!`
									: battleResult.winner === "bot"
										? `${selectedBot.name} sacó una skin de mayor valor ($${battleResult.botItem.valueUsd.toFixed(
												2,
											)} vs $${battleResult.playerItem.valueUsd.toFixed(2)}). Te vas con 0 skins.`
										: `Ambos obtuvieron skins del mismo valor ($${battleResult.playerItem.valueUsd.toFixed(
												2,
											)}). Conservas tu skin en el inventario.`}
							</p>
						</div>
					)}

					{/* Controls and Bot Selector (when idle) */}
					{phase === "idle" && (
						<div>
							{/* Bot Selector */}
							<div style={{ marginBottom: "1.25rem" }}>
								<div
									role="heading"
									aria-level={4}
									style={{
										display: "block",
										fontSize: "0.875rem",
										fontWeight: 600,
										color: "var(--text-muted, #94a3b8)",
										marginBottom: "0.5rem",
									}}
								>
									Elige a tu Contendiente:
								</div>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
										gap: "0.6rem",
									}}
								>
									{BOTS.map((bot) => (
										<button
											key={bot.id}
											type="button"
											onClick={() => {
												soundFX.playClick();
												setSelectedBot(bot);
											}}
											className="btn"
											style={{
												padding: "0.75rem",
												borderRadius: "10px",
												border: `1px solid ${
													selectedBot.id === bot.id
														? "#38bdf8"
														: "var(--border-color, #2d3748)"
												}`,
												backgroundColor:
													selectedBot.id === bot.id
														? "rgba(56, 189, 248, 0.1)"
														: "rgba(0, 0, 0, 0.2)",
												textAlign: "left",
												cursor: "pointer",
												display: "flex",
												alignItems: "center",
												gap: "0.6rem",
											}}
										>
											<span style={{ fontSize: "1.5rem" }}>{bot.avatar}</span>
											<div style={{ overflow: "hidden" }}>
												<div
													style={{
														fontWeight: 700,
														fontSize: "0.85rem",
														color:
															selectedBot.id === bot.id ? "#38bdf8" : "#fff",
														whiteSpace: "nowrap",
														textOverflow: "ellipsis",
														overflow: "hidden",
													}}
												>
													{bot.name}
												</div>
												<div
													style={{
														fontSize: "0.72rem",
														color: "var(--text-muted, #94a3b8)",
														whiteSpace: "nowrap",
														textOverflow: "ellipsis",
														overflow: "hidden",
													}}
												>
													{bot.title}
												</div>
											</div>
										</button>
									))}
								</div>

								<div
									style={{
										marginTop: "0.5rem",
										padding: "0.5rem 0.75rem",
										borderRadius: "8px",
										backgroundColor: "rgba(255, 255, 255, 0.03)",
										fontSize: "0.8rem",
										fontStyle: "italic",
										color: "var(--text-muted, #94a3b8)",
									}}
								>
									"{selectedBot.personality}"
								</div>
							</div>

							{/* Battle Price Info */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "1rem",
									borderRadius: "10px",
									backgroundColor: "rgba(0, 0, 0, 0.25)",
									border: "1px solid var(--border-color, #2d3748)",
									marginBottom: "1.25rem",
								}}
							>
								<div>
									<span
										style={{
											fontSize: "0.85rem",
											color: "var(--text-muted, #94a3b8)",
										}}
									>
										Cofre seleccionado:
									</span>
									<div
										style={{ fontWeight: 700, color: "#fff", fontSize: "1rem" }}
									>
										{chest.name}
									</div>
								</div>

								<div style={{ textAlign: "right" }}>
									<span
										style={{
											fontSize: "0.85rem",
											color: "var(--text-muted, #94a3b8)",
										}}
									>
										Costo de entrada:
									</span>
									<div
										style={{
											fontWeight: 800,
											color: "#eab308",
											fontSize: "1.15rem",
										}}
									>
										{formatXp(totalCost)} XP
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Actions Bar */}
					<div
						style={{
							display: "flex",
							gap: "0.75rem",
							justifyContent: "flex-end",
						}}
					>
						{phase === "spinning" && (
							<button
								type="button"
								onClick={handleSkip}
								className="btn btn-secondary"
								style={{
									padding: "0.75rem 1.5rem",
									borderRadius: "8px",
									fontWeight: 600,
									cursor: "pointer",
								}}
							>
								Saltar Giro ⏩
							</button>
						)}

						{phase === "finished" && (
							<>
								<button
									type="button"
									onClick={onClose}
									className="btn btn-secondary"
									style={{
										padding: "0.75rem 1.5rem",
										borderRadius: "8px",
										fontWeight: 600,
										cursor: "pointer",
									}}
								>
									Cerrar
								</button>
								<button
									type="button"
									onClick={resetForRematch}
									className="btn btn-primary"
									style={{
										padding: "0.75rem 1.75rem",
										borderRadius: "8px",
										fontWeight: 700,
										cursor: "pointer",
									}}
								>
									Revancha ⚔️
								</button>
							</>
						)}

						{phase === "idle" && (
							<>
								<button
									type="button"
									onClick={onClose}
									className="btn btn-secondary"
									style={{
										padding: "0.75rem 1.5rem",
										borderRadius: "8px",
										fontWeight: 600,
										cursor: "pointer",
									}}
								>
									Cancelar
								</button>

								<button
									type="button"
									onClick={startBattle}
									disabled={!canAfford || loading}
									className="btn btn-primary"
									style={{
										padding: "0.75rem 2rem",
										borderRadius: "8px",
										fontWeight: 700,
										cursor: canAfford && !loading ? "pointer" : "not-allowed",
										opacity: canAfford && !loading ? 1 : 0.6,
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
									}}
								>
									{loading ? (
										"Iniciando..."
									) : !canAfford ? (
										`Saldo Insuficiente (${formatXp(userBalance)} XP)`
									) : (
										<>
											<span>¡Entrar a la Batalla!</span>
											<span>⚔️</span>
										</>
									)}
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
