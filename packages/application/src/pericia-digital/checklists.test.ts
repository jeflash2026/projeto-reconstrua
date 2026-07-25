import { describe, it, expect } from 'vitest';
import {
  ITENS_BIOMETRIA,
  ITENS_DOCUMENTO_ID,
  checklistPadrao,
  normalizarChecklist,
} from './checklists.js';

describe('Checklists 6D/6E — o perito preenche; a máquina não conclui', () => {
  it('checklist em branco nasce todo "a revisar" (nunca uma conclusão)', () => {
    const c = checklistPadrao('BIOMETRIA');
    expect(c).toHaveLength(ITENS_BIOMETRIA.length);
    expect(c.every((i) => i.status === 'NECESSITA_REVISAO')).toBe(true);
  });
  it('normaliza ao conjunto do tipo: aproveita o informado, completa o resto', () => {
    const informado = [{ item: 'OCR', status: 'PRESENTE' as const, observacao: 'legível' }];
    const c = normalizarChecklist('DOCUMENTO_ID', informado);
    expect(c).toHaveLength(ITENS_DOCUMENTO_ID.length);
    expect(c.find((i) => i.item === 'OCR')?.status).toBe('PRESENTE');
    // Itens não informados seguem "a revisar" (não inventa status).
    expect(c.find((i) => i.item === 'Qualidade da imagem')?.status).toBe('NECESSITA_REVISAO');
  });
  it('ignora item desconhecido (não vaza para o checklist)', () => {
    const c = normalizarChecklist('BIOMETRIA', [
      { item: 'ITEM INEXISTENTE', status: 'PRESENTE', observacao: null },
    ]);
    expect(c.some((i) => i.item === 'ITEM INEXISTENTE')).toBe(false);
  });
});
