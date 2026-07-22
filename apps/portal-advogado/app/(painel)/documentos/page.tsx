// DOCUMENTOS — documentos reconhecidos NOS SEUS processos (read model filtrado).
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson } from '../../../lib/api';
import { formatDate, shortId } from '../../../lib/format';

interface Doc {
  documentId: string;
  missionId: string | null;
  contentReference: string | null;
  mimeType: string | null;
  recognizedAt: string;
}

const DocumentosPage = async (): Promise<ReactElement> => {
  const docs = await getJson<Doc[]>('/advogado/documentos');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Documentos</h1>
      <p className="page-sub">Documentos reconhecidos nos processos atribuídos a você.</p>
      {!docs ? (
        <div className="error-box">
          API indisponível ou identificação ausente (defina no Perfil).
        </div>
      ) : docs.length === 0 ? (
        <div className="card empty">Nenhum documento nos seus processos.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Referência</th>
                <th>Tipo</th>
                <th>Processo</th>
                <th>Reconhecido em</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.documentId}>
                  <td className="mono">{shortId(d.documentId)}</td>
                  <td>{d.contentReference ?? '—'}</td>
                  <td>{d.mimeType ?? '—'}</td>
                  <td className="mono">{d.missionId ? shortId(d.missionId) : '—'}</td>
                  <td>{formatDate(d.recognizedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default DocumentosPage;
