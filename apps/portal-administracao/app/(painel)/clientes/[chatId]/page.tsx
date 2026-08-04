// CLIENTE — visão completa: memória viva, relationship, conversa WhatsApp,
// documentos, missões e situação. Tudo dos read models; tudo rastreável.
import Link from 'next/link';
import { Suspense, type ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import AhriThinking from '../../../../components/ahri-thinking';
import ConversaChat from '../../../../components/conversa-chat';
import Dossie from '../../../../components/dossie';
import DocsEquipe from '../../../../components/docs-equipe';
import JarvisCliente from '../../../../components/jarvis-cliente';
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
  // Decreto 2026-07-31: o CONTATO HUMANO da fase 2 — abre o WhatsApp do DONO na
  // conversa do cliente com a mensagem pronta (quem envia é o humano, nunca a
  // máquina); o parecer visual sai em /parecer para salvar em PDF e anexar.
  const nomeCliente = relationship.knownName ?? 'Cliente';
  const primeiroNome = nomeCliente.split(/\s+/)[0] ?? nomeCliente;
  const telefoneCliente = chatId.split('@')[0]?.replace(/\D/g, '') ?? '';
  const mensagemFase2 =
    `Olá, ${primeiroNome}! Aqui é do *Projeto Reconstrua*. ✅ Já analisamos o seu HISCON e o ` +
    'seu caso é *APTO*: a nossa análise encontrou indícios de irregularidades nos seus ' +
    'contratos de consignado. Agora entramos na fase de coleta dos documentos para um dos ' +
    'nossos advogados representar você: *procuração*, *RG (frente e verso)* e *comprovante ' +
    'de endereço*. Vou te enviar aqui o resumo da análise. Qualquer dúvida, estou à disposição.';
  const linkWhatsApp = `https://wa.me/${telefoneCliente}?text=${encodeURIComponent(mensagemFase2)}`;
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

      {/* Decreto 2026-07-31: fase 2 é contato HUMANO — âncoras cruas levam o
          prefixo /admin explícito (lição do 'ver documento'). */}
      {telefoneCliente.length >= 10 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 16px' }}>
          <a className="btn primary" href={linkWhatsApp} target="_blank" rel="noreferrer">
            📲 Chamar no WhatsApp (mensagem pronta)
          </a>
          <a
            className="btn"
            href={`/admin/parecer/${encodeURIComponent(chatId)}`}
            target="_blank"
            rel="noreferrer"
          >
            🧾 Parecer p/ enviar (salvar PDF)
          </a>
          {/* Decreto 2026-08-04: o guia de agrupamento aplicado, para imprimir
              e conferir com o HISCON original (auditoria da lógica). */}
          <a
            className="btn"
            href={`/admin/acoes/${encodeURIComponent(chatId)}`}
            target="_blank"
            rel="noreferrer"
          >
            ⚖️ Dossiê de Ações (imprimir)
          </a>
        </div>
      ) : null}

      {/* Decreto 2026-07-31: o Jarvis EM CONTEXTO deste cliente — o resgate de
          atendimento travado mora aqui ("retomar o atendimento"). */}
      <JarvisCliente chatId={chatId} />

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
                    {/* Preview: o proxy /admin/api/documento serve os bytes reais
                        (inline). Âncora crua NÃO ganha o basePath do Next — o
                        prefixo /admin vai explícito (mesmo padrão do planilhas-zip);
                        sem ele o clique caía no site e dava 404. */}
                    <a
                      href={`/admin/api/documento/${encodeURIComponent(d.ref)}`}
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

      {/* Decreto 2026-07-31: a CONVERSA em bolhas (cliente ↔ AHRI), com o canal
          do último contato. Nasceu com o canal oficial Meta: o número novo não
          tem aplicativo — o painel é o lugar de ler o diálogo, de TODOS os
          canais. Só inbound/outbound entram no chat (os eventos técnicos vivem
          na Timeline Cognitiva). */}
      <ConversaChat
        canal={data.canal ?? null}
        mensagens={[...conversation]
          .filter((e) => e.kind === 'inbound' || e.kind === 'outbound')
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((e) => ({
            de: e.kind === 'inbound' ? ('cliente' as const) : ('ahri' as const),
            texto: e.text ?? '[documento/mídia enviada]',
            em: e.at,
          }))}
      />
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
