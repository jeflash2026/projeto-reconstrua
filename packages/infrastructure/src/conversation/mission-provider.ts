// ─────────────────────────────────────────────────────────────────────────────
// MISSAO PROVIDER (GO-LIVE 15A · Decreto "Jornada Documental Inicial") — deriva
// o ESTADO da conversa a partir da MISSÃO ATIVA do Mission Runtime (fonte
// PRIMÁRIA), tendo o status do cliente e a CONTABILIDADE da Jornada 1 como
// sinais. Prioridade: Mission Runtime → Estado → Política → PromptBuilder.
//
// Jornada 1 (decreto): enquanto QUALQUER documento obrigatório (HISCON, RG/CNH,
// comprovante de endereço) estiver pendente ⇒ ONBOARDING_DOCUMENTAL; com 100%
// ⇒ ANALISE_ADMINISTRATIVA — automático, derivado da contabilidade canônica
// (nunca inferido da conversa). Contabilidade ausente/falha ⇒ NÃO completa
// (fail-closed: continuar coletando é o modo de falha seguro do decreto).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import {
  derivarMissaoDaConversa,
  type ClientesList,
  type MissaoProvider,
  type MissionSnapshotPort,
} from '@reconstrua/application';

export interface OnboardingCompletude {
  /** true ⇔ os 3 documentos iniciais estão 100% (contabilidade da Jornada 1). */
  estaCompleto(chatId: string): Promise<boolean>;
}

export function criarMissaoProvider(
  snapshots: MissionSnapshotPort,
  clientes: ClientesList,
  clock: Clock,
  onboarding: OnboardingCompletude | null = null,
): MissaoProvider {
  return async (chatId) => {
    const [snapshot, lista, documentacaoInicialCompleta] = await Promise.all([
      snapshots.load(chatId).catch(() => null), // MISSÃO ATIVA (Mission Runtime) — primário
      clientes.list(clock.now()).catch(() => []),
      onboarding !== null
        ? onboarding.estaCompleto(chatId).catch(() => false)
        : Promise.resolve(false),
    ]);
    const cliente = lista.find((c) => c.chatId === chatId);

    // Sem missão ativa E sem cliente reconhecido ⇒ novo contato ⇒ LEAD (default).
    if (snapshot === null && cliente === undefined) return null;

    return derivarMissaoDaConversa({
      // FONTE PRIMÁRIA: a missão ativa do Mission Runtime.
      missaoAtiva: snapshot?.caseExists === true || cliente?.missionId != null,
      processoEncerrado: snapshot?.stateCode === 'ENCERRADA' || cliente?.status === 'ENCERRADO',
      // UM DOS SINAIS: o status canônico do cliente (VENDA registrada).
      vendaRegistrada: cliente?.status === 'VENDIDO',
      // Jornada 1 — a contabilidade canônica decide onboarding × análise.
      documentacaoInicialCompleta,
    });
  };
}
