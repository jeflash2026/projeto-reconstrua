// ─────────────────────────────────────────────────────────────────────────────
// MISSAO PROVIDER (GO-LIVE 15A) — deriva o ESTADO da conversa a partir da MISSÃO
// ATIVA do Mission Runtime (fonte PRIMÁRIA), tendo o status do cliente como
// apenas UM dos sinais. Prioridade: Mission Runtime → Estado → Política →
// PromptBuilder. Assim a conversa segue sempre a missão atual, mesmo que existam
// dezenas de jornadas diferentes.
//
// Concentra TODA a derivação: lê o snapshot da missão (caseExists/stateCode) e o
// status canônico do cliente (VENDIDO) e chama a derivação pura
// `derivarMissaoDaConversa`. O ConversationContextRuntime NÃO conhece regra de
// negócio — apenas pede o estado. Sem missão nem cliente reconhecido ⇒ LEAD.
// Nenhuma nova consulta duplicada, nenhuma tabela nova.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import { derivarMissaoDaConversa, type ClientesList, type MissaoProvider, type MissionSnapshotPort } from '@reconstrua/application';

export function criarMissaoProvider(snapshots: MissionSnapshotPort, clientes: ClientesList, clock: Clock): MissaoProvider {
  return async (chatId) => {
    const [snapshot, lista] = await Promise.all([
      snapshots.load(chatId).catch(() => null), // MISSÃO ATIVA (Mission Runtime) — primário
      clientes.list(clock.now()).catch(() => []),
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
    });
  };
}
