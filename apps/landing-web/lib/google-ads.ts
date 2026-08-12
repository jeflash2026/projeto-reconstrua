// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE ADS — CONVERSÃO "CONTATO" (2026-08-12).
//
// A conversão marca INTENÇÃO REAL DE CONTATO, não visita: ela só dispara quando
// a pessoa abre o WhatsApp da empresa. Colocar o evento no carregamento da
// página contaria todo visitante como lead e estragaria a otimização das
// campanhas — o Google passaria a comprar tráfego que não fala com a gente.
//
// Na landing existem EXATAMENTE dois caminhos que abrem o WhatsApp (o botão
// flutuante e o envio do formulário "Quero entender meu caso", que faz
// window.open do wa.me). Todo o resto ("Analisar meu caso" no menu, no herói e
// no rodapé) é âncora para #analise — rolagem dentro da página, não contato.
// ─────────────────────────────────────────────────────────────────────────────

/** IDs PÚBLICOS (viajam no HTML de qualquer forma — não são segredo). O env
 *  permite trocar a conta sem tocar no código; vazio DESLIGA o rastreamento. */
export const GOOGLE_ADS_ID = process.env['NEXT_PUBLIC_GOOGLE_ADS_ID'] ?? 'AW-18386538373';
/** Rótulo da conversão "Contato" (a parte depois da barra no send_to). */
export const GOOGLE_ADS_CONTATO =
  process.env['NEXT_PUBLIC_GOOGLE_ADS_CONTATO'] ?? 'ZjYlCMz22uAcEIWfsb9E';

type Gtag = (...args: unknown[]) => void;

/** Duas chamadas separadas por menos que isto são o MESMO gesto do usuário
 *  (elemento clicável dentro de outro, handler que subiu duas vezes) e contam
 *  uma vez só. Acima disso é contato novo — e o Tag Assistant consegue repetir
 *  o teste sem parecer quebrado. */
const JANELA_ANTI_DUPLICADO_MS = 1500;
let ultimoEnvio = 0;

/**
 * Registra a conversão "Contato". Nunca lança: se o Google Ads estiver
 * bloqueado por ad blocker, por política de privacidade ou simplesmente ainda
 * não tiver carregado, a função não faz nada e o WhatsApp abre igual — o
 * rastreamento jamais pode ficar entre o cliente e o atendimento.
 */
export function trackGoogleAdsContact(): void {
  if (typeof window === 'undefined' || GOOGLE_ADS_ID === '') return;
  const agora = Date.now();
  if (agora - ultimoEnvio < JANELA_ANTI_DUPLICADO_MS) return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== 'function') return;
  ultimoEnvio = agora;
  try {
    gtag('event', 'conversion', {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONTATO}`,
      value: 1.0,
      currency: 'BRL',
    });
  } catch {
    /* rastreamento é observador: falha dele não atrapalha o site */
  }
}
