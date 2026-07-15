// PAINEL — visão do advogado: só o que é dele (read models isolados por atribuição).
import type { ReactElement } from 'react';
import AutoRefresh from '../components/auto-refresh';
import { getJson, advogadoId, type PainelData } from '../lib/api';

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
  const data = await getJson<PainelData>('/advogado/painel');
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
      <p className="page-sub">Somente seus processos e seu trabalho. A comunicação com clientes é da AHRI.</p>
      <div className="grid stats" style={{ marginBottom: 16 }}>
        <Stat label="Processos atribuídos" value={data.processCount} />
        <Stat label="Pendências" value={data.pendingCount} />
        <Stat label="Prazos (7 dias)" value={data.deadlinesSoon} />
        <Stat label="Protocolos aguardando" value={data.protocolsWaiting} />
        <Stat label="Documentos novos" value={data.newDocuments} />
        <Stat label="Fila (aguardando advogado)" value={data.queue} />
      </div>
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
