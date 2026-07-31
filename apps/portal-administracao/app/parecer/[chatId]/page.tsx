// PARECER VISUAL PARA O CLIENTE (decreto 2026-07-31) — a versão SIMPLIFICADA e
// com identidade visual do Projeto Reconstrua do Dossiê Jurídico, feita para o
// DONO salvar em PDF e enviar ao cliente no WhatsApp: prova de que a AHRI
// analisou o HISCON de verdade e encontrou indícios. Fora do grupo (painel)
// para não carregar a navegação — página limpa, pronta para imprimir. O gate de
// login do middleware cobre esta rota (nada é público).
import type { ReactElement } from 'react';
import {
  getJson,
  type ClientDetail,
  type DossieJuridico,
  type JornadaCliente,
} from '../../../lib/api';
import ImprimirParecer from '../../../components/imprimir-parecer';

const VERMELHO = '#c62828';

const ParecerPage = async ({ params }: { params: { chatId: string } }): Promise<ReactElement> => {
  const chatId = decodeURIComponent(params.chatId);
  const [d, cliente, jornada] = await Promise.all([
    getJson<DossieJuridico>(`/admin/clients/${encodeURIComponent(chatId)}/dossie`),
    getJson<ClientDetail>(`/admin/clients/${encodeURIComponent(chatId)}`),
    // O NOME como aparece na aba Clientes (autoritativo do HISCON — a captura
    // da conversa às vezes traz a cidade no lugar do nome).
    getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes'),
  ]);
  const nome =
    jornada?.clientes.find((c) => c.chatId === chatId)?.quem ??
    cliente?.relationship.knownName ??
    'Cliente';
  const hoje = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="parecer">
      <style>{`
        .parecer { max-width: 800px; margin: 0 auto; padding: 24px 20px 48px;
          font-family: 'Segoe UI', system-ui, sans-serif; color: #1c2430;
          background: #fff; min-height: 100vh; }
        .parecer * { box-sizing: border-box; }
        .p-topo { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${VERMELHO};
          padding-bottom: 14px; margin-bottom: 20px; }
        .p-logo { width: 46px; height: 46px; border-radius: 10px; background: ${VERMELHO};
          color: #fff; font-weight: 800; font-size: 26px; display: flex;
          align-items: center; justify-content: center; flex: none; }
        .p-marca { font-weight: 800; font-size: 18px; letter-spacing: .3px; }
        .p-marca small { display: block; font-weight: 500; color: #5b6b7d; font-size: 12px; }
        .p-titulo { font-size: 22px; margin: 0 0 2px; }
        .p-sub { color: #5b6b7d; font-size: 13px; margin: 0 0 18px; }
        .p-resumo { background: #fdf3f2; border: 1px solid #f2c9c5; border-left: 5px solid ${VERMELHO};
          border-radius: 8px; padding: 14px 16px; font-size: 15px; margin-bottom: 20px; }
        .p-h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .8px;
          color: ${VERMELHO}; margin: 22px 0 10px; }
        .p-tese { border: 1px solid #e3e9f0; border-radius: 10px; padding: 12px 14px;
          margin-bottom: 10px; display: flex; gap: 12px; align-items: flex-start; }
        .p-num { width: 26px; height: 26px; border-radius: 50%; background: ${VERMELHO};
          color: #fff; font-weight: 700; font-size: 14px; display: flex; flex: none;
          align-items: center; justify-content: center; margin-top: 2px; }
        .p-tese b { display: block; font-size: 15px; margin-bottom: 2px; }
        .p-tese p { margin: 0; color: #44515f; font-size: 13.5px; }
        .p-passos { margin: 8px 0 0; padding-left: 20px; font-size: 14.5px; }
        .p-passos li { margin: 6px 0; }
        .p-rodape { margin-top: 28px; border-top: 1px solid #e3e9f0; padding-top: 12px;
          color: #7a8798; font-size: 11.5px; line-height: 1.5; }
        .p-acoes { display: flex; gap: 8px; margin-bottom: 18px; }
        @media print {
          .so-tela { display: none !important; }
          .parecer { padding: 0; }
          @page { margin: 14mm; }
        }
      `}</style>

      <div className="p-acoes">
        <ImprimirParecer />
      </div>

      <header className="p-topo">
        <div className="p-logo">R</div>
        <div className="p-marca">
          PROJETO RECONSTRUA
          <small>Revisão de empréstimos consignados do INSS</small>
        </div>
      </header>

      <h1 className="p-titulo">Parecer Inicial da Análise</h1>
      <p className="p-sub">
        Cliente: <strong>{nome}</strong> · Análise realizada pela AHRI · {hoje}
      </p>

      {d === null ? (
        <p className="p-resumo">
          A análise deste caso ainda está sendo concluída — o parecer aparece aqui assim que estiver
          pronto.
        </p>
      ) : (
        <>
          <div className="p-resumo">
            <strong>✅ Seu caso foi analisado e é APTO.</strong> {d.resumoExecutivo}
          </div>

          {/* EXATAMENTE as hipóteses do Dossiê do painel — mesma lista, mesma
              ordem, mesmos números (decreto 2026-07-31: nada de cortar na 3ª). */}
          <div className="p-h2">O que a análise encontrou</div>
          {d.hipoteses.length === 0 ? (
            <p className="p-sub">Os indícios detalhados serão apresentados pelo advogado.</p>
          ) : (
            d.hipoteses.map((t) => (
              <div className="p-tese" key={t.ref}>
                <span className="p-num">{t.posicao}</span>
                <span>
                  <b>{t.hipotese}</b>
                  <p>{t.justificativa}</p>
                </span>
              </div>
            ))
          )}

          <div className="p-h2">Próximos passos</div>
          <ol className="p-passos">
            <li>
              A nossa equipe entra em contato para colher os documentos: <strong>procuração</strong>
              , <strong>RG (frente e verso)</strong> e <strong>comprovante de endereço</strong>.
            </li>
            <li>Um dos nossos advogados assume o seu caso e dá entrada nos pedidos.</li>
            <li>Você acompanha tudo pelo Portal do Cliente e pelo WhatsApp da AHRI.</li>
          </ol>
        </>
      )}

      <footer className="p-rodape">
        Documento informativo gerado automaticamente pela AHRI, a assistente digital do Projeto
        Reconstrua, a partir do HISCON enviado pelo cliente. Esta é uma análise preliminar e não
        constitui decisão judicial nem garantia de resultado. · projetoreconstrua.com.br
      </footer>
    </main>
  );
};

export default ParecerPage;
