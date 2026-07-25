// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · CHECKLISTS (Decreto 2026-07-24, itens 6D e 6E)
// Biometria/selfie/prova de vida e documento de identificação exigem observação
// HUMANA sobre o que os arquivos permitem ver. A máquina NÃO conclui fraude,
// replay, injection nem reaproveitamento sem evidência suficiente — ela apenas
// oferece o CHECKLIST (os itens a verificar) e o perito marca cada um. Puro.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoChecklist = 'BIOMETRIA' | 'DOCUMENTO_ID';

export type StatusChecklist =
  'PRESENTE' | 'AUSENTE' | 'NAO_APLICAVEL' | 'INCONSISTENTE' | 'NECESSITA_REVISAO';

export interface ItemChecklist {
  readonly item: string;
  readonly status: StatusChecklist;
  readonly observacao: string | null;
}

/** Itens da BIOMETRIA/SELFIE/PROVA DE VIDA (item 6D) — só o que os arquivos permitem. */
export const ITENS_BIOMETRIA: readonly string[] = [
  'Arquivo original ou imagem inserida em PDF',
  'Resolução',
  'Metadados da imagem',
  'Data de captura',
  'Vínculo com a sessão',
  'Vínculo criptográfico com o contrato',
  'Relatório de liveness',
  'Prova de vida ativa',
  'Prova de vida passiva',
  'Análise de profundidade',
  'Presença de marcas d’água',
  'Identificador da sessão',
  'Possível reaproveitamento de imagem',
];

/** Itens do DOCUMENTO DE IDENTIFICAÇÃO (item 6E). */
export const ITENS_DOCUMENTO_ID: readonly string[] = [
  'Presença de frente e verso',
  'Qualidade da imagem',
  'Metadados',
  'OCR',
  'Consistência entre nome, CPF, RG e data de nascimento',
  'Data da captura',
  'Vínculo com a sessão',
  'Documento já existente na base bancária',
  'Sinais observáveis de montagem',
  'Divergências entre dados',
];

/** Nota fixa (item 6D/6E) — a fronteira legal que acompanha estes checklists. */
export const NOTA_BIOMETRIA =
  'A automação não afirma fraude, replay attack, injection ou reaproveitamento sem evidência técnica suficiente. Cada item é observação sujeita à revisão do perito.';
export const NOTA_DOCUMENTO_ID =
  'A posse de um documento não se confunde com a autoria da contratação. Cada item é observação sujeita à revisão do perito.';

function itensDe(tipo: TipoChecklist): readonly string[] {
  return tipo === 'BIOMETRIA' ? ITENS_BIOMETRIA : ITENS_DOCUMENTO_ID;
}

/** Checklist em branco — todo item nasce "a revisar" (nunca uma conclusão). */
export function checklistPadrao(tipo: TipoChecklist): readonly ItemChecklist[] {
  return itensDe(tipo).map((item) => ({ item, status: 'NECESSITA_REVISAO', observacao: null }));
}

/** Normaliza um checklist informado ao conjunto de itens do tipo (ignora itens
 *  desconhecidos; completa os faltantes como "a revisar"). Nunca inventa status. */
export function normalizarChecklist(
  tipo: TipoChecklist,
  informado: readonly ItemChecklist[],
): readonly ItemChecklist[] {
  const porItem = new Map(informado.map((i) => [i.item, i]));
  return itensDe(tipo).map(
    (item) => porItem.get(item) ?? { item, status: 'NECESSITA_REVISAO', observacao: null },
  );
}
