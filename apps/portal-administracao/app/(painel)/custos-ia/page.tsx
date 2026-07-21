// CUSTOS DE IA (2026-07-21) — o gasto REAL por cliente, do atendimento (conversa
// da AHRI) à leitura de documentos (visão). Fonte: MedidorDeCusto via
// /admin/custos — tokens × preço de tabela do modelo, por chamada. ESTIMATIVA:
// a fatura oficial é o Console do provedor (Anthropic/OpenAI/Google).
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson } from '../../../lib/api';

interface CustosView {
  moeda: string;
  aviso: string;
  totalUsd: number;
  hojeUsd: number;
  ultimos7DiasUsd: number;
  chamadas: number;
  chamadasSemPreco: number;
  porContexto: { contexto: string; usd: number; chamadas: number }[];
  porDia: { dia: string; usd: number }[];
  porCliente: {
    chatId: string;
    nome: string | null;
    conversaUsd: number;
    leituraUsd: number;
    totalUsd: number;
    chamadas: number;
    tokensIn: number;
    tokensOut: number;
  }[];
  semAtribuicao: { usd: number; chamadas: number };
}

const usd = (v: number): string => `$${v.toFixed(v >= 1 ? 2 : 4)}`;
const CONTEXTOS: Record<string, string> = {
  conversa: 'Atendimento (AHRI)',
  'leitura-documento': 'Leitura de documentos',
};

const CustosIaPage = async (): Promise<ReactElement> => {
  const data = await getJson<CustosView>('/admin/custos');
  if (data === null) {
    return (
      <>
        <h1 className="page-title">Custos de IA</h1>
        <div className="empty">API indisponível (ou medidor ainda não implantado).</div>
      </>
    );
  }
  return (
    <>
      <AutoRefresh seconds={60} />
      <h1 className="page-title">Custos de IA</h1>
      <p className="page-sub">
        Quanto cada cliente custa em IA, do atendimento à leitura dos documentos. {data.aviso}
      </p>

      <div className="grid-cards" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="page-sub">Hoje</div>
          <h2 style={{ margin: 0 }}>{usd(data.hojeUsd)}</h2>
        </div>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="page-sub">Últimos 7 dias</div>
          <h2 style={{ margin: 0 }}>{usd(data.ultimos7DiasUsd)}</h2>
        </div>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="page-sub">Total registrado</div>
          <h2 style={{ margin: 0 }}>{usd(data.totalUsd)}</h2>
        </div>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="page-sub">Chamadas de IA</div>
          <h2 style={{ margin: 0 }}>{data.chamadas}</h2>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Por origem</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Origem</th>
                <th>Chamadas</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {data.porContexto.map((c) => (
                <tr key={c.contexto}>
                  <td>{CONTEXTOS[c.contexto] ?? c.contexto}</td>
                  <td>{c.chamadas}</td>
                  <td className="mono">{usd(c.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Por cliente</h3>
        {data.porCliente.length === 0 ? (
          <div className="empty">
            Ainda sem registros — o medidor conta a partir da implantação (cada nova mensagem e
            leitura de documento entra aqui).
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Atendimento</th>
                  <th>Leitura de docs</th>
                  <th>Total</th>
                  <th>Chamadas</th>
                  <th>Tokens (entrada/saída)</th>
                </tr>
              </thead>
              <tbody>
                {data.porCliente.map((c) => (
                  <tr key={c.chatId}>
                    <td>
                      <Link
                        href={`/clientes/${encodeURIComponent(c.chatId)}`}
                        style={{ color: 'var(--accent)' }}
                      >
                        {c.nome ?? c.chatId}
                      </Link>
                    </td>
                    <td className="mono">{usd(c.conversaUsd)}</td>
                    <td className="mono">{usd(c.leituraUsd)}</td>
                    <td className="mono">
                      <strong>{usd(c.totalUsd)}</strong>
                    </td>
                    <td>{c.chamadas}</td>
                    <td className="mono">
                      {c.tokensIn.toLocaleString('pt-BR')} / {c.tokensOut.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.semAtribuicao.chamadas > 0 ? (
          <p className="page-sub" style={{ marginTop: 8 }}>
            Sem atribuição a cliente: {data.semAtribuicao.chamadas} chamada(s) ·{' '}
            {usd(data.semAtribuicao.usd)} (turnos de sistema ou documentos ainda não registrados).
          </p>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Por dia (últimos 14)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {data.porDia.map((d) => (
                <tr key={d.dia}>
                  <td className="mono">{d.dia}</td>
                  <td className="mono">{usd(d.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default CustosIaPage;
