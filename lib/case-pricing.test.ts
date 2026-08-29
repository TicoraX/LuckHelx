import { describe, it, expect } from 'vitest';
import { usdToXpUnits } from './case-pricing';

describe('usdToXpUnits', () => {
  it('maps a dollar to a whole XP', () => {
    expect(usdToXpUnits(1)).toBe(100);
    expect(usdToXpUnits(169.37)).toBe(16937);
  });

  // El motivo de la escala entera: antes esto redondeaba a XP y las 13 cajas de menos de
  // un dolar costaban todas 1 XP, con cuchillos adentro. Abrir y revender salia gratis.
  it('keeps the cents of a case that costs less than a dollar', () => {
    expect(usdToXpUnits(0.3)).toBe(30);
    expect(usdToXpUnits(0.39)).toBe(39);
    expect(usdToXpUnits(0.03)).toBe(3);
  });

  it('floors at one unit so nothing is ever free', () => {
    // Cero es un precio valido (muy barato), no un fallo: baja al piso, no al fallback.
    expect(usdToXpUnits(0)).toBe(1);
    expect(usdToXpUnits(0.001)).toBe(1);
  });

  it('falls back when there is no usable price', () => {
    expect(usdToXpUnits(null)).toBe(5000);
    expect(usdToXpUnits(undefined)).toBe(5000);
    expect(usdToXpUnits(NaN)).toBe(5000);
    expect(usdToXpUnits(-5)).toBe(5000);
  });

  it('takes a custom fallback in whole XP', () => {
    expect(usdToXpUnits(null, 75)).toBe(7500);
  });

  it('always returns an integer, which is what the column stores', () => {
    for (const usd of [0.005, 1.234, 99.999, 0.1 + 0.2]) {
      expect(Number.isInteger(usdToXpUnits(usd))).toBe(true);
    }
  });
});
