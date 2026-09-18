// FUNIL (2026-09-18) — os números do dia, os leads que precisam de gente
// primeiro, e a lista filtrável por etapa. Atualiza sozinho a cada 15 s.
import Link from 'next/link';
import type { ReactElement } from 'react';
import { AtualizarAuto } from '../../components/atualizar-auto';
import {
  ETAPAS,
  ROTULO_ETAPA,
  ROTULO_ORIGEM,
  getJson,
  haQuanto,
  telefoneBr,
  type EtapaCnh,
  type LeadResumoCnh,
  type ResumoCnh,
} from '../../lib/api';

export const dynamic = 'force-dynamic';

const LeadLinha = ({ l }: { l: LeadResumoCnh }): ReactElement => {
  const classe = [
    'lead',
    l.urgente && l.modo === 'humano' ? 'urgente' : '',
    l.atencao ? 'atencao' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const quem =
    l.ultimaMensagem?.de === 'cliente'
      ? 'Cliente'
      : l.ultimaMensagem?.de === 'ahri'
        ? 'AHRI'
        : 'Equipe';
  return (
    <Link className={classe} href={`/leads/${l.id}`}>
      <div>
        <div className="lead-nome">{l.nome ?? telefoneBr(l.id)}</div>
        <div className="lead-sub">
          {l.cidade ?? 'cidade não informada'}
          {l.motoristaProfissional === true ? ' · motorista profissional' : ''}
          {l.tipoCaso !== null ? ` · ${l.tipoCaso === 'cassacao' ? 'cassação' : 'suspensão'}` : ''}
        </div>
        {l.origem !== undefined && l.origem !== null && l.origem !== 'direto' ? (
          <div className="lead-sub">veio pelo {ROTULO_ORIGEM[l.origem].toLowerCase()}</div>
        ) : null}
      </div>
      <div style={{ minWidth: 0 }}>
        {l.atencao !== null ? (
          <div className={`aviso-linha${l.urgente ? ' ruim' : ''}`}>{l.atencao}</div>
        ) : null}
        <div className="lead-msg">
          {l.ultimaMensagem !== null ? `${quem}: ${l.ultimaMensagem.texto}` : (l.resumo ?? '—')}
        </div>
      </div>
      <div className="lead-lado">
        {l.prazoCurto === true ? <span className="selo ruim">Prazo curto</span> : null}
        {l.motoristaProfissional === true && l.etapa !== 'descartado' ? (
          <span className="selo aviso">Prioridade</span>
        ) : null}
        <span className={`selo etapa-${l.etapa}`}>{l.etapaRotulo}</span>
        {/* Em aceite, advogado e descarte a etapa já diz quem está com o lead. */}
        {['aceito', 'transferido', 'descartado'].includes(l.etapa) ? null : (
          <span className={`selo ${l.modo === 'ahri' ? 'ahri' : 'humano'}`}>
            {l.modo === 'ahri' ? 'AHRI atendendo' : 'Com a equipe'}
          </span>
        )}
        <span className="lead-sub">{haQuanto(l.atualizadoEm)}</span>
      </div>
    </Link>
  );
};

export default async function FunilPage({
  searchParams,
}: {
  searchParams: { etapa?: string; filtro?: string };
}): Promise<ReactElement> {
  const [resumo, dados] = await Promise.all([
    getJson<ResumoCnh>('/cnh-api/admin/resumo'),
    getJson<{ leads: LeadResumoCnh[] }>('/cnh-api/admin/leads'),
  ]);
  if (resumo === null || dados === null)
    return (
      <div className="erro">
        O serviço da CNH não respondeu. Confira se o contêiner cnh-api está no ar e se o
        CNH_API_TOKEN do painel é o mesmo do serviço.
      </div>
    );

  const etapa = ETAPAS.includes(searchParams.etapa as EtapaCnh)
    ? (searchParams.etapa as EtapaCnh)
    : null;
  const soAtencao = searchParams.filtro === 'atencao';
  const atencao = dados.leads.filter((l) => l.atencao !== null);
  const lista = dados.leads.filter(
    (l) => (etapa === null || l.etapa === etapa) && (!soAtencao || l.atencao !== null),
  );
  const comAhri =
    resumo.porEtapa.recepcao +
    resumo.porEtapa.qualificacao +
    resumo.porEtapa.viabilidade +
    resumo.porEtapa.proposta;

  return (
    <>
      <AtualizarAuto />
      <div className="kicker">Funil de captação · tese de CNH</div>
      <h1 className="titulo">Leads</h1>
      <p className="subtitulo">
        A AHRI atende pelo roteiro do escritório. Aqui aparecem primeiro os leads que precisam de
        gente.
      </p>

      <div className="tiles">
        <div className="tile escuro">
          <div className="rot">Novos hoje</div>
          <div className="val">{resumo.novosHoje}</div>
          <div className="sub">
            {resumo.total} no total
            {resumo.porOrigem !== undefined
              ? ` · ${String(resumo.porOrigem.anuncio)} anúncio · ${String(resumo.porOrigem.site)} site`
              : ''}
          </div>
        </div>
        <div className="tile">
          <div className="rot">Em conversa com a AHRI</div>
          <div className="val">{comAhri}</div>
          <div className="sub">recepção à proposta</div>
        </div>
        <Link
          className={`tile${resumo.precisamDeAtencao > 0 ? ' alerta' : ''}`}
          href="/?filtro=atencao"
        >
          <div className="rot">Precisam de atenção</div>
          <div className="val">{resumo.precisamDeAtencao}</div>
          <div className="sub">
            {resumo.urgentes > 0 ? `${String(resumo.urgentes)} urgente(s)` : 'mensagens e pedidos'}
          </div>
        </Link>
        <Link className={`tile${resumo.followupsDevidos > 0 ? ' alerta' : ''}`} href="/followups">
          <div className="rot">Follow-ups para aprovar</div>
          <div className="val">{resumo.followupsDevidos}</div>
          <div className="sub">leads mornos há 24 h</div>
        </Link>
        <div className="tile">
          <div className="rot">Prioridade</div>
          <div className="val">{resumo.prioritarios ?? 0}</div>
          <div className="sub">motorista profissional ou prazo curto</div>
        </div>
        <div className="tile">
          <div className="rot">Aceites</div>
          <div className="val">{resumo.porEtapa.aceito}</div>
          <div className="sub">{resumo.aceitosHoje} hoje · contrato e pagamento</div>
        </div>
      </div>

      {atencao.length > 0 && !soAtencao && etapa === null ? (
        <section style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Precisam de atenção agora</h2>
          <div className="lista-leads">
            {atencao.slice(0, 6).map((l) => (
              <LeadLinha key={l.id} l={l} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="chips">
        <Link className={`chip${etapa === null && !soAtencao ? ' ativo' : ''}`} href="/">
          Todos<span className="n">{resumo.total}</span>
        </Link>
        {ETAPAS.map((e) => (
          <Link key={e} className={`chip${etapa === e ? ' ativo' : ''}`} href={`/?etapa=${e}`}>
            {ROTULO_ETAPA[e]}
            <span className="n">{resumo.porEtapa[e]}</span>
          </Link>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="cartao vazio">
          {resumo.total === 0
            ? 'Nenhum lead ainda. Assim que alguém chamar o WhatsApp da CNH, ele aparece aqui.'
            : 'Nenhum lead neste filtro.'}
        </div>
      ) : (
        <div className="lista-leads">
          {lista.map((l) => (
            <LeadLinha key={l.id} l={l} />
          ))}
        </div>
      )}
    </>
  );
}
