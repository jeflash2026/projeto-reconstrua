// ─────────────────────────────────────────────────────────────────────────────
// CANAL OFICIAL (Decreto 2026-07-21, landing nova) — TODO caminho da landing
// leva ao WhatsApp da empresa, com a ATRIBUIÇÃO DE CAMPANHA viajando no texto
// (o mesmo mecanismo da landing anterior: utm_campaign → "Vim pelo site (X)").
// O número NUNCA é hardcoded nos componentes: vem do servidor (env) por prop.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Campanha da visita (client-side): utm_campaign > campaign > o CLIQUE PAGO >
 * 'organico'.
 *
 * O clique pago entrou em 2026-08-12: com a marcação automática ligada (o
 * padrão), o Google Ads NÃO manda utm_campaign — manda só `gclid`. O visitante
 * de anúncio caía em 'organico' e a página Campanhas dava a entender que o
 * tráfego pago não trazia ninguém. O mesmo vale para o `fbclid` da Meta.
 *
 * Para ver o NOME da campanha em vez de "google-ads", basta acrescentar
 * `utm_campaign={campaignname}` ao sufixo de URL final no painel do Google Ads
 * — aí o primeiro ramo desta função assume e o rótulo fica específico.
 */
export function campanhaDaVisita(): string {
  if (typeof window === 'undefined') return 'organico';
  const params = new URLSearchParams(window.location.search);
  const nomeada = params.get('utm_campaign') ?? params.get('campaign');
  if (nomeada !== null && nomeada.trim() !== '') return nomeada;
  if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) return 'google-ads';
  if (params.has('fbclid')) return 'meta-ads';
  return 'organico';
}

/** Link wa.me com o texto de atribuição (e, opcionalmente, nome/relato do form). */
export function linkWhatsApp(
  numero: string,
  extras?: { readonly nome?: string; readonly relato?: string },
): string {
  const campanha = campanhaDaVisita();
  let msg = `Olá! Vim pelo site (${campanha}) e quero entender meu benefício do INSS.`;
  const nome = extras?.nome?.trim();
  if (nome !== undefined && nome !== '') msg += ` Meu nome é ${nome}.`;
  const relato = extras?.relato?.trim();
  if (relato !== undefined && relato !== '') msg += ` ${relato}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}
