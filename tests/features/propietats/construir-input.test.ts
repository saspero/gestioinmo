import { describe, expect, it } from 'vitest';
import { construirInput } from '@/features/propietats/components/propietat-form';

const valors = {
  referencia: 'P-1',
  tipus: 'parking' as const,
  adreca: 'Major 1',
  poblacio: '',
  cp: '08001',
  referenciaCadastral: '',
  superficie: '12',
  habitacions: '3',
  banys: '',
  ascensor: true,
  certEnergetic: '',
  numeroPlaca: '4',
  planta: '',
  numPisos: '',
  superficieEdificable: '',
  tipusSol: '',
  notes: '',
};

describe('construirInput', () => {
  it('en una alta no envia els camps buits ni els que el tipus no té', () => {
    const input = construirInput(valors, false);
    expect(input).toMatchObject({ tipus: 'parking', cp: '08001', superficie: 12, numeroPlaca: '4', ascensor: false });
    expect(input.poblacio).toBeUndefined();
    expect(input.habitacions).toBeUndefined();
  });

  it('en una edició envia null per esborrar els camps buits i els que el tipus no té', () => {
    const input = construirInput(valors, true);
    expect(input).toMatchObject({
      superficie: 12,
      numeroPlaca: '4',
      poblacio: null,
      planta: null,
      habitacions: null,
      tipusSol: null,
      ascensor: false,
    });
  });
});
