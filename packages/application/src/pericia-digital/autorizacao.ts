// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · RBAC POR PAPEL (Decreto 2026-07-24, Fase 5)
// A fonte da verdade de QUEM pode fazer O QUÊ. Puro e fail-closed: papel
// desconhecido ⇒ nega tudo; ação fora da matriz ⇒ nega. A EMISSÃO em si segue
// pelo portão único da revisão (podeEmitir) — este módulo governa apenas o
// ACESSO às operações, não relaxa nenhuma trava legal.
//
// Fronteira honesta: aprovar/assinar exigem o papel do PERITO (ou o administrador
// que opera o painel registrando o perito responsável nomeado — validado à parte
// por validarAprovacaoPerito). Advogado/auditor/assistente/visualizador são
// papéis RESTRITOS: leem (conforme o caso) e nunca mutam nem concluem.
// ─────────────────────────────────────────────────────────────────────────────

/** Papéis reconhecidos pela Central. 'assistente'/'auditor'/'visualizador' são
 *  papéis de perícia sem equivalente direto no diretório operacional. */
export type PapelPericia =
  'administrador' | 'perito' | 'advogado' | 'assistente' | 'auditor' | 'visualizador';

export const PAPEIS_PERICIA: readonly PapelPericia[] = [
  'administrador',
  'perito',
  'advogado',
  'assistente',
  'auditor',
  'visualizador',
];

/** Cada operação sensível da Central é uma ação nomeada da matriz. */
export type AcaoPericia =
  | 'ler' // ver o caso (sujeito ao mascaramento LGPD por papel)
  | 'listar' // ver a fila de casos
  | 'criar' // abrir caso a partir do HISCON
  | 'registrar_documento' // anexar documento (original imutável)
  | 'registrar_valores' // informar valores do banco
  | 'registrar_checklist' // preencher checklist 6D/6E
  | 'iniciar_analise'
  | 'gerar_minuta'
  | 'submeter_revisao'
  | 'aprovar' // ato do PERITO responsável
  | 'assinar' // ato do PERITO responsável
  | 'liberar' // liberar ao advogado
  | 'ver_custodia' // trilha de custódia
  | 'exportar'; // exportar minuta/dossiê

/** Matriz papel → ações permitidas. Fonte única da verdade do RBAC. */
export const MATRIZ_PERICIA: Readonly<Record<PapelPericia, readonly AcaoPericia[]>> = {
  // Orquestra o ciclo; NÃO aprova/assina como perito (isso é ato pessoal do
  // perito nomeado — o painel do administrador registra a aprovação do perito,
  // validada por validarAprovacaoPerito, mas a matriz mantém a fronteira clara).
  administrador: [
    'ler',
    'listar',
    'criar',
    'registrar_documento',
    'registrar_valores',
    'registrar_checklist',
    'iniciar_analise',
    'gerar_minuta',
    'submeter_revisao',
    'liberar',
    'ver_custodia',
    'exportar',
  ],
  // O perito é o único que APROVA e ASSINA. Também conduz a análise técnica.
  perito: [
    'ler',
    'listar',
    'registrar_documento',
    'registrar_valores',
    'registrar_checklist',
    'iniciar_analise',
    'gerar_minuta',
    'submeter_revisao',
    'aprovar',
    'assinar',
    'ver_custodia',
    'exportar',
  ],
  // Recebe o caso LIBERADO; lê e exporta. Nunca muta a análise nem aprova.
  advogado: ['ler', 'listar', 'exportar'],
  // Apoio operacional: anexa documentos e lê. Nunca aprova/assina/libera.
  assistente: ['ler', 'listar', 'registrar_documento'],
  // Fiscaliza: lê tudo e a trilha de custódia; nunca muta.
  auditor: ['ler', 'listar', 'ver_custodia', 'exportar'],
  // Somente leitura (sempre mascarada por LGPD).
  visualizador: ['ler', 'listar'],
};

function ehPapel(valor: string): valor is PapelPericia {
  return (PAPEIS_PERICIA as readonly string[]).includes(valor);
}

/** Normaliza um papel bruto (header/sessão) para PapelPericia, ou null se
 *  desconhecido. Fail-closed: nunca "adivinha" um papel. */
export function papelPericia(bruto: string | null | undefined): PapelPericia | null {
  if (bruto == null) return null;
  const v = bruto.trim().toLowerCase();
  return ehPapel(v) ? v : null;
}

/** Mapeia o papel do diretório operacional (HumanRole) para o papel de perícia.
 *  operador → assistente; supervisor → auditor. Fail-open apenas para papéis
 *  conhecidos do diretório; qualquer outro vira null (negado). */
export function papelDeHumanRole(
  role: 'perito' | 'advogado' | 'operador' | 'supervisor' | 'administrador' | string,
): PapelPericia | null {
  switch (role) {
    case 'administrador':
      return 'administrador';
    case 'perito':
      return 'perito';
    case 'advogado':
      return 'advogado';
    case 'operador':
      return 'assistente';
    case 'supervisor':
      return 'auditor';
    default:
      return null;
  }
}

/** O papel pode executar a ação? Fail-closed: papel null/desconhecido ⇒ false. */
export function podePapel(papel: PapelPericia | null, acao: AcaoPericia): boolean {
  if (papel === null) return false;
  return MATRIZ_PERICIA[papel].includes(acao);
}

/** Versão que aceita o papel bruto (header/sessão). Desconhecido ⇒ false. */
export function podePapelBruto(bruto: string | null | undefined, acao: AcaoPericia): boolean {
  return podePapel(papelPericia(bruto), acao);
}
