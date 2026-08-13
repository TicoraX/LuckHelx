import { XP_SCALE } from './xp';

/**
 * Precio de mercado en USD → costo en unidades de XP (centésimas, ver lib/xp.ts).
 *
 * US$1 vale 1 XP, así que una unidad es exactamente un centavo: el precio entra tal cual,
 * sin perder los decimales. Antes esto redondeaba a XP entero y las 13 cajas de menos de
 * un dólar terminaban todas costando 1 XP, que es de donde salía que abrir y revender
 * fuera gratis.
 *
 * `csgo/build-cases.js` tiene una copia de esta función porque es un script `.js` suelto
 * y hacerlo importar un `.ts` lo ataría al despojo de tipos de Node. Las dos tienen que
 * decir lo mismo: el preset se genera allá y se siembra con estos números.
 */
export function usdToXpUnits(usd: number | null | undefined, fallbackXp = 50): number {
  if (usd === null || usd === undefined || !Number.isFinite(usd) || usd < 0) {
    return Math.round(fallbackXp * XP_SCALE);
  }
  // Piso de una unidad: una caja gratis rompería el CHECK `xp_cost > 0` y además dejaría
  // de costar nada abrirla.
  return Math.max(1, Math.round(usd * XP_SCALE));
}
