import { describe, expect, it } from 'vitest';
import { formatMultiplier, formatUsdCents } from './upgrade-math';

describe('formato del Upgrade', () => {
  it('formatUsdCents usa coma decimal, punto de miles y centavos exactos', () => {
    expect(formatUsdCents(0)).toBe('0,00');
    expect(formatUsdCents(5)).toBe('0,05');
    expect(formatUsdCents(1432)).toBe('14,32');
    expect(formatUsdCents(175000)).toBe('1.750,00');
    expect(formatUsdCents(123456789)).toBe('1.234.567,89');
  });

  it('formatMultiplier redondea a un decimal con coma', () => {
    expect(formatMultiplier(2)).toBe('2');
    expect(formatMultiplier(1.5)).toBe('1,5');
    expect(formatMultiplier(4.0999)).toBe('4,1');
  });
});
