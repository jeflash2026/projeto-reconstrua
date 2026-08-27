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
import CredenciaisPedido from '../../../../components/credenciais-pedido';
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

/** Dossiê de integridade do Corvo (2026-08-27) — prova da cadeia de envio aos
 *  bancos (.eml originais + hashes), para juntar ao processo. */
interface DossieCorvoVersao {
  hashRaiz: string;
  geradoEm: string;
  nomeArquivo: string;
  tamanho: number;
  resumo: { envios: number | null; respostas: number | null };
}

// ── DOSSIÊ DE AÇÕES (decreto 2026-08-04): o guia de classificação e
//    agrupamento aplicado — cada ação com a REGRA que a formou, legível. ──────
interface ContratoDaAcao {
  contrato: string;
  situacao: string | null;
  dataInclusao: string | null;
  dataPrimeiroDesconto: string | null;
  valorEmprestado: number | null;
  valorParcela: number | null;
  migrado: boolean;
}

interface AcaoDossie {
  numero: number;
  categoria: 'ATIVOS' | 'EXCLUIDOS' | 'RMC' | 'RCC';
  banco: string;
  contratos: ContratoDaAcao[];
  regra: string;
}

interface DossieAcoes {
  nomeCliente: string | null;
  agrupamento: {
    acoes: AcaoDossie[];
    resumo: {
      totalAcoes: number;
      totalContratos: number;
      contratosSelecionados?: number;
      porCategoria: Record<'ATIVOS' | 'EXCLUIDOS' | 'RMC' | 'RCC', number>;
    };
  };
}

const ROTULO_CATEGORIA: Record<AcaoDossie['categoria'], string> = {
  ATIVOS: 'Contratos Ativos',
  EXCLUIDOS: 'Não-ativos (lote 3 = 1)',
  RMC: 'RMC — Reserva de Margem Consignável',
  RCC: 'RCC — Reserva de Cartão Consignado',
};

