// LOGS — eventos do Event Store (projetados) + trilha de observabilidade
// (dispatcher/workflow/scheduler/conversation/brain/mission/health). Pesquisável.
import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import { getJson, type LogsData } from '../../lib/api';
import { formatDate, shortId } from '../../lib/format';

const LogsPage = async ({ searchParams }: { searchParams: { q?: string } }): Promise<ReactElement> => {
  const q = searchParams.q ?? '';
  const data = await getJson<LogsData>(`/admin/logs?q=${encodeURIComponent(q)}`);
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Logs</h1>
      <p className="page-sub">Tudo auditável: eventos de domínio e observações de runtime.</p>

      <form className="form-row" action="/logs" method="get">
        <input type="text" name="q" placeholder="Pesquisar (evento, stream, ator, regra, componente)…" defaultValue={q} />
        <button type="submit" className="primary">
          Pesquisar
        </button>
      </form>

      {!data ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <div className="grid two">
          <div className="card">
            <h3>Eventos ({data.events.length})</h3>
            {data.events.length === 0 ? (
              <div className="empty">Nenhum evento.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Quando</th>
                      <th>Evento</th>
                      <th>Stream</th>
                      <th>Regra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => (
                      <tr key={e.globalSeq}>
                        <td className="mono">{e.globalSeq}</td>
                        <td className="mono">{formatDate(e.recordedAt)}</td>
                        <td className="mono">{e.eventType}</td>
                        <td className="mono">{`${e.streamType}/${shortId(e.streamId, 8)}`}</td>
                        <td className="mono">{e.operationalRuleRef ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card">
            <h3>Observabilidade ({data.observations.length})</h3>
            {data.observations.length === 0 ? (
              <div className="empty">Nenhuma observação.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Componente</th>
                      <th>Tipo</th>
                      <th>Nome</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.observations.map((o, i) => (
                      <tr key={i}>
                        <td className="mono">{formatDate(o.at)}</td>
                        <td>
                          <span className="badge dim">{o.component}</span>
                        </td>
                        <td>{o.kind}</td>
                        <td className="mono">{o.name}</td>
                        <td className="mono">{o.value ?? o.detail ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LogsPage;
