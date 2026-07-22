// OPERAÇÃO (B4.4) — indicadores para governar centenas de processos simultâneos.
// Todos os números nascem de read models já existentes; ausência = null (nunca inventado).
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';

interface OperationalMetrics {
  totalProcessos: number;
  processosAtivos: number;
  processosEncerrados: number;
  processosReabertos: number;
  followUpsPendentes: number;
  followUpsEnviados: number;
  tempoMedioEntreInteracoesMs: number | null;
  tempoMedioAteEncerramentoMs: number | null;
  casosPorAdvogado: Record<string, number>;
  casosPorEtapa: Record<string, number>;
  casosAguardandoCliente: number;
}

function humanizeMs(ms: number | null): string {
  if (ms === null) return '—';
  const days = ms / (24 * 60 * 60_000);
  if (days >= 1) return `${days.toFixed(1)} dias`;
  const hours = ms / (60 * 60_000);
  if (hours >= 1) return `${hours.toFixed(1)} h`;
  const mins = Math.round(ms / 60_000);
  return `${String(mins)} min`;
}

const OperacaoPage = async (): Promise<ReactElement> => {
  const m = await getJson<OperationalMetrics>('/admin/metrics/operacional');
  if (!m) {
    return (
      <>
        <h1 className="page-title">Operação</h1>
        <div className="error-box">API indisponível.</div>
      </>
    );
  }
  const stat = (value: string | number, label: string): ReactElement => (
    <div className="card stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
  return (
    <>
      <h1 className="page-title">Operação</h1>
      <p className="page-sub">Indicadores para acompanhar centenas de processos simultâneos.</p>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        {stat(m.processosAtivos, 'Processos ativos')}
        {stat(m.processosEncerrados, 'Processos encerrados')}
        {stat(m.processosReabertos, 'Processos reabertos')}
        {stat(m.casosAguardandoCliente, 'Aguardando cliente')}
        {stat(m.followUpsPendentes, 'Follow-ups pendentes')}
        {stat(m.followUpsEnviados, 'Follow-ups enviados')}
        {stat(humanizeMs(m.tempoMedioEntreInteracoesMs), 'Tempo médio entre interações')}
        {stat(humanizeMs(m.tempoMedioAteEncerramentoMs), 'Tempo médio até encerramento')}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Casos por advogado</h3>
        {Object.keys(m.casosPorAdvogado).length === 0 ? (
          <div className="empty">Nenhuma atribuição ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Advogado</th>
                  <th>Casos</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.casosPorAdvogado).map(([nome, n]) => (
                  <tr key={nome}>
                    <td>{nome}</td>
                    <td>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Casos por etapa</h3>
        {Object.keys(m.casosPorEtapa).length === 0 ? (
          <div className="empty">Nenhum processo em andamento.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Casos</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.casosPorEtapa).map(([etapa, n]) => (
                  <tr key={etapa}>
                    <td>{etapa}</td>
                    <td>{n}</td>
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

export default OperacaoPage;
