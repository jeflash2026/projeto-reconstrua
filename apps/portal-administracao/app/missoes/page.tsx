// MISSÕES — lista com contagens auditáveis (verdades, estados, etapas, operações).
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import { getJson, type MissionRow } from '../../lib/api';
import { formatDate, shortId } from '../../lib/format';

const MissionsPage = async (): Promise<ReactElement> => {
  const missions = await getJson<MissionRow[]>('/admin/missions');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Missões</h1>
      <p className="page-sub">Cada missão com sua história completa no Event Store, projetada aqui.</p>
      {!missions ? (
        <div className="error-box">API indisponível.</div>
      ) : missions.length === 0 ? (
        <div className="card empty">Nenhuma missão ainda.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Missão</th>
                <th>Cliente</th>
                <th>Criada</th>
                <th>Eventos</th>
                <th>Verdades</th>
                <th>Estados</th>
                <th>Etapas</th>
                <th>Operações</th>
                <th>Último evento</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => (
                <tr key={m.missionId}>
                  <td>
                    <Link href={`/missoes/${m.missionId}`} className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {shortId(m.missionId, 12)}
                    </Link>
                  </td>
                  <td className="mono">{m.chatId ?? '—'}</td>
                  <td>{formatDate(m.createdAt)}</td>
                  <td>{m.eventCount}</td>
                  <td>{m.truthCount}</td>
                  <td>{m.stateCount}</td>
                  <td>{m.stageCount}</td>
                  <td>{m.operationCount}</td>
                  <td>{formatDate(m.lastEventAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default MissionsPage;
