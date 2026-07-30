// CLIENTE — visão completa: memória viva, relationship, conversa WhatsApp,
// documentos, missões e situação. Tudo dos read models; tudo rastreável.
import Link from 'next/link';
import { Suspense, type ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import AhriThinking from '../../../../components/ahri-thinking';
import Dossie from '../../../../components/dossie';
import DocsEquipe from '../../../../components/docs-equipe';
import PericiaHiscon from '../../../../components/pericia-hiscon';
import TimelineCognitiva from '../../../../components/timeline-cognitiva';
import { getJson, type ClientDetail } from '../../../../lib/api';
import { formatDate, formatMs, shortId } from '../../../../lib/format';

/** CPF legível (000.000.000-00). Só formata; nunca inventa dígito. */
function formatarCpf(cpf: string | null | undefined): string | null {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const ClientPage = async ({ params }: { params: { chatId: string } }): Promise<ReactElement> => {
  const chatId = decodeURIComponent(params.chatId);
  const data = await getJson<ClientDetail>(`/admin/clients/${encodeURIComponent(chatId)}`);
  if (!data) {
    return (
      <>
        <h1 className="page-title">Cliente</h1>
        <div className="error-box">Cliente não encontrado ou API indisponível.</div>
      </>
    );
  }
  const { memory, relationship, conversation, missions } = data;
  // Decreto 2026-07-26: o CPF é dado de trabalho do PERITO (sem ele não há
  // pedido administrativo). Fica visível já no topo do cadastro.
  const cpfLegivel = formatarCpf(data.cpf);
  return (
    <>
      <AutoRefresh seconds={5} />
      <h1 className="page-title">{relationship.knownName ?? 'Cliente'}</h1>
      <p className="page-sub mono">{chatId}</p>
      <p className="page-sub" style={{ marginTop: -6 }}>
        CPF:{' '}
        {cpfLegivel !== null ? (
          <strong className="mono">{cpfLegivel}</strong>
        ) : (
          <span className="badge">não informado — a perícia precisa dele para os pedidos</span>
        )}
      </p>

      {/* GO-LIVE 13A — ORDEM NATURAL DO TRABALHO: primeiro o parecer, depois a
          história do caso, e só então a conversa completa e os documentos.
          14A — estados VIVOS enquanto a AHRI monta cada peça (streaming). */}
      <Suspense fallback={<AhriThinking label="Gerando o Dossiê Jurídico" />}>
        <Dossie chatId={chatId} />
      </Suspense>
      {/* Decreto Dossiê Pericial: o HISCON parseado — contratos por banco,
          migrados e indícios — a mesa de trabalho do PERITO. */}
      <Suspense fallback={<AhriThinking label="Lendo o HISCON (contratos por banco)" />}>
        <PericiaHiscon chatId={chatId} />
      </Suspense>
      {/* Decreto 2026-07-30: fase 2 HUMANA — o time anexa procuração assinada,
          RG e comprovante; o advogado destinado baixa tudo no portal dele. */}
      <DocsEquipe chatId={chatId} />
      <Suspense fallback={<AhriThinking label="Reconstruindo a Timeline Cognitiva" />}>
        <TimelineCognitiva chatId={chatId} />
      </Suspense>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Situação (relationship)</h3>
          <p style={{ marginTop: 0 }}>{relationship.summary}</p>
          <dl className="kv">
            <dt>Início</dt>
            <dd>{formatDate(relationship.startedAt)}</dd>
            <dt>Mensagens</dt>
            <dd>{memory.messageCount}</dd>
            <dt>Velocidade de resposta</dt>
            <dd>{formatMs(memory.avgResponseMs)}</dd>
            <dt>Estilo de conversa</dt>
            <dd>{memory.conversationStyle ?? '—'}</dd>
            <dt>Docs pendentes</dt>
            <dd>
              {memory.documentsPending.length === 0 ? 'nenhum' : memory.documentsPending.join(', ')}
            </dd>
          </dl>
        </div>
        <div className="card">
          <h3>Memória — o que a AHRI lembra (com fonte)</h3>
          {memory.attributes.length === 0 ? (
            <div className="empty">Nada registrado ainda.</div>
          ) : (
            <dl className="kv">
              {memory.attributes.map((a) => (
                <ClientAttr
                  key={`${a.key}-${a.source.at}`}
                  k={a.key}
                  v={a.value}
                  src={a.source.ref}
                />
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Missões</h3>
          {missions.length === 0 ? (
            <div className="empty">Nenhuma missão.</div>
          ) : (
            missions.map((m) => (
              <p key={m.missionId} style={{ margin: '4px 0' }}>
                <Link
                  href={`/missoes/${m.missionId}`}
                  className="mono"
                  style={{ color: 'var(--accent)' }}
                >
                  {shortId(m.missionId, 12)}
                </Link>{' '}
                {m.progress
                  ? m.progress.steps.map((s) => (
                      <span key={s} className="badge accent" style={{ marginLeft: 4 }}>
                        {s}
                      </span>
                    ))
                  : null}
              </p>
            ))
          )}
        </div>
        <div className="card">
          <h3>Documentos enviados / acontecimentos</h3>
          {memory.documentsSent.length === 0 && memory.rememberedEvents.length === 0 ? (
            <div className="empty">Nenhum registro.</div>
          ) : (
            <ul className="timeline">
              {memory.documentsSent.map((d) => (
                <li key={`${d.ref}-${d.source.at}`}>
                  <span className="when">{formatDate(d.source.at)}</span>
                  <div>
                    📄 {d.label}{' '}
                    {/* Preview: o proxy /api/documento serve os bytes reais (inline). */}
                    <a
                      href={`/api/documento/${encodeURIComponent(d.ref)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)', fontSize: 12 }}
                    >
                      ver documento
                    </a>
                  </div>
                </li>
              ))}
              {memory.rememberedEvents.map((e) => (
                <li key={`${e.description}-${e.source.at}`}>
                  <span className="when">{formatDate(e.source.at)}</span>
                  <div>{e.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Conversa WhatsApp (linha do tempo)</h3>
        {conversation.length === 0 ? (
          <div className="empty">Sem mensagens.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Tipo</th>
                  <th>Conteúdo</th>
                  <th>Regra Operacional</th>
                </tr>
              </thead>
              <tbody>
                {conversation.map((e, i) => (
                  <tr key={i}>
                    <td className="mono">{formatDate(e.at)}</td>
                    <td>
                      <span
                        className={`badge ${e.kind === 'inbound' ? 'accent' : e.kind === 'outbound' ? 'ok' : 'dim'}`}
                      >
                        {e.kind}
                      </span>
                      {e.intentDirective ? (
                        <span className="badge dim" style={{ marginLeft: 4 }}>
                          {e.intentDirective}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>{e.text ?? '—'}</td>
                    <td className="mono">{e.operationalRuleRef ?? '—'}</td>
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

const ClientAttr = ({ k, v, src }: { k: string; v: string; src: string }): ReactElement => (
  <>
    <dt>{k}</dt>
    <dd>
      {v}{' '}
      <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11 }}>
        (fonte: {shortId(src, 10)})
      </span>
    </dd>
  </>
);

export default ClientPage;
