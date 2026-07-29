// DOCUMENTOS DO CLIENTE (decreto 2026-07-29) — tudo o que o cliente enviou pelo
// WhatsApp, para download. O servidor garante o isolamento (403 se o processo
// não é deste advogado); o download passa pelo proxy autenticado do portal.
import type { ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type ProcessDetail } from '../../../../lib/api';
import { formatDate, shortId } from '../../../../lib/format';

type Doc = ProcessDetail['documents'][number];

/** Rótulo humano do documento (a referência de imagem é uma URL gigante). */
function rotulo(d: Doc): string {
  const ref = d.contentReference ?? '';
  if (ref !== '' && !ref.startsWith('http')) return ref; // nome real do arquivo (PDFs)
  if ((d.mimeType ?? '').startsWith('image/')) return `Foto recebida (${shortId(d.documentId, 8)})`;
  return `Documento (${shortId(d.documentId, 8)})`;
}

/** Nome do arquivo baixado — extensão pelo MIME quando a referência é URL. */
function nomeDoArquivo(d: Doc): string {
  const ref = d.contentReference ?? '';
  if (ref !== '' && !ref.startsWith('http')) return ref;
  const ext = d.mimeType === 'application/pdf' ? 'pdf' : d.mimeType === 'image/png' ? 'png' : 'jpg';
  return `documento-${d.documentId.slice(0, 8)}.${ext}`;
}

const ClienteDocumentosPage = async ({
  params,
  searchParams,
}: {
  params: { missionId: string };
  searchParams: { nome?: string };
}): Promise<ReactElement> => {
  const data = await getJson<ProcessDetail>(`/advogado/processos/${params.missionId}`);
  const nome = (searchParams.nome ?? '').trim() || 'Cliente';
  if (!data) {
    return (
      <>
        <h1 className="page-title">{nome}</h1>
        <div className="error-box">
          Cliente não destinado a você, identificação ausente ou API indisponível.
        </div>
      </>
    );
  }
  const docs = [...data.documents].sort((a, b) => b.recognizedAt.localeCompare(a.recognizedAt));
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">{nome}</h1>
      <p className="page-sub">
        Todos os documentos que o cliente enviou pelo WhatsApp — clique em Baixar para salvar o
        arquivo original.
      </p>
      {docs.length === 0 ? (
        <div className="card empty">Nenhum documento recebido deste cliente ainda.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Tipo</th>
                <th>Recebido em</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.documentId}>
                  <td>{rotulo(d)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {d.mimeType ?? '—'}
                  </td>
                  <td>{formatDate(d.recognizedAt)}</td>
                  <td>
                    <a
                      className="btn"
                      href={`/advogado/api/doc/${encodeURIComponent(params.missionId)}/${encodeURIComponent(d.documentId)}?f=${encodeURIComponent(nomeDoArquivo(d))}`}
                    >
                      Baixar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default ClienteDocumentosPage;
