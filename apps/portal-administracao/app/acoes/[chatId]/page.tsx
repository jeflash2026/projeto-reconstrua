// DOSSIÊ DE AÇÕES PARA IMPRESSÃO (decreto 2026-08-04) — a versão em papel do
// guia de classificação/agrupamento aplicado: o Admin imprime e confere LADO A
// LADO com o HISCON original do cliente se a lógica saiu correta (auditoria).
// Fora do grupo (painel) para a página sair limpa, pronta para imprimir; o
// gate de login do middleware cobre a rota (nada é público).
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import ImprimirParecer from '../../../components/imprimir-parecer';

const VERMELHO = '#c62828';

interface ContratoDaAcao {
  contrato: string;
  situacao: string | null;
  dataInclusao: string | null;
  dataPrimeiroDesconto: string | null;
  competenciaInicio: string | null;
  competenciaFim: string | null;
  valorEmprestado: number | null;
  valorParcela: number | null;
  migrado: boolean;
}

interface AcaoDossie {
  numero: number;
  categoria: 'ATIVOS' | 'EXCLUIDOS' | 'RMC' | 'RCC';
  banco: string;
  contratos: ContratoDaAcao[];
  regra: string;
}

interface DossieAcoes {
  chatId: string;
  nomeCliente: string | null;
  agrupamento: {
    acoes: AcaoDossie[];
    resumo: {
      totalAcoes: number;
      totalContratos: number;
      contratosSelecionados?: number;
      contratosForaDaSelecao?: number;
      porCategoria: Record<'ATIVOS' | 'EXCLUIDOS' | 'RMC' | 'RCC', number>;
    };
  };
}

const ROTULO: Record<AcaoDossie['categoria'], string> = {
  ATIVOS: 'Contratos Ativos',
  EXCLUIDOS: 'Não-ativos (lote 3 = 1)',
  RMC: 'RMC — Reserva de Margem Consignável',
  RCC: 'RCC — Reserva de Cartão Consignado',
};

