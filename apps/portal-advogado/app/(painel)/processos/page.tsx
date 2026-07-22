// MEUS PROCESSOS — exclusivamente os atribuídos pelo Administrador.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson, type ProcessRow } from '../../../lib/api';
import { formatDate, shortId } from '../../../lib/format';

const ProcessosPage = async (): Promise<ReactElement> => {
  const rows = await getJson<ProcessRow[]>('/advogado/processos');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Meus Processos</h1>
      <p className="page-sub">Você vê apenas os processos atribuídos a você.</p>
      {!rows ? (
        <div className="error-box">
          API indisponível ou identificação ausente (defina no Perfil).
        </div>
      ) : rows.length === 0 ? (
        <div className="card empty">Nenhum processo atribuído a você ainda.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Processo</th>
                <th>Atribuído em</th>
                <th>Eventos</th>
                <th>Estados</th>
                <th>Etapas</th>
                <th>Último evento</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assignment.missionId}>
                  <td>
                    <Link
                      href={`/processos/${r.assignment.missionId}`}
                      className="mono"
                      style={{ color: 'var(--accent)', fontWeight: 600 }}
                    >
                      {shortId(r.assignment.missionId, 14)}
                    </Link>
                  </td>
                  <td>{formatDate(r.assignment.assignedAt)}</td>
                  <td>{r.summary?.eventCount ?? '—'}</td>
                  <td>{r.summary?.stateCount ?? '—'}</td>
                  <td>{r.summary?.stageCount ?? '—'}</td>
                  <td>{formatDate(r.summary?.lastEventAt ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default ProcessosPage;
