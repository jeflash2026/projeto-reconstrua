// PERÍCIAS — perícias enquadradas (domínio) + fila do papel + gestão de Peritos.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import StaffPanel from '../../components/staff-panel';
import { getJson } from '../../lib/api';
import { formatDate, shortId } from '../../lib/format';

interface PericiasData {
  pericias: Array<{ periciaId: string; missionId: string | null; framedAt: string }>;
  queue: number;
}

const PericiasPage = async (): Promise<ReactElement> => {
  const data = await getJson<PericiasData>('/admin/pericias');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Perícias</h1>
      <p className="page-sub">Enquadramentos de perícia da operação + fila aguardando perito.</p>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Perícias enquadradas</h3>
          {!data ? (
            <div className="error-box">API indisponível.</div>
          ) : data.pericias.length === 0 ? (
            <div className="empty">Nenhuma perícia enquadrada ainda.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Perícia</th>
                    <th>Missão</th>
                    <th>Enquadrada em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pericias.map((p) => (
                    <tr key={p.periciaId}>
                      <td className="mono">{shortId(p.periciaId, 10)}</td>
                      <td>
                        {p.missionId ? (
                          <Link href={`/missoes/${p.missionId}`} className="mono" style={{ color: 'var(--accent)' }}>
                            {shortId(p.missionId, 10)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{formatDate(p.framedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card stat">
          <div className="value">{data?.queue ?? '—'}</div>
          <div className="label">Clientes aguardando perito (fila de handoff)</div>
        </div>
      </div>

      <StaffPanel role="perito" title="Peritos" />
    </>
  );
};

export default PericiasPage;
