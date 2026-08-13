// ─────────────────────────────────────────────────────────────────────────────
// RELEMBRAR O CASO (pedido do dono, 2026-08-13) — "algumas pessoas que passaram
// pela fase 1 estão se esquecendo do que se trata".
//
// É o que acontece quando dias separam a análise da coleta: a pessoa mandou o
// HISCON, recebeu o resultado, disse SIM — e quando a secretária escreve, já não
// liga uma coisa à outra. Aí ela desconfia, pergunta se é golpe, ou some.
//
// Este texto recoloca a pessoa na história em quatro linhas: o que ela mandou, o
// que a análise achou, que ELA autorizou seguir e qual é o passo de agora. Nada
// aqui é template da Meta: a secretária só usa quando o cliente acabou de
// escrever, então a janela de 24h está aberta e vai como mensagem comum.
//
// Duas disciplinas: nenhum número inventado (contratos e indícios vêm do parecer
// que a própria pessoa recebeu) e nenhuma promessa de resultado — o que se
// promete é o passo seguinte, não o ganho.
// ─────────────────────────────────────────────────────────────────────────────
import { cobrancaDocumental, type DocsDaFase2 } from './cobranca-documental.js';

export interface CasoParaRelembrar {
  readonly nome: string;
  /** Contratos encontrados na janela de 5 anos (do parecer enviado). */
  readonly contratos: number;
  /** Indícios de irregularidade apontados na análise. */
  readonly indicios: number;
  /** Quando a pessoa confirmou o interesse (ISO) — é o "você autorizou". */
  readonly confirmadoEm: string | null;
  readonly docs: DocsDaFase2;
}

/** Primeiro nome com capitalização humana ("MARIA DAS DORES" → "Maria"). */
function primeiroNome(nome: string): string {
  const bruto = nome.trim().split(/\s+/)[0] ?? '';
  if (bruto === '') return '';
  return bruto.charAt(0).toUpperCase() + bruto.slice(1).toLowerCase();
}

function emDiaMes(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** O texto que recoloca a pessoa na história do próprio caso. */
export function relembrarOCaso(caso: CasoParaRelembrar): string {
  const nome = primeiroNome(caso.nome);
  const cobranca = cobrancaDocumental(caso.docs);
  const quando = emDiaMes(caso.confirmadoEm);

  // O ACHADO só entra se existir de fato. Sem contratos lidos, a frase vira a
  // verdade menor ("analisamos o seu extrato") — nunca um número inventado.
  const achado =
    caso.contratos > 0
      ? `Analisamos e encontramos ${String(caso.contratos)} contrato(s) de consignado no seu benefício` +
        (caso.indicios > 0
          ? `, sendo ${String(caso.indicios)} com indício de irregularidade.`
          : '.')
      : 'Analisamos o seu extrato e te enviamos o resultado por aqui.';

  const autorizou =
    quando !== null
      ? `No dia ${quando} você confirmou por aqui que queria seguir com a ação — é por isso que estamos em contato.`
      : 'Você confirmou por aqui que queria seguir com a ação — é por isso que estamos em contato.';

  const passo = cobranca.completo
    ? 'A sua documentação já está completa conosco: o seu caso está com o advogado responsável e a gente te avisa a cada novidade.'
    : `Agora estamos na etapa dos documentos. Falta ${cobranca.lista} — pode enviar por aqui mesmo, nesta conversa.`;

  return [
    `${nome !== '' ? `Oi, ${nome}!` : 'Oi!'} Aqui é a Layara, do Projeto Reconstrua. Deixa eu te relembrar em que ponto estamos, para você não ficar em dúvida.`,
    '',
    `Você nos enviou o seu extrato de empréstimos consignados do INSS (o HISCON). ${achado} ${autorizou}`,
    '',
    passo,
    '',
    'Continua sem custo nenhum para você: os honorários do advogado só existem no final e apenas se houver êxito. Qualquer dúvida, é só me chamar por aqui.',
  ].join('\n');
}