function moeda(v: number | null): string {
  return v === null
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function dataBr(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const AcoesPrintPage = async ({
  params,
}: {
  params: { chatId: string };
}): Promise<ReactElement> => {
  const chatId = decodeURIComponent(params.chatId);
  const d = await getJson<DossieAcoes>(`/admin/pericia/acoes/${encodeURIComponent(chatId)}`);
  const hoje = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="acoes-doc">
      <style>{`
        .acoes-doc { max-width: 860px; margin: 0 auto; padding: 24px 20px 48px;
          font-family: 'Segoe UI', system-ui, sans-serif; color: #1c2430;
          background: #fff; min-height: 100vh; }
        .acoes-doc * { box-sizing: border-box; }
        .a-topo { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${VERMELHO};
          padding-bottom: 14px; margin-bottom: 18px; }
        .a-logo { width: 46px; height: 46px; border-radius: 10px; background: ${VERMELHO};
          color: #fff; font-weight: 800; font-size: 26px; display: flex;
          align-items: center; justify-content: center; flex: none; }
        .a-marca { font-weight: 800; font-size: 18px; letter-spacing: .3px; }
        .a-marca small { display: block; font-weight: 500; color: #5b6b7d; font-size: 12px; }
        .a-titulo { font-size: 22px; margin: 0 0 2px; }
        .a-sub { color: #5b6b7d; font-size: 13px; margin: 0 0 14px; }
        .a-resumo { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .a-chip { border: 1px solid #dfe6ee; border-radius: 999px; padding: 3px 12px;
          font-size: 12.5px; font-weight: 600; }
        .a-guia { background: #f7f9fc; border: 1px solid #e3e9f0; border-left: 5px solid ${VERMELHO};
          border-radius: 8px; padding: 12px 14px; font-size: 13px; margin-bottom: 18px;
          line-height: 1.55; }
        .a-acao { border: 1px solid #e3e9f0; border-radius: 10px; padding: 12px 14px;
          margin-bottom: 12px; break-inside: avoid; }
        .a-acao-topo { display: flex; justify-content: space-between; flex-wrap: wrap;
          gap: 6px; font-size: 15px; margin-bottom: 2px; }
        .a-regra { color: #44515f; font-size: 12.5px; margin: 2px 0 8px; }
        .a-acao table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .a-acao th { text-align: left; color: #5b6b7d; font-weight: 600; padding: 4px 8px;
          border-bottom: 1px solid #e3e9f0; }
        .a-acao td { padding: 4px 8px; border-bottom: 1px solid #eef2f6; }
        .a-mono { font-family: ui-monospace, Consolas, monospace; }
        .a-rodape { margin-top: 24px; border-top: 1px solid #e3e9f0; padding-top: 12px;
          color: #7a8798; font-size: 11.5px; line-height: 1.5; }
        .a-btn { margin-bottom: 16px; }
        @media print {
          .so-tela { display: none !important; }
          .acoes-doc { padding: 0; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div className="a-btn">
        <ImprimirParecer />
      </div>

      <header className="a-topo">
        <div className="a-logo">R</div>
        <div className="a-marca">
          PROJETO RECONSTRUA
          <small>Dossiê de Ações — classificação e agrupamento de contratos</small>
        </div>
      </header>

      {d === null ? (
        <p className="a-sub">
          HISCON deste cliente ainda não legível — o dossiê aparece aqui quando a leitura sair.
        </p>
      ) : (
        <>
          <h1 className="a-titulo">
            {d.nomeCliente ?? 'Cliente'} — {d.agrupamento.resumo.totalContratos} contrato(s) ·{' '}
            {d.agrupamento.resumo.totalAcoes} processo(s)
          </h1>
          <p className="a-sub">
            WhatsApp <span className="a-mono">{d.chatId.split('@')[0]}</span> · gerado em {hoje}
            {d.agrupamento.resumo.contratosSelecionados !== undefined
              ? ` · ${String(d.agrupamento.resumo.contratosSelecionados)} contrato(s) selecionados` +
                (d.agrupamento.resumo.contratosForaDaSelecao
                  ? ` · ${String(d.agrupamento.resumo.contratosForaDaSelecao)} fora da seleção (sobra de trio/teto/sem ano)`
                  : '')
              : ''}
          </p>

          <div className="a-resumo">
            {(['ATIVOS', 'EXCLUIDOS', 'RMC', 'RCC'] as const).map((cat) =>
              d.agrupamento.resumo.porCategoria[cat] > 0 ? (
                <span key={cat} className="a-chip">
                  {ROTULO[cat]}: {d.agrupamento.resumo.porCategoria[cat]} processo(s)
                </span>
              ) : null,
            )}
          </div>

          <div className="a-guia">
            <strong>O guia aplicado (v2 — modelo comercial):</strong> contratos ATIVOS na janela de
            5 anos = 1 processo cada; NÃO-ATIVOS (excluído/inativo/suspenso/migrado) formam lotes de
            3 contratos do MESMO banco + MESMO ano = 1 processo, com teto de 15 processos por banco,
            sempre dos maiores valores para os menores (a sobra que não fecha trio fica fora); RMC e
            RCC sempre em processos separados. São ESTES contratos selecionados que seguem para o
            perito e que compõem o potencial financeiro.
          </div>

          {d.agrupamento.acoes.map((a) => (
            <div className="a-acao" key={a.numero}>
              <div className="a-acao-topo">
                <strong>
                  Processo {a.numero} · {ROTULO[a.categoria]}
                </strong>
                <span>{a.banco}</span>
              </div>
              <div className="a-regra">{a.regra}</div>
              <table>
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th>Situação</th>
                    <th>Data inclusão</th>
                    <th>Competência</th>
                    <th>Valor emprestado</th>
                    <th>Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {a.contratos.map((c) => (
                    <tr key={c.contrato}>
                      <td className="a-mono">{c.contrato}</td>
                      <td>
                        {c.situacao ?? '—'}
                        {c.migrado ? ' · MIGRADO' : ''}
                      </td>
                      <td>{dataBr(c.dataInclusao ?? c.dataPrimeiroDesconto)}</td>
                      <td className="a-mono">
                        {c.competenciaInicio ?? '—'}
                        {c.competenciaFim !== null ? ` → ${c.competenciaFim}` : ''}
                      </td>
                      <td>{moeda(c.valorEmprestado)}</td>
                      <td>{moeda(c.valorParcela)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      <footer className="a-rodape">
        Documento de trabalho gerado automaticamente pela AHRI a partir do HISCON enviado pelo
        cliente, aplicando o guia de Classificação e Agrupamento de Contratos em Ações do
        escritório. Uso interno — confira com o HISCON original antes da distribuição. ·
        projetoreconstrua.com.br
      </footer>
    </main>
  );
};

export default AcoesPrintPage;
