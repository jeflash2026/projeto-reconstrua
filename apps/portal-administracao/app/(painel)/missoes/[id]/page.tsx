// MISSÃO — timeline completa e AUDITÁVEL: cada evento com relevância, decisor,
// Regra Operacional e fundamento. Estado/Etapa/Verdade/Operações/Projeções contados.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import AssignForm from '../../../../components/assign-form';
import EncerrarForm from '../../../../components/encerrar-form';
import { getJson, type MissionDetail, type StaffData } from '../../../../lib/api';
import { formatDate, shortId } from '../../../../lib/format';

const MissionPage = async ({ params }: { params: { id: string } }): Promise<ReactElement> => {
  const data = await getJson<MissionDetail>(`/admin/missions/${params.id}`);
  if (!data) {
    return (
      <>
        <h1 className="page-title">Missão</h1>
        <div className="error-box">Missão não encontrada ou API indisponível.</div>
      </>
    );
  }
  const staff = await getJson<StaffData>('/admin/staff/advogado');
  const advogados = (staff?.members ?? []).filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const count = (type: string): number => data.timeline.filter((e) => e.streamType === type).length;
  return (
    <>
      <AutoRefresh seconds={5} />
      <h1 className="page-title mono">{shortId(data.missionId, 16)}</h1>
      <p className="page-sub">
        Cliente:{' '}
        {data.chatId ? (
          <Link href={`/clientes/${encodeURIComponent(data.chatId)}`} className="mono" style={{ color: 'var(--accent)' }}>
            {data.chatId}
          </Link>
        ) : (
          '—'
        )}
      </p>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="value">{count('operational-truth')}</div><div className="label">Verdades Operacionais</div></div>
        <div className="card stat"><div className="value">{count('operational-state')}</div><div className="label">Estados</div></div>
        <div className="card stat"><div className="value">{count('operational-stage')}</div><div className="label">Etapas</div></div>
        <div className="card stat"><div className="value">{count('operation')}</div><div className="label">Operações</div></div>
        <div className="card stat"><div className="value">{count('projection')}</div><div className="label">Projeções</div></div>
        <div className="card stat"><div className="value">{count('document')}</div><div className="label">Documentos</div></div>
      </div>

      <AssignForm missionId={data.missionId} advogados={advogados} />

      <EncerrarForm missionId={data.missionId} />

      {data.progress ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Acompanhamento (workflow)</h3>
          {data.progress.steps.map((s) => (
            <span key={s} className="badge accent" style={{ marginRight: 6 }}>
              {s}
            </span>
          ))}
        </div>
      ) : null}

      <div className="card">
        <h3>Timeline completa (auditável)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Quando</th>
                <th>Evento</th>
                <th>Stream</th>
                <th>Relevante</th>
                <th>Decisor</th>
                <th>Regra Operacional</th>
                <th>Fundamento</th>
              </tr>
            </thead>
            <tbody>
              {data.timeline.map((e) => (
                <tr key={e.globalSeq}>
                  <td className="mono">{e.globalSeq}</td>
                  <td className="mono">{formatDate(e.at)}</td>
                  <td className="mono">{e.eventType}</td>
                  <td>
                    <span className="badge dim">{e.streamType}</span>
                  </td>
                  <td>{e.isRelevant ? <span className="badge warn">relevante</span> : <span className="badge dim">informativo</span>}</td>
                  <td>{e.actor ?? '—'}</td>
                  <td className="mono">{e.operationalRuleRef ?? '—'}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>{e.fundamento ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default MissionPage;
