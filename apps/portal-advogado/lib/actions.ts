'use server';
// Server Actions (BL-3.2): a ESCRITA do advogado (registrar atividade jurídica) roda
// no SERVIDOR do Next — onde o segredo (ADVOGADO_API_TOKEN) e a rede da API interna
// existem, e a identidade (x-advogado-id) é lida server-side via cookies(). O browser
// nunca fala direto com a API nem vê o segredo. Reutiliza `lib/api` (BL-3.1) sem
// alterar a autenticação, o isolamento por atribuição, nem a persistência.
import { sendJson } from './api';

export interface AhriDecision {
  informed: boolean;
  decidedToSpeak: boolean;
  ruleRefs: string[];
}

export interface ActivityResult {
  ahri: AhriDecision;
}

export async function registerActivity(
  missionId: string,
  kind: string,
  text: string,
  dueAt: string | null,
): Promise<ActivityResult | null> {
  return sendJson<ActivityResult>('POST', `/advogado/processos/${missionId}/atividades`, {
    kind,
    text,
    ...(dueAt !== null ? { dueAt } : {}),
  });
}
