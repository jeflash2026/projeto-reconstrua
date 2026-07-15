// PROCESSO — timeline completa (somente leitura, auditável), documentos, perícia,
// estado/etapa, histórico e os CAMPOS JURÍDICOS do advogado (única escrita).
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import ActivityForm from '../../../components/activity-form';
import EntriesTable from '../../../components/entries-table';
import { API_BASE, getJson, type ProcessDetail } from '../../../lib/api';
import { formatDate, shortId } from '../../../lib/format';

const ProcessoPage = async ({ params }: { params: { id: string } }): Promise<ReactElement> => {
  const data = await getJson<ProcessDetail>(`/advogado/processos/${params.id}`);
  if (!data) {
    return (
      <>
        <h1 className="page-title">Processo</h1>
        <div className="error-box">Processo não atribuído a você, identificação ausente ou API indisponível.</div>
      </>
    );
  }
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title mono">{shortId(data.missionId, 16)}</h1>
      <p className="page-sub">Dados operacionais em somente-leitura; seus registros jurídicos abaixo.</p>

      {data.progress ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Estado / Etapa (acompanhamento)</h3>
          {data.progress.steps.map((s) => (
            <span key={s} className="badge accent" style={{ marginRight: 6 }}>
              {s}
            </span>
          ))}
        </div>
      ) : null}

      <ActivityForm missionId={data.missionId} apiBase={API_BASE} />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Meus registros jurídicos neste processo</h3>
        <EntriesTable entries={data.juridical} emptyText="Nenhum registro jurídico ainda." />
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Documentos ({data.documents.length})</h3>
          {data.documents.length === 0 ? (
            <div className="empty">Nenhum documento.</div>
          ) : (
            data.documents.map((d) => (
              <p key={d.documentId} style={{ margin: '4px 0' }}>
                📄 {d.contentReference ?? shortId(d.documentId)} <span className="mono" style={{ color: 'var(--text-dim)' }}>({formatDate(d.recognizedAt)})</span>
              </p>
            ))
          )}
        </div>
        <div className="card">
          <h3>Perícias ({data.pericias.length})</h3>
          {data.pericias.length === 0 ? (
            <div className="empty">Nenhuma perícia enquadrada.</div>
          ) : (
            data.pericias.map((p) => (
              <p key={p.periciaId} style={{ margin: '4px 0' }} className="mono">
                {shortId(p.periciaId)} — {formatDate(p.framedAt)}
              </p>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h3>Linha do tempo completa (somente leitura, auditável)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Quando</th>
                <th>Evento</th>
                <th>Relevante</th>
                <th>Decisor</th>
                <th>Regra Operacional</th>
              </tr>
            </thead>
            <tbody>
              {data.timeline.map((e) => (
                <tr key={e.globalSeq}>
                  <td className="mono">{e.globalSeq}</td>
                  <td className="mono">{formatDate(e.at)}</td>
                  <td className="mono">{e.eventType}</td>
                  <td>{e.isRelevant ? <span className="badge warn">relevante</span> : <span className="badge dim">informativo</span>}</td>
                  <td>{e.actor ?? '—'}</td>
                  <td className="mono">{e.operationalRuleRef ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ProcessoPage;
