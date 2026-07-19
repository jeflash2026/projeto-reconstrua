// AHRI COMMAND CENTER (GO-LIVE 13A) — a home deixa de ser um CRUD e passa a ser o
// centro de comando da empresa. A AHRI abre o dia com um BRIEFING dinâmico
// (decide sozinha o que importa), indicadores executivos e portas para todas as
// áreas. Tudo derivado dos Read Models via /admin/command-center — nada é
// recalculado aqui; cada informação carrega sua FONTE. O chat vira ferramenta.
import type { ReactElement } from 'react';
import Link from 'next/link';
import AutoRefresh from '../../components/auto-refresh';
import FounderChat from '../../components/founder-chat';
import { getJson, type CommandCenterData, type CCInsight, type CCIndicador } from '../../lib/api';

const SEV_LABEL: Record<CCInsight['severidade'], string> = {
  critico: 'Atenção imediata',
  alerta: 'Alerta',
  oportunidade: 'Oportunidade',
  informacao: 'Informação',
};

const InsightRow = ({ i }: { i: CCInsight }): ReactElement => {
  const body = (
    <>
      <span className={`cc-sev cc-sev-${i.severidade}`} aria-hidden />
      <div className="cc-insight-body">
        <div className="cc-insight-top">
          <span className={`cc-tag cc-tag-${i.severidade}`}>{SEV_LABEL[i.severidade]}</span>
          <span className="cc-source" title={`Fonte: ${i.fonte}`}>{i.fonte}</span>
        </div>
        <p className="cc-insight-title">{i.titulo}</p>
        {i.detalhe ? <p className="cc-insight-detail">{i.detalhe}</p> : null}
      </div>
      {i.href ? <span className="cc-arrow" aria-hidden>→</span> : null}
    </>
  );
  return i.href ? (
    <Link href={i.href} className="cc-insight cc-insight-link">{body}</Link>
  ) : (
    <div className="cc-insight">{body}</div>
  );
};

const Indicador = ({ ind }: { ind: CCIndicador }): ReactElement => {
  const inner = (
    <>
      <div className={`cc-ind-value cc-tom-${ind.tom}${ind.valor === '—' ? ' na' : ''}`}>{ind.valor}</div>
      <div className="cc-ind-label">{ind.rotulo}</div>
      <div className="cc-source cc-ind-source" title={`Fonte: ${ind.fonte}`}>{ind.fonte}</div>
    </>
  );
  return ind.href ? <Link href={ind.href} className="cc-ind cc-ind-link">{inner}</Link> : <div className="cc-ind">{inner}</div>;
};

const ENTRADAS: ReadonlyArray<{ href: string; titulo: string; desc: string }> = [
  { href: '/clientes', titulo: 'Clientes', desc: 'Quem está em atendimento agora' },
  { href: '/inteligencia/dossies', titulo: 'Dossiês', desc: 'Pareceres gerados pela AHRI' },
  { href: '/inteligencia/estrategias', titulo: 'Inteligência', desc: 'Como a AHRI raciocina' },
  { href: '/missoes', titulo: 'Missões', desc: 'O trabalho distribuído' },
  { href: '/operacao', titulo: 'Operação', desc: 'Filas, perícia e gargalos' },
];

const CommandCenter = async (): Promise<ReactElement> => {
  const data = await getJson<CommandCenterData>('/admin/command-center');
  if (!data) {
    return (
      <>
        <h1 className="page-title">Centro de Comando</h1>
        <div className="error-box">A AHRI está temporariamente indisponível. Verifique o servidor administrativo.</div>
      </>
    );
  }
  const { briefing, indicadores } = data;
  const semInsights = briefing.insights.length === 0;

  return (
    <>
      <AutoRefresh seconds={15} />

      {/* HERO — a AHRI fala primeiro */}
      <section className="cc-hero">
        <div className="cc-live"><span className="cc-live-dot" aria-hidden /> AHRI · ao vivo</div>
        <h1 className="cc-greeting">{briefing.saudacao}</h1>
        <p className="cc-summary">{briefing.resumo}</p>
      </section>

      {/* BRIEFING dinâmico — a AHRI decidiu o que importa hoje */}
      {semInsights ? (
        <div className="cc-empty">
          <div className="cc-empty-icon" aria-hidden>✓</div>
          <p>Nenhuma pendência crítica no momento. Sigo observando a operação em tempo real.</p>
        </div>
      ) : (
        <div className="cc-insights">
          {briefing.insights.map((i) => (
            <InsightRow key={i.id} i={i} />
          ))}
        </div>
      )}

      {/* INDICADORES executivos — negócio, não técnico */}
      <div className="cc-section-label">Visão executiva</div>
      <div className="cc-ind-grid">
        {indicadores.map((ind) => (
          <Indicador key={ind.id} ind={ind} />
        ))}
      </div>

      {/* PORTAS para todas as áreas */}
      <div className="cc-section-label">Áreas</div>
      <div className="cc-entry-grid">
        {ENTRADAS.map((e) => (
          <Link key={e.href} href={e.href} className="cc-entry">
            <span className="cc-entry-title">{e.titulo}</span>
            <span className="cc-entry-desc">{e.desc}</span>
            <span className="cc-arrow" aria-hidden>→</span>
          </Link>
        ))}
      </div>

      {/* FERRAMENTA — o chat deixa de ser o centro; vira apoio */}
      <div className="cc-section-label">Pergunte à AHRI</div>
      <div className="cc-tool">
        <FounderChat />
      </div>
    </>
  );
};

export default CommandCenter;
