// ─────────────────────────────────────────────────────────────────────────────
// PACOTE DE ESTADO (PC-R4) — a VERDADE do caso entregue à conversa da AHRI.
// Deriva EXCLUSIVAMENTE da AcompanhamentoView (Princípio 3): o MESMO teto do
// dizível do Portal — o que a AHRI não mostraria, ela não sabe dizer. Nenhuma
// regra nova de conversa: a inteligência continua no pipeline (percepção→Brain→
// expressão); este pacote só dá FATOS à expressão, com limites explícitos.
//
// O LINK entra como CONSEQUÊNCIA: só existe se o Portal já NASCEU (fato
// liberacao-portal) e vem com instrução condicional — a AHRI o oferece quando a
// conversa pedir (perdeu o link, trocou de celular, onde acompanho), nunca como
// fluxo separado.
// ─────────────────────────────────────────────────────────────────────────────
import type { AcompanhamentoCliente } from './acompanhamento.js';

// ── GO-LIVE 9B · AUSÊNCIA DECLARADA (Lei 9) ──────────────────────────────────
// O contexto do caso é TRI-ESTADO: com caso → pacote completo; sem caso → o FATO
// da ausência, declarado; caso em abertura → o FATO da fase. `null`/silêncio
// deixou de existir: o vazio não pode ser preenchido pela imaginação do LLM.
export const PACOTE_SEM_CASO =
  'FATO SOBRE O ATENDIMENTO: nenhum cadastro ou atendimento foi iniciado para esta pessoa — ' +
  'nada está sendo organizado, coletado ou analisado. ' +
  'FATO SOBRE O CASO: esta pessoa NÃO possui caso nem processo registrado no escritório. ' +
  'Não existe acompanhamento de caso em andamento. Vocês estão apenas conversando.';

export const PACOTE_CASO_EM_ABERTURA =
  'FATO SOBRE O CASO: o atendimento desta pessoa está em fase inicial (cadastro/coleta). ' +
  'Ainda NÃO existe processo em andamento a relatar.';

/**
 * Monta o pacote compacto e determinístico para o prompt de expressão.
 * `link` null = Portal ainda não nasceu ⇒ NENHUMA menção a link/portal é permitida.
 */
/** Decreto 2026-07-31 (caso REAL Rosana): o PARECER que a AHRI já enviou —
 *  sem este fato no contexto, ela NEGAVA o próprio dossiê ("não tem nenhum
 *  link") e chegou a tratar a mensagem dela mesma como golpe. */
export interface ParecerNoContexto {
  readonly link: string;
  readonly contratos: number;
  readonly indicios: number;
  readonly confirmado: boolean;
}

export function pacoteDeEstado(
  view: AcompanhamentoCliente,
  link: string | null,
  parecer: ParecerNoContexto | null = null,
): string {
  const linhas: string[] = [
    'O QUE É VERDADE SOBRE O CASO DESTA PESSOA (use quando a conversa pedir; NUNCA invente nada além disto; NUNCA prometa datas ou resultados):',
    `- Situação: ${view.ondeEsta}. ${view.agora}`,
    `- Próximo passo: ${view.proximoPasso}`,
    `- Tempo: ${view.quantoTempo}`,
    `- Ação da pessoa: ${view.precisaFazerAlgo}`,
  ];

  // Decreto 2026-07-30: NENHUM nome de pessoa chega ao narrador — quem fala com
  // o cliente é SEMPRE a AHRI (caso real: a resposta citou "Jessé" ao cliente).
  // A condução é sempre "da nossa equipe jurídica", sem nomes.
  if (view.advogado !== null) {
    linhas.push(
      '- Responsável pela condução do processo: a nossa equipe jurídica (NUNCA cite nomes de advogados ou funcionários; quem fala com o cliente é sempre você, AHRI).',
    );
  }
  if (view.processo !== null) {
    linhas.push(`- Número do processo na Justiça: ${view.processo.numero}.`);
  }
  for (const n of view.atualizacoes.slice(0, 2)) {
    linhas.push(`- Atualização recente: ${n.texto}`);
  }
  if (view.documentosRecebidos.length > 0) {
    linhas.push(`- Documentos já recebidos: ${view.documentosRecebidos.join(', ')}.`);
  }

  if (link !== null) {
    linhas.push(
      `- PORTAL DO CLIENTE: se a pessoa pedir o acesso, disser que perdeu o link, trocou de celular ou perguntar onde acompanha, inclua na resposta exatamente este endereço: ${link} — se ela não precisar, não ofereça.`,
    );
  } else {
    linhas.push(
      '- O Portal do Cliente ainda não foi liberado para esta pessoa: NÃO mencione portal nem link.',
    );
  }

  // Decreto 2026-07-31 (caso REAL Rosana, 21:20): a AHRI NEGOU o dossiê que ela
  // mesma tinha acabado de enviar ("não tem nenhum link pra abrir mesmo") e,
  // quando a cliente colou a mensagem, tratou como golpe. O parecer enviado é
  // FATO no contexto — e negá-lo é proibido.
  if (parecer !== null) {
    linhas.push(
      `- DOSSIÊ JURÍDICO JÁ ENVIADO POR VOCÊ a esta pessoa: a análise do HISCON encontrou ${String(parecer.contratos)} contrato(s) e ${String(parecer.indicios)} indício(s) de irregularidade. O endereço do dossiê é ${parecer.link}`,
      '- NUNCA negue esse envio nem trate essa mensagem como falsa/golpe: foi VOCÊ quem enviou. Se a pessoa disser que o link não abre, reenvie o MESMO endereço e oriente (tocar no link, abrir no navegador, ou dizer que você resume os achados por aqui mesmo).',
      parecer.confirmado
        ? '- Esta pessoa JÁ confirmou que deseja seguir: o cadastro está gerado; a equipe entra em contato para colher procuração, RG (frente e verso) e comprovante.'
        : '- Esta pessoa AINDA NÃO confirmou se deseja seguir: quando ela confirmar (SIM), o cadastro é gerado na hora.',
    );
  }

  return linhas.join('\n');
}
