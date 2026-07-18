// ─────────────────────────────────────────────────────────────────────────────
// DEMONSTRAÇÃO (PC-R2 — validação da EXPERIÊNCIA): payloads mockados com a MESMA
// forma da projeção real, ativos SOMENTE em desenvolvimento (?demo). Nunca em
// produção; nunca uma funcionalidade — é o palco da homologação da carta.
// ─────────────────────────────────────────────────────────────────────────────
import type { AcompanhamentoCliente } from './api';

const AGORA = Date.now();
const dia = 24 * 60 * 60 * 1000;

/** Fase de ANÁLISE (pulso sereno, estimativa correndo, sem advogado ainda). */
export const DEMO_ANALISE: AcompanhamentoCliente = {
  clienteId: 'demo-analise',
  quem: 'Maria',
  presenca: 'serena',
  fraseAbertura: 'Seu caso está em análise técnica — e eu estou acompanhando cada passo.',
  ondeEsta: 'Análise técnica',
  agora: 'Já enviamos as solicitações administrativas do seu caso e estou acompanhando as respostas.',
  proximoPasso: 'Com as respostas em mãos, definimos os próximos passos — e eu te aviso por aqui e pelo WhatsApp.',
  precisaFazerAlgo: 'Nada por enquanto — estou cuidando de tudo. Se eu precisar de algo, falo com você no WhatsApp.',
  quantoTempo: 'Essa fase costuma levar aproximadamente 12 dias. A previsão é até 27 de julho.',
  etapas: [
    { titulo: 'Documentação', situacao: 'concluida' },
    { titulo: 'Análise técnica', situacao: 'atual' },
    { titulo: 'Processo', situacao: 'futura' },
    { titulo: 'Conclusão', situacao: 'futura' },
  ],
  estimativaDias: 12,
  estimativaAte: new Date(AGORA + 9 * dia).toISOString(),
  advogado: null,
  processo: null,
  atualizacoes: [],
  documentosRecebidos: ['Documento de identidade', 'Comprovante de residência', 'Extrato do INSS'],
  whatsapp: '554137989737',
};

/** Fase de PROCESSO (pulso atento, advogado, número e novidades). */
export const DEMO_PROCESSO: AcompanhamentoCliente = {
  ...DEMO_ANALISE,
  clienteId: 'demo-processo',
  presenca: 'atenta',
  fraseAbertura: 'Seu processo está em andamento — e eu acompanho cada movimentação.',
  ondeEsta: 'Processo em andamento',
  agora: 'Quem está conduzindo o seu processo é Ana Lima.',
  proximoPasso: 'Cada movimentação importante aparece aqui — e eu também aviso você no WhatsApp.',
  quantoTempo: 'Cada processo tem o seu próprio ritmo — mas você não precisa vigiar prazos: eu acompanho tudo e te aviso a cada novidade.',
  etapas: [
    { titulo: 'Documentação', situacao: 'concluida' },
    { titulo: 'Análise técnica', situacao: 'concluida' },
    { titulo: 'Processo', situacao: 'atual' },
    { titulo: 'Conclusão', situacao: 'futura' },
  ],
  estimativaAte: null,
  advogado: { nome: 'Ana Lima' },
  processo: { numero: '0001234-55.2026.4.04.7000' },
  atualizacoes: [
    { quando: new Date(AGORA - 2 * 60 * 60 * 1000).toISOString(), texto: 'O seu processo foi distribuído para a 2ª Vara Federal — agora é oficial: a Justiça já está cuidando do seu caso.' },
    { quando: new Date(AGORA - 1 * dia).toISOString(), texto: 'Protocolamos a petição inicial do seu processo. Está tudo encaminhado.' },
  ],
};

export function demoPayload(qual: string | undefined): AcompanhamentoCliente {
  return qual === 'processo' ? DEMO_PROCESSO : DEMO_ANALISE;
}
