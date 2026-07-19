// INTELIGÊNCIA · HIPÓTESES (GO-LIVE 13A · seções 1 e 5) — todas as hipóteses que
// a AHRI produziu, com "Como a AHRI chegou aqui?" (explicação auditável, sem
// Chain of Thought). Derivado de /admin/inteligencia/hipoteses (dossiês/Read
// Models). Ordenação por confiança (default) — determinística no servidor.
import type { ReactElement } from 'react';
import Link from 'next/link';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type HipoteseView } from '../../../../lib/api';

const RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
const CONF: Record<string, string> = { alta: 'cc-tag-oportunidade', media: 'cc-tag-alerta', baixa: 'cc-tag-critico' };

const Explica = ({ h }: { h: HipoteseView }): ReactElement => (
  <details className="lab-explica">
    <summary>Como a AHRI chegou aqui?</summary>
    <div className="lab-explica-body">
      <div className="lab-field"><span className="lab-field-label">Fatos utilizados</span><div className="lab-chips">{h.explicacao.fatosUtilizados.map((f, i) => <span key={i} className="lab-chip">{f}</span>)}</div></div>
      <div className="lab-field"><span className="lab-field-label">Documentos considerados</span><div className="lab-chips">{h.explicacao.documentosConsiderados.length === 0 ? <span className="lab-chip na">nenhum</span> : h.explicacao.documentosConsiderados.map((d, i) => <span key={i} className="lab-chip">{d}</span>)}</div></div>
      <div className="lab-field"><span className="lab-field-label">Hipóteses avaliadas</span><div className="lab-chips">{h.explicacao.hipotesesAvaliadas.map((a) => <span key={a.ref} className="lab-chip">{a.ref} · {a.confianca}</span>)}</div></div>
      <div className="lab-field"><span className="lab-field-label">Hipóteses descartadas</span><div className="lab-chips">{h.explicacao.hipotesesDescartadas.length === 0 ? <span className="lab-chip na">nenhuma</span> : h.explicacao.hipotesesDescartadas.map((a) => <span key={a.ref} className="lab-chip warn">{a.ref} — {a.motivo}</span>)}</div></div>
      <p className="lab-crit">Estratégia vencedora: <strong>{h.explicacao.estrategiaVencedora ?? '—'}</strong> · Confiança: {h.explicacao.confianca ?? '—'} · Critério: {h.explicacao.criterios}</p>
    </div>
  </details>
);

const Card = ({ h }: { h: HipoteseView }): ReactElement => (
  <div className={`lab-hip lab-hip-${h.status}`}>
    <div className="lab-hip-top">
      <Link href={`/clientes/${encodeURIComponent(h.clienteId)}`} className="lab-hip-cliente">{h.clienteNome}</Link>
      <div className="lab-hip-tags">
        <span className={`cc-tag ${CONF[h.confianca]}`}>Confiança {h.confianca}</span>
        <span className="cc-tag cc-tag-informacao">Prioridade {h.prioridade}</span>
        {h.status === 'vencedora' ? <span className="cc-tag cc-tag-oportunidade">Vencedora</span> : <span className="cc-tag cc-tag-informacao">Avaliada</span>}
      </div>
    </div>
    <p className="lab-hip-nome">{h.hipotese}</p>
    <div className="lab-hip-meta mono">{h.estrategiaRef} · {new Date(h.quando).toLocaleDateString('pt-BR')}</div>
    <div className="lab-field"><span className="lab-field-label">Fatos que sustentam</span><div className="lab-chips">{h.fatosSustentam.map((f, i) => <span key={i} className="lab-chip">{f}</span>)}</div></div>
    {h.fatosAusentes.length > 0 ? <div className="lab-field"><span className="lab-field-label">Fatos ausentes</span><div className="lab-chips">{h.fatosAusentes.map((f, i) => <span key={i} className="lab-chip warn">{f}</span>)}</div></div> : null}
    <Explica h={h} />
  </div>
);

const HipotesesPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ hipoteses: HipoteseView[] }>('/admin/inteligencia/hipoteses');
  if (!data) {
    return (<><h1 className="page-title">Hipóteses</h1><div className="error-box">API indisponível.</div></>);
  }
  const hipoteses = [...data.hipoteses].sort((a, b) => RANK[a.confianca]! - RANK[b.confianca]! || b.prioridade - a.prioridade);
  return (
    <>
      <AutoRefresh seconds={25} />
      <h1 className="page-title">Hipóteses</h1>
      <p className="page-sub">Todas as teses que a AHRI formulou — sustentadas por evidência, nunca inventadas. Ordenadas por confiança.</p>
      {hipoteses.length === 0 ? (
        <div className="cc-empty"><div className="cc-empty-icon" aria-hidden>◷</div><p>Nenhuma hipótese produzida ainda. Assim que houver fatos suficientes, a AHRI formula as teses aqui.</p></div>
      ) : (
        <div className="lab-hip-grid">{hipoteses.map((h, i) => <Card key={`${h.clienteId}-${h.estrategiaRef}-${String(i)}`} h={h} />)}</div>
      )}
    </>
  );
};

export default HipotesesPage;
