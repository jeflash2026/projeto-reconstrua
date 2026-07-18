// HEALTH — estado de todos os runtimes: latência, fila, memória, último processamento.
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson, type HealthData } from '../../../lib/api';
import { formatDate, formatMs, healthBadgeClass } from '../../../lib/format';

const HealthPage = async (): Promise<ReactElement> => {
  const data = await getJson<HealthData>('/admin/health');
  return (
    <>
      <AutoRefresh seconds={5} />
      <h1 className="page-title">Health</h1>
      <p className="page-sub">
        Estado geral:{' '}
        {data ? <span className={`badge ${healthBadgeClass(data.overall)}`}>{data.overall}</span> : <span className="badge bad">API OFFLINE</span>}
      </p>
      {!data ? (
        <div className="error-box">API indisponível.</div>
      ) : data.components.length === 0 ? (
        <div className="card empty">Nenhum componente reportou saúde ainda — execute o Boot Runtime.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Runtime</th>
                <th>Status</th>
                <th>Latência</th>
                <th>Fila</th>
                <th>Memória</th>
                <th>Último processamento</th>
                <th>Reportado em</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {data.components.map((c) => (
                <tr key={c.component}>
                  <td style={{ fontWeight: 600 }}>{c.component}</td>
                  <td>
                    <span className={`badge ${healthBadgeClass(c.status)}`}>{c.status}</span>
                  </td>
                  <td>{formatMs(c.responseMs)}</td>
                  <td>{c.queueDepth ?? '—'}</td>
                  <td>{c.memoryBytes === null ? '—' : `${(c.memoryBytes / 1048576).toFixed(1)} MB`}</td>
                  <td>{formatDate(c.lastProcessedAt)}</td>
                  <td>{formatDate(c.reportedAt)}</td>
                  <td>{c.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default HealthPage;
