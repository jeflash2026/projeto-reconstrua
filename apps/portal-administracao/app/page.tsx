// DASHBOARD — visão de abertura, alimentada EXCLUSIVAMENTE pelos Read Models
// via /admin/dashboard. Dados ausentes aparecem como ausentes (nunca inventados).
import type { ReactElement } from 'react';
import AutoRefresh from '../components/auto-refresh';
import { getJson, type DashboardData } from '../lib/api';
import { formatMs, formatMoney, healthBadgeClass } from '../lib/format';

const Stat = ({ label, value }: { label: string; value: string | number }): ReactElement => (
  <div className="card stat">
    <div className={`value${typeof value === 'string' && value.startsWith('sem ') ? ' na' : ''}`}>{value}</div>
    <div className="label">{label}</div>
  </div>
);

const DashboardPage = async (): Promise<ReactElement> => {
  const data = await getJson<DashboardData>('/admin/dashboard');
  if (!data) {
    return (
      <>
        <h1 className="page-title">Dashboard</h1>
        <div className="error-box">API indisponível. Verifique se o servidor administrativo está no ar.</div>
      </>
    );
  }
  return (
    <>
      <AutoRefresh seconds={5} />
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Operação em tempo real — todos os números nascem dos Read Models.</p>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <Stat label="Clientes ativos" value={data.activeClients} />
        <Stat label="Clientes novos hoje" value={data.newClientsToday} />
        <Stat label="Aguardando documentos" value={data.awaitingDocuments} />
        <Stat label="Aguardando perícia" value={data.awaitingPericia} />
        <Stat label="Aguardando advogado" value={data.awaitingAdvogado} />
        <Stat label="Processos distribuídos" value={data.processesDistributed} />
        <Stat label="Tempo médio de atendimento" value={formatMs(data.avgHandlingMs)} />
        <Stat label="Mensagens" value={data.messageCount} />
        <Stat label="Documentos" value={data.documentCount} />
        <Stat label="Valor administrado" value={formatMoney(data.financialUnderAdministration)} />
        <Stat label="Honorários previstos" value={formatMoney(data.expectedFees)} />
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Gargalos</h3>
          <p style={{ margin: 0 }}>{data.bottlenecks}</p>
        </div>
        <div className="card">
          <h3>Alertas</h3>
          <p style={{ margin: 0 }}>{data.alerts}</p>
        </div>
      </div>

      <div className="card">
        <h3>
          Health dos runtimes — geral: <span className={`badge ${healthBadgeClass(data.overall)}`}>{data.overall}</span>
        </h3>
        {data.health.length === 0 ? (
          <div className="empty">Nenhum componente reportou saúde ainda (execute o Boot).</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Status</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {data.health.map((h) => (
                  <tr key={h.component}>
                    <td>{h.component}</td>
                    <td>
                      <span className={`badge ${healthBadgeClass(h.status)}`}>{h.status}</span>
                    </td>
                    <td>{h.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default DashboardPage;
