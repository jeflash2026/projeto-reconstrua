// ─────────────────────────────────────────────────────────────────────────────
// CANAL OFICIAL (Decreto 2026-07-21, landing nova) — TODO caminho da landing
// leva ao WhatsApp da empresa, com a ATRIBUIÇÃO DE CAMPANHA viajando no texto
// (o mesmo mecanismo da landing anterior: utm_campaign → "Vim pelo site (X)").
// O número NUNCA é hardcoded nos componentes: vem do servidor (env) por prop.
// ─────────────────────────────────────────────────────────────────────────────

/** Campanha da visita (client-side): utm_campaign > campaign > 'organico'. */
export function campanhaDaVisita(): string {
  if (typeof window === 'undefined') return 'organico';
  const params = new URLSearchParams(window.location.search);
  return params.get('utm_campaign') ?? params.get('campaign') ?? 'organico';
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
