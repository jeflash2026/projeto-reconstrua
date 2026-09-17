// PAINEL — visão do advogado: só o que é dele (read models isolados por atribuição).
import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import { getJson, advogadoId, type Acompanhamento, type PainelData } from '../../lib/api';
import { classePrazo, prazoTexto } from '../../lib/prazo';

/** MINHA CARTEIRA (decreto 2026-08-05): contratos comprados × abatidos pelos
 *  encaminhamentos × saldo — a prestação de contas do parceiro, ao vivo. */
interface Carteira {
  saldo: {
    comprados: number;
    abatidos: number;
    saldo: number;
    clientesAbatidos: number;
  };
  extrato: readonly {
    em: string;
    /** 'estorno' (2026-08-12): o cliente saiu daqui e os créditos voltaram —
     *  o advogado precisa ver isso como CRÉDITO, nunca como mais um débito. */
    tipo: 'compra' | 'abate' | 'estorno';
    quantidade: number;
    nome?: string;
    motivo?: string;
  }[];
}

function dataBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const Stat = ({ label, value }: { label: string; value: string | number }): ReactElement => (
  <div className="card stat">
    <div className="value">{value}</div>
    <div className="label">{label}</div>
  </div>
);

const PainelPage = async (): Promise<ReactElement> => {
  if (advogadoId() === null) {
    return (
      <>
        <h1 className="page-title">Painel</h1>
        <div className="card empty">Identifique-se na aba Perfil para acessar seus processos.</div>
      </>
    );
  }
  const [data, carteira, acompanhamento] = await Promise.all([
    getJson<PainelData>('/advogado/painel'),
    getJson<Carteira>('/advogado/carteira', 15000),
    // ACOMPANHAMENTO PROCESSUAL (2026-09-11): prazos das intimações no topo.
    getJson<Acompanhamento>('/advogado/acompanhamento', 15000),
  ]);
  const prazosAbertos = (acompanhamento?.alertas ?? []).filter((a) => !a.ciente);
  if (!data) {
    return (
      <>
        <h1 className="page-title">Painel</h1>
        <div className="error-box">API indisponível ou identificação inválida/inativa.</div>
      </>
    );
  }
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Painel</h1>
      <p className="page-sub">
        Somente seus processos e seu trabalho. A comunicação com clientes é da AHRI.
      </p>
      <div className="grid stats" style={{ marginBottom: 16 }}>
        <Stat label="Processos atribuídos" value={data.processCount} />
        <Stat label="Pendências" value={data.pendingCount} />
        <Stat label="Prazos (7 dias)" value={data.deadlinesSoon} />
        <Stat label="Protocolos aguardando" value={data.protocolsWaiting} />
        <Stat label="Documentos novos" value={data.newDocuments} />
        <Stat label="Fila (aguardando advogado)" value={data.queue} />
      </div>
      {/* ── PRAZOS PROCESSUAIS (2026-09-11): intimações que pedem providência ── */}
      {prazosAbertos.length > 0 ? (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--bad)' }}>
          <h3 style={{ marginTop: 0 }}>Prazos processuais</h3>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Intimações publicadas nos processos dos seus clientes que pedem providência. Vencimentos
            estimados — confira a contagem oficial no eproc.
          </p>
          {prazosAbertos.slice(0, 5).map((a) => (
            <p key={a.chave} style={{ margin: '6px 0' }}>
              <span className={classePrazo(a.diasRestantes)}>{prazoTexto(a.diasRestantes)}</span>{' '}
              <strong>{a.cliente}</strong> —{' '}
              {a.determinacoes.find((d) => d.prazoDias !== null)?.oQue ?? a.resumo}{' '}
              <a href={`/advogado/acompanhamento?cliente=${encodeURIComponent(a.chatId)}#clientes`}>
                ver parecer
              </a>
            </p>
          ))}
          <a href="/advogado/acompanhamento">
            {prazosAbertos.length > 5
              ? `Ver todos os ${String(prazosAbertos.length)} prazos →`
              : 'Abrir o acompanhamento processual →'}
          </a>
        </div>
      ) : null}
      {/* ── MINHA CARTEIRA DE CONTRATOS (2026-08-05): comprados × abatidos ── */}
      {carteira !== null ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Minha carteira de contratos</h3>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Cada cliente encaminhado a você abate da carteira os processos organizados pelo guia do
            escritório. O extrato é a prestação de contas.
          </p>
          <div className="grid stats" style={{ marginBottom: 10 }}>
            <Stat label="Contratos comprados" value={carteira.saldo.comprados} />
            <Stat
              label={`Abatidos (${carteira.saldo.clientesAbatidos} cliente(s) entregues)`}
              value={carteira.saldo.abatidos}
            />
            <Stat label="Saldo disponível" value={carteira.saldo.saldo} />
          </div>
          {carteira.extrato.length === 0 ? (
            <div className="empty">Nenhum lançamento ainda.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Lançamento</th>
                    <th>Contratos</th>
                  </tr>
                </thead>
                <tbody>
                  {carteira.extrato.slice(0, 10).map((l, i) => (
                    <tr key={i}>
                      <td>{dataBr(l.em)}</td>
                      <td>
                        {l.tipo === 'compra' ? (
                          <span className="badge ok">compra</span>
                        ) : l.tipo === 'estorno' ? (
                          <>
                            <span className="badge ok">estorno</span> {l.nome ?? 'cliente'} —{' '}
                            {l.motivo ?? 'crédito devolvido'}
                          </>
                        ) : (
                          <>
                            <span className="badge warn">abate</span>{' '}
                            {l.nome ?? 'cliente encaminhado'}
                          </>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {l.tipo === 'abate' ? '−' : '+'}
                        {l.quantidade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="card">
        <h3>Alertas</h3>
        {data.alerts.length === 0 ? (
          <div className="empty">Nenhum alerta. Tudo em dia.</div>
        ) : (
          data.alerts.map((a, i) => (
            <p key={i} style={{ margin: '4px 0' }}>
              <span className="badge bad">alerta</span> {a}
            </p>
          ))
        )}
      </div>
    </>
  );
};

export default PainelPage;
