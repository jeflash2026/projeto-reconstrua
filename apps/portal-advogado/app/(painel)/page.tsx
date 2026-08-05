// PAINEL — visão do advogado: só o que é dele (read models isolados por atribuição).
import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import { getJson, advogadoId, type PainelData } from '../../lib/api';

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
    tipo: 'compra' | 'abate';
    quantidade: number;
    nome?: string;
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
  const [data, carteira] = await Promise.all([
    getJson<PainelData>('/advogado/painel'),
    getJson<Carteira>('/advogado/carteira', 15000),
  ]);
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
                        ) : (
                          <>
                            <span className="badge warn">abate</span>{' '}
                            {l.nome ?? 'cliente encaminhado'}
                          </>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {l.tipo === 'compra' ? '+' : '−'}
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
