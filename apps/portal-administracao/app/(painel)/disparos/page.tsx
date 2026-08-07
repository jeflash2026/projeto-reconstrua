// DISPAROS (2026-08-06) — decreto do dono: nada automático; o lote da
// APRESENTAÇÃO (template aprovado da Meta) só sai DAQUI, com a confirmação
// explícita do Admin. Alvo: documentação enviada + incompleto + o cliente não
// respondeu no canal da equipe depois do envio. Trava de 24h contra duplicado.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import DispararApresentacao from '../../../components/disparar-apresentacao';
import DispararFase1 from '../../../components/disparar-fase1';

interface AlvoFase1 {
  chatId: string;
  nome: string;
  contratos: number;
  jaDisparadoHoje: boolean;
}

interface AlvoDisparo {
  chatId: string;
  nome: string;
  telefone: string;
  uf: string;
  jaDisparadoHoje: boolean;
  /** Cobrança cirúrgica (2026-08-07): o que falta e o template escolhido. */
  faltantes?: string[];
  template?: 'contato_equipe' | 'documentos_pendentes';
}

const DisparosPage = async ({
  searchParams,
}: {
  searchParams: { uf?: string };
}): Promise<ReactElement> => {
  const [data, fase1Data] = await Promise.all([
    getJson<{ alvos: AlvoDisparo[] }>('/admin/humanizado/disparo'),
    getJson<{ alvos: AlvoFase1[] }>('/admin/reaquecimento/fase1'),
  ]);
  const fase1 = fase1Data?.alvos ?? null;
  const fase1Elegiveis = fase1?.filter((a) => !a.jaDisparadoHoje) ?? [];
  const todos = data?.alvos ?? null;
  // Recorte por ESTADO (2026-08-07): chips de UF — o lote sai só do estado
  // escolhido; "Todos" dispara a fila inteira.
  const ufEscolhida = (searchParams.uf ?? '').trim().toUpperCase() || null;
  const porUf = new Map<string, number>();
  for (const a of todos ?? []) porUf.set(a.uf || 'SEM UF', (porUf.get(a.uf || 'SEM UF') ?? 0) + 1);
  const ufValida = ufEscolhida !== null && porUf.has(ufEscolhida);
  const uf = ufValida ? ufEscolhida : null;
  const alvos = todos === null ? null : uf === null ? todos : todos.filter((a) => a.uf === uf);
  const elegiveis = alvos?.filter((a) => !a.jaDisparadoHoje) ?? [];

  return (
    <>
      <h1 className="page-title">Disparos</h1>
      <p className="page-sub">
        O lote diário da Layara para quem está com documentação pendente e sem retorno no canal da
        equipe. O sistema escolhe o template pela FASE de cada cliente: quem não entregou nada
        recebe a apresentação completa; quem entregou parte recebe a cobrança SÓ do que falta. Nada
        sai sem a sua confirmação; quem recebeu template nas últimas 24h fica fora sozinho.
      </p>
      {alvos === null || todos === null ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <>
          {/* ── FILTRO POR ESTADO: o lote respeita a UF escolhida ─────────── */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <a className={`badge${uf === null ? ' ok' : ''}`} href="/admin/disparos">
              Todos ({todos.length})
            </a>
            {[...porUf.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([sigla, quantos]) => (
                <a
                  key={sigla}
                  className={`badge${uf === sigla ? ' ok' : ''}`}
                  href={`/admin/disparos?uf=${encodeURIComponent(sigla)}`}
                >
                  {sigla} ({quantos})
                </a>
              ))}
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <DispararApresentacao elegiveis={elegiveis.length} uf={uf} />
          </div>
          <div className="card">
            <h3>Fila do disparo ({alvos.length})</h3>
            <p className="page-sub">
              Documentação enviada, incompletos e sem resposta do cliente após o envio.
            </p>
            {alvos.length === 0 ? (
              <div className="empty">Ninguém na fila — todos responderam ou completaram.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>WhatsApp</th>
                      <th>UF</th>
                      <th>O que falta</th>
                      <th>Mensagem que vai</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alvos.map((a) => (
                      <tr key={a.chatId}>
                        <td style={{ fontWeight: 600 }}>{a.nome}</td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {a.telefone}
                        </td>
                        <td>{a.uf}</td>
                        <td style={{ fontSize: 12 }}>
                          {(a.faltantes ?? []).length > 0 ? (a.faltantes ?? []).join(', ') : '—'}
                        </td>
                        <td>
                          {a.template === 'documentos_pendentes' ? (
                            <span className="badge warn">cobrança do que falta</span>
                          ) : (
                            <span className="badge">apresentação completa</span>
                          )}
                        </td>
                        <td>
                          {a.jaDisparadoHoje ? (
                            <span className="badge">template nas últimas 24h — fora do lote</span>
                          ) : (
                            <span className="badge ok">entra no lote</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── REAQUECIMENTO FASE 1 (2026-08-07): lead com HISCON legível que
          nunca confirmou o interesse — o template da AHRI reabre a conversa e
          a resposta retoma o funil sozinha, do ponto em que ele parou. ─────── */}
      <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 24 }}>
        🔥 Reaquecimento da Fase 1 (AHRI)
      </h2>
      <p className="page-sub">
        Leads com HISCON legível que ainda não confirmaram o interesse. O template
        `reaquecimento_fase1` sai pelo número oficial da AHRI; quando o lead responde, a AHRI
        continua o atendimento automaticamente. Trava de 24h contra duplicado.
      </p>
      {fase1 === null ? (
        <div className="error-box">Fila da fase 1 indisponível.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <DispararFase1 elegiveis={fase1Elegiveis.length} />
          </div>
          <div className="card">
            <h3>Fila da fase 1 ({fase1.length})</h3>
            {fase1.length === 0 ? (
              <div className="empty">Nenhum lead parado com HISCON legível — funil em dia.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Contratos no HISCON</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fase1.slice(0, 60).map((a) => (
                      <tr key={a.chatId}>
                        <td style={{ fontWeight: 600 }}>{a.nome}</td>
                        <td>{a.contratos}</td>
                        <td>
                          {a.jaDisparadoHoje ? (
                            <span className="badge">reaquecido nas últimas 24h</span>
                          ) : (
                            <span className="badge ok">entra no lote</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fase1.length > 60 ? (
                  <p className="page-sub">… e mais {fase1.length - 60} lead(s) na fila.</p>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default DisparosPage;
