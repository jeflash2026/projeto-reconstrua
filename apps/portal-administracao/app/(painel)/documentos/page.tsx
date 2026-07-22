// DOCUMENTOS — reconhecidos (com origem/vínculo/status) e pendências por cliente.
// OCR/conteúdo: a referência probatória preservada é exibida; o blob é do MediaStore.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson, type DocumentsData } from '../../../lib/api';
import { formatDate, shortId } from '../../../lib/format';

const DocumentsPage = async (): Promise<ReactElement> => {
  const data = await getJson<DocumentsData>('/admin/documents');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Documentos</h1>
      <p className="page-sub">
        Reconhecimento é ato de domínio (R3); pendências vêm da memória viva.
      </p>
      {!data ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <div className="grid two">
          <div className="card">
            <h3>Reconhecidos ({data.recognized.length})</h3>
            {data.recognized.length === 0 ? (
              <div className="empty">Nenhum documento reconhecido.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Conteúdo (referência)</th>
                      <th>Tipo</th>
                      <th>Missão</th>
                      <th>Reconhecido em</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recognized.map((d) => (
                      <tr key={d.documentId}>
                        <td className="mono">{shortId(d.documentId, 10)}</td>
                        <td>{d.contentReference ?? '—'}</td>
                        <td>{d.mimeType ?? '—'}</td>
                        <td>
                          {d.missionId ? (
                            <Link
                              href={`/missoes/${d.missionId}`}
                              className="mono"
                              style={{ color: 'var(--accent)' }}
                            >
                              {shortId(d.missionId, 10)}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{formatDate(d.recognizedAt)}</td>
                        <td>
                          <span className="badge ok">{d.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card">
            <h3>Pendências ({data.pending.length})</h3>
            {data.pending.length === 0 ? (
              <div className="empty">Nenhuma pendência.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Documento aguardado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pending.map((p, i) => (
                      <tr key={i}>
                        <td className="mono">
                          <Link
                            href={`/clientes/${encodeURIComponent(p.chatId)}`}
                            style={{ color: 'var(--accent)' }}
                          >
                            {p.chatId}
                          </Link>
                        </td>
                        <td>
                          <span className="badge warn">{p.document}</span>
                        </td>
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

export default DocumentsPage;
