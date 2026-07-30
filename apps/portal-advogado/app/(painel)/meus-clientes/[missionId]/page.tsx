// CLIENTE DESTINADO (decretos 2026-07-29/30) — a página completa do cliente
// que o Administrador destinou a este advogado:
//   • DOSSIÊ JURÍDICO organizado pelos contratos da janela de 5 anos (a MESMA
//     leitura do estudo do perito);
//   • planilha em Excel (CSV Excel-BR) com os contratos organizados pela AHRI;
//   • DOCUMENTOS: os colhidos pelo time (procuração assinada, RG, comprovante)
//     e tudo que o cliente enviou pelo WhatsApp — todos para download.
// O servidor garante o isolamento (403 se o processo não é deste advogado);
// downloads passam pelos proxies autenticados do portal.
import type { ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type ProcessDetail } from '../../../../lib/api';
import { formatDate, shortId } from '../../../../lib/format';

type Doc = ProcessDetail['documents'][number];

interface Estudo {
  quem: string;
  cpf: string | null;
  colunas: string[];
  linhas: (string | number | null)[][];
}

interface DocEquipe {
  id: string;
  tipo: string;
  rotulo: string;
  nome: string;
  mime: string;
  em: string;
}

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

function formatarCpfBr(cpf: string): string {
  return cpf.length === 11
    ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
    : cpf;
}

const ClienteDestinadoPage = async ({
  params,
  searchParams,
}: {
  params: { missionId: string };
  searchParams: { nome?: string };
}): Promise<ReactElement> => {
  const [data, estudo, equipe] = await Promise.all([
    getJson<ProcessDetail>(`/advogado/processos/${params.missionId}`),
    getJson<Estudo>(`/advogado/processos/${params.missionId}/estudo`),
    getJson<{ docs: DocEquipe[] }>(`/advogado/processos/${params.missionId}/docs-equipe`),
  ]);
  const nome = (searchParams.nome ?? '').trim() || estudo?.quem || 'Cliente';
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
  const docsEquipe = equipe?.docs ?? [];
  // A coluna "Linha original" é do arquivo (auditoria) — na TELA ela só polui.
  const idxOculto = estudo?.colunas.findIndex((c) => /linha original/i.test(c)) ?? -1;
  const colunasTela = estudo?.colunas.filter((_, i) => i !== idxOculto) ?? [];
  const linhasTela = estudo?.linhas.map((l) => l.filter((_, i) => i !== idxOculto)) ?? [];

  return (
    <>
      <AutoRefresh seconds={30} />
      <h1 className="page-title">{nome}</h1>
      <p className="page-sub">
        {estudo?.cpf ? `CPF ${formatarCpfBr(estudo.cpf)} · ` : ''}
        Dossiê dos contratos na janela de 5 anos, planilha em Excel e todos os documentos do caso.
      </p>

      {/* ── DOSSIÊ JURÍDICO — os contratos organizados (mesma leitura do perito) ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <h2 style={{ fontSize: 16, margin: 0 }}>
            Dossiê de contratos{estudo ? ` (${estudo.linhas.length})` : ''}
          </h2>
          <a
            className="btn primary"
            href={`/advogado/api/planilha/${encodeURIComponent(params.missionId)}`}
          >
            Baixar planilha (Excel)
          </a>
        </div>
        {!estudo || linhasTela.length === 0 ? (
          <div className="empty">Estudo indisponível para este cliente (HISCON não legível).</div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {colunasTela.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasTela.map((l, i) => (
                  <tr key={i}>
                    {l.map((v, j) => (
                      <td key={j} className={j === 2 ? 'mono' : undefined} style={{ fontSize: 13 }}>
                        {v === null || v === '' ? '—' : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DOCUMENTOS DO CASO — colhidos pelo time (fase 2) ───────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 8 }}>
          Documentos do caso (procuração, RG, comprovante)
        </h2>
        {docsEquipe.length === 0 ? (
          <div className="empty">
            Nenhum documento anexado pela equipe ainda — a coleta da fase 2 aparece aqui.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Arquivo</th>
                  <th>Anexado em</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {docsEquipe.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.rotulo}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {d.nome}
                    </td>
                    <td>{formatDate(d.em)}</td>
                    <td>
                      <a
                        className="btn"
                        href={`/advogado/api/doc-equipe/${encodeURIComponent(params.missionId)}/${encodeURIComponent(d.id)}`}
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
      </div>

      {/* ── DOCUMENTOS DO WHATSAPP — tudo que o cliente enviou ─────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 8 }}>
          Documentos enviados pelo cliente (WhatsApp)
        </h2>
        {docs.length === 0 ? (
          <div className="empty">Nenhum documento recebido deste cliente ainda.</div>
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
      </div>
    </>
  );
};

export default ClienteDestinadoPage;