function moeda(v: number | null): string {
  return v === null
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function dataCurtaBr(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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
  // Timeouts (caso Gracielle, 2026-08-05): estudo e ações parseiam o HISCON —
  // folga de 45s no pior caso frio; o resto é leve. A página SEMPRE abre; a
  // seção que expirar mostra "indisponível" e volta no refresh.
  const [data, estudo, equipe, acoes, dossieCorvo] = await Promise.all([
    getJson<ProcessDetail>(`/advogado/processos/${params.missionId}`, 20000),
    getJson<Estudo>(`/advogado/processos/${params.missionId}/estudo`, 45000),
    getJson<{ docs: DocEquipe[] }>(`/advogado/processos/${params.missionId}/docs-equipe`, 20000),
    getJson<DossieAcoes>(`/advogado/processos/${params.missionId}/acoes`, 45000),
    getJson<{ dossies: DossieCorvoVersao[] }>(
      `/advogado/processos/${params.missionId}/dossie-corvo`,
      20000,
    ),
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

      {/* ── DOSSIÊ DE AÇÕES (decreto 2026-08-04) — o guia de classificação e
          agrupamento que a AHRI aplicou, com a regra de cada ação explicada:
          ativos 1=1 (mesmo banco + mesmo dia agrupam), excluídos por ano e
          banco, RMC/RCC sempre separados. ─────────────────────────────────── */}
      {acoes !== null && acoes.agrupamento.acoes.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 4 }}>
            Dossiê de Processos — {acoes.agrupamento.resumo.totalContratos} contrato(s) ·{' '}
            {acoes.agrupamento.resumo.totalAcoes} processo(s)
          </h2>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Como a AHRI classificou os contratos da janela de 5 anos, pelo guia do escritório:
            contratos ATIVOS = 1 processo cada; NÃO-ATIVOS formam lotes de 3 contratos do mesmo
            banco + mesmo ano = 1 processo (teto de 15 processos por banco, sempre dos maiores
            valores para os menores; a sobra que não fecha trio fica fora); RMC e RCC sempre em
            processos separados. São estes contratos que compõem o estudo e o potencial.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {(['ATIVOS', 'EXCLUIDOS', 'RMC', 'RCC'] as const).map((cat) =>
              acoes.agrupamento.resumo.porCategoria[cat] > 0 ? (
                <span key={cat} className="badge">
                  {ROTULO_CATEGORIA[cat]}:{' '}
                  <strong>{acoes.agrupamento.resumo.porCategoria[cat]}</strong>
                </span>
              ) : null,
            )}
          </div>
          {acoes.agrupamento.acoes.map((a) => (
            <div
              key={a.numero}
              className="card"
              style={{ marginBottom: 10, background: 'var(--bg-elev, rgba(0,0,0,0.03))' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <strong>
                  Processo {a.numero} · {ROTULO_CATEGORIA[a.categoria]}
                </strong>
                {/* BANCO EM DESTAQUE (pedido do dono, 2026-08-05): o réu do
                    processo salta aos olhos — chip dourado, não um selo miúdo. */}
                <span
                  style={{
                    background: 'var(--accent, #d4a437)',
                    color: '#1b1b20',
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: '0.02em',
                    padding: '4px 14px',
                    borderRadius: 8,
                    whiteSpace: 'nowrap',
                  }}
                >
                  🏦 {a.banco}
                </span>
              </div>
              <div style={{ fontSize: 13, margin: '4px 0 8px', color: 'var(--text-dim, #667)' }}>
                {a.regra}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Contrato</th>
                      <th>Situação</th>
                      <th>Data</th>
                      <th>Valor emprestado</th>
                      <th>Parcela</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.contratos.map((c) => (
                      <tr key={c.contrato}>
                        <td className="mono">{c.contrato}</td>
                        <td>
                          {c.situacao ?? '—'}
                          {c.migrado ? ' · MIGRADO' : ''}
                        </td>
                        <td>{dataCurtaBr(c.dataInclusao ?? c.dataPrimeiroDesconto)}</td>
                        <td>{moeda(c.valorEmprestado)}</td>
                        <td>{moeda(c.valorParcela)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* CREDENCIAIS DO PEDIDO (decisão do dono, 2026-08-13): a caixa por onde o
          banco responde a este pedido. A senha só é buscada no clique — nunca
          no carregamento — e cada revelação fica registrada no servidor. */}
      <CredenciaisPedido missionId={params.missionId} />

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

      {/* ── DOSSIÊ DE INTEGRIDADE (Corvo, 2026-08-27) — o pacote de PROVA da
          cadeia de notificação extrajudicial aos bancos (.eml originais com
          anexos + hashes), para juntar ao processo. Cada versão é preservada:
          o dossiê cresce conforme os bancos respondem. ─────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 4 }}>
          Dossiê de integridade — notificações aos bancos
        </h2>
        <p className="page-sub" style={{ marginTop: 0 }}>
          Pacote de prova da correspondência extrajudicial (e-mails originais enviados a cada banco,
          respostas recebidas e hashes de integridade). O RELATORIO.html dentro do ZIP é imprimível
          para anexar ao processo; o hash-raiz certifica que nada foi alterado.
        </p>
        {(dossieCorvo?.dossies ?? []).length === 0 ? (
          <div className="empty">
            Ainda sem dossiê — ele aparece aqui quando os bancos deste cliente são notificados.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Gerado em</th>
                  <th>Envios / respostas</th>
                  <th>Hash-raiz (integridade)</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {(dossieCorvo?.dossies ?? []).map((d, i) => (
                  <tr key={d.hashRaiz}>
                    <td style={{ fontWeight: i === 0 ? 600 : 400 }}>
                      {d.geradoEm !== '' ? formatDate(d.geradoEm) : '—'}
                      {i === 0 ? ' · atual' : ''}
                    </td>
                    <td>
                      {d.resumo.envios ?? '—'} / {d.resumo.respostas ?? '—'}
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {d.hashRaiz}
                    </td>
                    <td>
                      <a
                        className="btn"
                        href={`/advogado/api/dossie-corvo/${encodeURIComponent(params.missionId)}/${encodeURIComponent(d.hashRaiz)}`}
                      >
                        Baixar ZIP ({Math.round(d.tamanho / 1024)} KB)
                      </a>
                    </td>
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
          Documentos do caso (procuração, RG, comprovante, extrato INSS)
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
                {/* NUMERAÇÃO POR TIPO (caso Cornélio, 2026-08-18): as duas faces
                    do RG confirmadas de foto chegavam com o MESMO nome — duas
                    linhas idênticas liam-se como duplicata, o advogado baixava
                    uma e concluía que o RG veio incompleto. "RG (1 de 2)" e
                    "RG (2 de 2)" dizem que são arquivos DIFERENTES. */}
                {docsEquipe.map((d) => {
                  const doTipo = docsEquipe.filter((x) => x.tipo === d.tipo);
                  const n = doTipo.findIndex((x) => x.id === d.id) + 1;
                  const rotulo =
                    doTipo.length > 1
                      ? `${d.rotulo} (${String(n)} de ${String(doTipo.length)})`
                      : d.rotulo;
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{rotulo}</td>
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
                  );
                })}
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
