import { describe, expect, it } from 'vitest';
import {
  CS2_GRADES,
  getCs2Color,
  getCs2Grade,
  getGradeById,
  getNextGrade,
  isTradeUpEligible,
  TRADE_UP_INPUT_GRADES,
  type Cs2GradeId,
} from './cs2-grade';

describe('lib/cs2-grade', () => {
  describe('getCs2Grade', () => {
    it('deduce Consumer Grade desde #b0c3d9', () => {
      const grade = getCs2Grade('#b0c3d9');
      expect(grade.id).toBe('consumer');
      expect(grade.name).toBe('Consumer Grade');
      expect(grade.hex).toBe('#b0c3d9');
      expect(grade.canTradeUp).toBe(true);
    });

    it('deduce Industrial Grade desde #5e98d9', () => {
      const grade = getCs2Grade('#5e98d9');
      expect(grade.id).toBe('industrial');
      expect(grade.name).toBe('Industrial Grade');
      expect(grade.canTradeUp).toBe(true);
    });

    it('deduce Mil-Spec Grade desde #4b69ff', () => {
      const grade = getCs2Grade('#4b69ff');
      expect(grade.id).toBe('milspec');
      expect(grade.name).toBe('Mil-Spec Grade');
      expect(grade.canTradeUp).toBe(true);
    });

    it('deduce Restricted desde #8847ff', () => {
      const grade = getCs2Grade('#8847ff');
      expect(grade.id).toBe('restricted');
      expect(grade.name).toBe('Restricted');
      expect(grade.canTradeUp).toBe(true);
    });

    it('deduce Classified desde #d32ce6', () => {
      const grade = getCs2Grade('#d32ce6');
      expect(grade.id).toBe('classified');
      expect(grade.name).toBe('Classified');
      expect(grade.canTradeUp).toBe(true);
    });

    it('deduce Covert desde #eb4b4b cuando no es legendary', () => {
      const grade = getCs2Grade('#eb4b4b', false);
      expect(grade.id).toBe('covert');
      expect(grade.name).toBe('Covert');
      expect(grade.hex).toBe('#eb4b4b');
      expect(grade.canTradeUp).toBe(false);
    });

    it('deduce Extraordinary (Cuchillo/Guante) desde #eb4b4b cuando es legendary', () => {
      const grade = getCs2Grade('#eb4b4b', true);
      expect(grade.id).toBe('extraordinary');
      expect(grade.name).toBe('Extraordinary');
      expect(grade.hex).toBe('#ffd700');
      expect(grade.canTradeUp).toBe(false);
    });

    it('deduce Extraordinary desde #ffd700 o #e4ae39', () => {
      expect(getCs2Grade('#ffd700').id).toBe('extraordinary');
      expect(getCs2Grade('#e4ae39').id).toBe('extraordinary');
    });

    it('soporta pasar un objeto con rarity_color y rarity', () => {
      const itemCovert = { rarity_color: '#eb4b4b', rarity: 'epic' };
      expect(getCs2Grade(itemCovert).id).toBe('covert');

      const itemKnife = { rarity_color: '#eb4b4b', rarity: 'legendary' };
      expect(getCs2Grade(itemKnife).id).toBe('extraordinary');

      const itemCamelCase = { rarityColor: '#d32ce6' };
      expect(getCs2Grade(itemCamelCase).id).toBe('classified');
    });

    it('maneja mayusculas, espacios y fallback seguro', () => {
      expect(getCs2Grade('  #B0C3D9  ').id).toBe('consumer');
      expect(getCs2Grade('unknown-color').id).toBe('milspec');
      expect(getCs2Grade(null).id).toBe('milspec');
      expect(getCs2Grade(null, true).id).toBe('extraordinary');
    });

    it('aplica fallback inteligente a partir de rareza legacy cuando no hay hex', () => {
      expect(getCs2Grade({ rarity: 'epic' }).id).toBe('classified');
      expect(getCs2Grade({ rarity: 'rare' }).id).toBe('restricted');
      expect(getCs2Grade({ rarity: 'common' }).id).toBe('milspec');
      expect(getCs2Grade({ rarity: 'legendary' }).id).toBe('extraordinary');
    });

    it('getCs2Color retorna hex oficial del grado', () => {
      const item = { rarityColor: '#8847ff' };
      expect(getCs2Color(item)).toBe('#8847ff');
    });
  });

  describe('jerarquía de contrato Trade-Up (getNextGrade)', () => {
    it('sigue la escalera oficial de Consumer hasta Covert', () => {
      expect(getNextGrade('consumer')?.id).toBe('industrial');
      expect(getNextGrade('industrial')?.id).toBe('milspec');
      expect(getNextGrade('milspec')?.id).toBe('restricted');
      expect(getNextGrade('restricted')?.id).toBe('classified');
      expect(getNextGrade('classified')?.id).toBe('covert');
    });

    it('Covert y Extraordinary no tienen grado superior en el contrato de 10', () => {
      expect(getNextGrade('covert')).toBeNull();
      expect(getNextGrade('extraordinary')).toBeNull();
    });
  });

  describe('isTradeUpEligible y TRADE_UP_INPUT_GRADES', () => {
    it('solo permite como entrada Consumer, Industrial, Mil-Spec, Restricted y Classified', () => {
      const eligible: Cs2GradeId[] = ['consumer', 'industrial', 'milspec', 'restricted', 'classified'];
      for (const id of eligible) {
        expect(isTradeUpEligible(id)).toBe(true);
      }

      expect(isTradeUpEligible('covert')).toBe(false);
      expect(isTradeUpEligible('extraordinary')).toBe(false);
      expect(TRADE_UP_INPUT_GRADES).toEqual(eligible);
    });
  });

  describe('getGradeById', () => {
    it('contiene los 7 grados oficiales', () => {
      expect(Object.keys(CS2_GRADES)).toHaveLength(7);
    });

    it('retorna la informacion correcta por id', () => {
      const info = getGradeById('classified');
      expect(info.id).toBe('classified');
      expect(info.hex).toBe('#d32ce6');
      expect(info.cssVar).toBe('--grade-classified');
    });

    it('lanza error para id invalido', () => {
      // @ts-expect-error probando id invalido
      expect(() => getGradeById('invalid')).toThrow();
    });
  });
});
