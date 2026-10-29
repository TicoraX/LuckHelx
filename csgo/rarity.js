// Grado de CS2 -> tier interno de lib/rewards.ts. Los nombres cambian segun el tipo de objeto:
// armas (Consumer, Industrial, Mil-Spec, Restricted, Classified, Covert) y stickers, parches y
// graffitis (High Grade, Remarkable, Exotic, Extraordinary). El color es el mismo en las dos
// escalas: azul, morado, rosa, rojo.
//
// Antes el default caia a 'common' en silencio, y las capsulas de stickers quedaron con los
// morados y rosas en el tier comun, saliendo con su probabilidad. Un grado nuevo tiene que
// fallar aca, no colarse.
const TIER_BY_GRADE = {
  'Consumer Grade': 'common',
  'Industrial Grade': 'common',
  'Mil-Spec Grade': 'common',
  'High Grade': 'common',
  Restricted: 'rare',
  Remarkable: 'rare',
  Classified: 'epic',
  Exotic: 'epic',
  Covert: 'epic',
  Extraordinary: 'epic',
};

export function rarityCategory(rarityName, isRare) {
  if (isRare) return 'legendary';
  const tier = TIER_BY_GRADE[rarityName];
  if (!tier) throw new Error(`grado de CS2 desconocido en el preset: ${rarityName}`);
  return tier;
}
