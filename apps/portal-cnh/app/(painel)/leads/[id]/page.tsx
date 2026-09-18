// LEAD (2026-09-18) — a conversa ao vivo, a ficha que a AHRI apurou pelo
// roteiro, as ações da equipe e o histórico assinado. Atualiza a cada 10 s.
import Link from 'next/link';
import type { ReactElement } from 'react';
import { AcoesLead } from '../../../../components/acoes-lead';
import { AtualizarAuto } from '../../../../components/atualizar-auto';
import {
  HONORARIOS,
  ROTULO_ETAPA,
  ROTULO_ORIGEM,
  ROTULO_SITUACAO,
  getJson,
  haQuanto,
  horaBr,
  reais,
  telefoneBr,
  type FichaCnh,
  type LeadCnh,
} from '../../../../lib/api';

export const dynamic = 'force-dynamic';

const JANELA_MS = 24 * 60 * 60 * 1000 - 10 * 60 * 1000;

const simNao = (v: boolean | null): string => (v === null ? '—' : v ? 'Sim' : 'Não');

const Ficha = ({ f }: { f: FichaCnh }): ReactElement => (
  <dl className="ficha">
    <dt>Cidade</dt>
    <dd>{f.cidade ?? '—'}</dd>
    <dt>Já tem advogado</dt>
    <dd>{simNao(f.jaTemAdvogado)}</dd>
    <dt>Situação</dt>
    <dd>{f.situacao !== null ? (ROTULO_SITUACAO[f.situacao] ?? f.situacao) : '—'}</dd>
    {f.relato !== null ? (
      <>
        <dt>Relato</dt>
        <dd style={{ fontWeight: 400 }}>{f.relato}</dd>
      </>
    ) : null}
    <dt>Carta do DETRAN</dt>
    <dd>
      {f.cartaDetran === 'recente'
        ? 'Recente (até 120 dias)'
        : f.cartaDetran === 'antiga'
          ? 'Antiga'
          : f.cartaDetran === 'nao-recebeu'
            ? 'Não recebeu'
            : '—'}
      {f.cartaDetranQuando !== null ? ` · ${f.cartaDetranQuando}` : ''}
    </dd>
    <dt>Motorista profissional</dt>
    <dd>
      {simNao(f.motoristaProfissional)}
      {f.atividade !== null ? ` · ${f.atividade}` : ''}
    </dd>
    <dt>Notificações anteriores</dt>
    <dd>
      {f.notificacoesAnteriores === 'nenhuma-ou-poucas'
        ? 'Nenhuma ou poucas (tese forte)'
        : f.notificacoesAnteriores === 'todas'
          ? 'Recebeu todas'
          : f.notificacoesAnteriores === 'nao-lembra'
            ? 'Não lembra'
            : '—'}
    </dd>
    {f.situacao === 'indicacao-condutor' ? (
      <>
        <dt>Indicação no prazo</dt>
        <dd>{simNao(f.indicacaoNoPrazo)}</dd>
      </>
    ) : null}
    <dt>Possível prescrição</dt>
    <dd>{simNao(f.prescricaoPossivel)}</dd>
    <dt>Prazo curto</dt>
    <dd style={f.prazoCurto === true ? { color: 'var(--ruim)' } : undefined}>
      {f.prazoCurto === true
        ? 'Sim — suspensão perto de começar ou prazo acabando'
        : simNao(f.prazoCurto ?? null)}
    </dd>
    <dt>Documentos em mãos</dt>
    <dd>{simNao(f.temDocumentos)}</dd>
    <dt>Tipo de caso</dt>
    <dd>
      {f.tipoCaso === null
        ? '—'
        : `${f.tipoCaso === 'cassacao' ? 'Cassação' : 'Suspensão'} · ${reais(HONORARIOS[f.tipoCaso])}`}
    </dd>
  </dl>
);

