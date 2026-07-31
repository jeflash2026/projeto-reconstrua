// ─────────────────────────────────────────────────────────────────────────────
// PARECER PÚBLICO DO CLIENTE (decreto 2026-07-31, funil com confirmação) — a
// página que o CLIENTE abre pelo link tokenizado que a AHRI envia ao concluir a
// fase 1: o Dossiê Jurídico simplificado, com a identidade visual do Projeto
// Reconstrua, para a pessoa VER que a análise aconteceu e confirmar o interesse.
// Sem token válido, nada aparece (o link é a chave). Conteúdo 100% derivado da
// perícia determinística — nada é inventado aqui.
// ─────────────────────────────────────────────────────────────────────────────

export interface IndicioParecer {
  readonly titulo: string;
  readonly fundamento: string;
}

export interface DadosParecer {
  readonly nome: string;
  readonly contratos: number;
  readonly bancos: number;
  readonly indicios: readonly IndicioParecer[];
}

const VERMELHO = '#c62828';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ESTILO = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1c2430; background: #f6f8fb; }
  main { max-width: 780px; margin: 0 auto; padding: 24px 20px 48px; background: #fff;
    min-height: 100vh; }
  .p-topo { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${VERMELHO};
    padding-bottom: 14px; margin-bottom: 20px; }
  .p-logo { width: 46px; height: 46px; border-radius: 10px; background: ${VERMELHO}; color: #fff;
    font-weight: 800; font-size: 26px; display: flex; align-items: center;
    justify-content: center; flex: none; }
  .p-marca { font-weight: 800; font-size: 18px; }
  .p-marca small { display: block; font-weight: 500; color: #5b6b7d; font-size: 12px; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .p-sub { color: #5b6b7d; font-size: 13px; margin-bottom: 18px; }
  .p-resumo { background: #fdf3f2; border: 1px solid #f2c9c5; border-left: 5px solid ${VERMELHO};
    border-radius: 8px; padding: 14px 16px; font-size: 15px; margin-bottom: 20px; }
  .p-h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .8px; color: ${VERMELHO};
    margin: 22px 0 10px; }
  .p-tese { border: 1px solid #e3e9f0; border-radius: 10px; padding: 12px 14px;
    margin-bottom: 10px; display: flex; gap: 12px; align-items: flex-start; }
  .p-num { width: 26px; height: 26px; border-radius: 50%; background: ${VERMELHO}; color: #fff;
    font-weight: 700; font-size: 14px; display: flex; flex: none; align-items: center;
    justify-content: center; margin-top: 2px; }
  .p-tese b { display: block; font-size: 15px; margin-bottom: 2px; }
  .p-tese p { color: #44515f; font-size: 13.5px; }
  .p-passos { margin-top: 8px; padding-left: 20px; font-size: 14.5px; }
  .p-passos li { margin: 6px 0; }
  .p-rodape { margin-top: 28px; border-top: 1px solid #e3e9f0; padding-top: 12px;
    color: #7a8798; font-size: 11.5px; line-height: 1.5; }
  .p-acoes { margin-bottom: 18px; }
  .p-btn { display: inline-block; background: ${VERMELHO}; color: #fff; border: 0;
    border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600;
    cursor: pointer; }
  @media print { .so-tela { display: none !important; } main { padding: 0; }
    @page { margin: 14mm; } }
`;

/** A página do parecer — HTML completo, auto-contido (sem JS externo). */
export function parecerPublicoHtml(d: DadosParecer, geradoEm: Date): string {
  const data = geradoEm.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const teses = d.indicios
    .map(
      (i, idx) =>
        `<div class="p-tese"><span class="p-num">${String(idx + 1)}</span><span><b>${escapeHtml(i.titulo)}</b><p>${escapeHtml(i.fundamento)}</p></span></div>`,
    )
    .join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Parecer Inicial — Projeto Reconstrua</title>
<style>${ESTILO}</style>
</head>
<body>
<main>
  <div class="p-acoes so-tela">
    <button type="button" class="p-btn" onclick="window.print()">Baixar em PDF / Imprimir</button>
  </div>
  <header class="p-topo">
    <div class="p-logo">R</div>
    <div class="p-marca">PROJETO RECONSTRUA<small>Revisão de empréstimos consignados do INSS</small></div>
  </header>
  <h1>Parecer Inicial da Análise</h1>
  <p class="p-sub">Cliente: <strong>${escapeHtml(d.nome)}</strong> · Análise realizada pela AHRI · ${data}</p>
  <div class="p-resumo"><strong>✅ Seu caso foi analisado e é APTO.</strong>
    Encontramos ${String(d.contratos)} contrato(s) de consignado em ${String(d.bancos)} banco(s)
    dentro da janela de 5 anos, com ${String(d.indicios.length)} indício(s) de irregularidade.</div>
  <div class="p-h2">O que a análise encontrou</div>
  ${teses !== '' ? teses : '<p class="p-sub">Os indícios detalhados serão apresentados pelo advogado responsável.</p>'}
  <div class="p-h2">Próximos passos</div>
  <ol class="p-passos">
    <li><strong>Confirme com a AHRI no WhatsApp</strong> que você deseja seguir — é só responder <strong>SIM</strong> na conversa; na hora o seu cadastro é gerado.</li>
    <li>A nossa equipe entra em contato para colher os documentos: <strong>procuração</strong>, <strong>RG (frente e verso)</strong> e <strong>comprovante de endereço</strong>.</li>
    <li>Um dos nossos advogados assume o seu caso e dá entrada nos pedidos.</li>
  </ol>
  <footer class="p-rodape">Documento informativo gerado automaticamente pela AHRI, a assistente
  digital do Projeto Reconstrua, a partir do HISCON enviado pelo cliente. Esta é uma análise
  preliminar e não constitui decisão judicial nem garantia de resultado. ·
  projetoreconstrua.com.br</footer>
</main>
</body>
</html>`;
}

/** Link expirado/inválido — nunca confirma a existência de ninguém. */
export const PARECER_INDISPONIVEL_HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Projeto Reconstrua</title><style>${ESTILO}</style></head>
<body><main>
  <header class="p-topo"><div class="p-logo">R</div>
  <div class="p-marca">PROJETO RECONSTRUA<small>Revisão de empréstimos consignados do INSS</small></div></header>
  <h1>Este link expirou</h1>
  <p class="p-sub" style="margin-top:8px">Por segurança, os links do parecer duram um tempo
  limitado. Fale com a AHRI no WhatsApp que ela te envia um novo agora mesmo.</p>
</main></body></html>`;