export default async function LeadPage({
  params,
}: {
  params: { id: string };
}): Promise<ReactElement> {
  const id = params.id.replace(/\D/g, '');
  const lead = await getJson<LeadCnh>(`/cnh-api/admin/leads/${id}`);
  if (lead === null)
    return (
      <>
        <Link className="btn" href="/">
          ← Funil
        </Link>
        <div className="erro" style={{ marginTop: 14 }}>
          Lead não encontrado (ou o serviço da CNH não respondeu).
        </div>
      </>
    );

  const dentroDaJanela =
    lead.ultimaDoClienteEm !== null &&
    Date.now() - new Date(lead.ultimaDoClienteEm).getTime() < JANELA_MS;

  return (
    <>
      <AtualizarAuto segundos={10} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn" href="/">
          ← Funil
        </Link>
        <span className={`selo etapa-${lead.etapa}`}>{ROTULO_ETAPA[lead.etapa]}</span>
        <span className={`selo ${lead.modo === 'ahri' ? 'ahri' : 'humano'}`}>
          {lead.modo === 'ahri' ? 'AHRI atendendo' : 'Com a equipe'}
        </span>
        {lead.urgente ? <span className="selo ruim">URGENTE</span> : null}
      </div>
      <h1 className="titulo" style={{ marginTop: 12 }}>
        {lead.ficha.nome ?? telefoneBr(lead.id)}
      </h1>
      <p className="subtitulo">
        {telefoneBr(lead.id)} · primeiro contato {horaBr(lead.criadoEm)} · última mensagem do
        cliente {haQuanto(lead.ultimaDoClienteEm)}
        {lead.resumo !== null ? ` · ${lead.resumo}` : ''}
      </p>
      {lead.atencao !== null ? (
        <div className="erro" style={{ marginTop: 0, marginBottom: 14 }}>
          {lead.atencao}
        </div>
      ) : null}

      <div className="lead-grade">
        <div className="cartao">
          <h2>Conversa</h2>
          {/* column-reverse: a conversa abre já na mensagem mais recente. */}
          <div className="conversa">
            {lead.conversa.length === 0 ? <div className="vazio">Sem mensagens.</div> : null}
            {[...lead.conversa].reverse().map((m) => (
              <div key={m.id} className={`bolha ${m.de}`}>
                {m.mediaId !== null ? (
                  <a
                    href={`/cnh/api/midia/${lead.id}/${encodeURIComponent(m.mediaId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.texto} — abrir
                  </a>
                ) : (
                  m.texto
                )}
                <span className="meta">
                  {m.de === 'cliente'
                    ? 'Cliente'
                    : m.de === 'ahri'
                      ? 'AHRI'
                      : (m.autor ?? 'Equipe')}{' '}
                  · {horaBr(m.em)}
                </span>
                {m.falha !== null ? <span className="falha">Não enviada: {m.falha}</span> : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="cartao">
            <h2>Ficha do caso</h2>
            {lead.origem !== undefined && lead.origem !== null ? (
              <p className="nota" style={{ marginTop: 0 }}>
                Origem: <b>{ROTULO_ORIGEM[lead.origem.tipo]}</b>
                {lead.origem.detalhe !== null ? ` — ${lead.origem.detalhe}` : ''}
              </p>
            ) : null}
            <Ficha f={lead.ficha} />
            {lead.propostaEnviadaEm !== null ? (
              <p className="nota">Proposta enviada em {horaBr(lead.propostaEnviadaEm)}.</p>
            ) : null}
            {lead.followup !== null && lead.followup.enviadoEm === null ? (
              <p className="nota">
                Follow-up devido em {horaBr(lead.followup.devidoEm)} — sai pela fila de follow-ups.
              </p>
            ) : null}
          </div>
          <div style={{ height: 14 }} />
          <AcoesLead
            id={lead.id}
            etapa={lead.etapa}
            modo={lead.modo}
            dentroDaJanela={dentroDaJanela}
            temAtencao={lead.atencao !== null}
            contratoEnviadoEm={lead.contratoEnviadoEm}
            pagamentoConfirmadoEm={lead.pagamentoConfirmadoEm}
          />
          <div className="cartao" style={{ marginTop: 14 }}>
            <h2>Histórico</h2>
            <ul className="historico">
              {[...lead.historico].reverse().map((h, i) => (
                <li key={i}>
                  {h.texto}
                  <div className="quando">
                    {horaBr(h.em)} · {h.autor}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
