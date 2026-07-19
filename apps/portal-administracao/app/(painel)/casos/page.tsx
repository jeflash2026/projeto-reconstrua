// PAINEL DO ADVOGADO (GO-LIVE 13A · seção 1) — cada card é um CASO, não um cliente.
// Resume o caso em segundos (confiança/hipótese/próxima ação/urgência/docs) e a
// ação principal é ABRIR O DOSSIÊ. Derivado de /admin/casos (Read Models + dossiê).
import type { ReactElement } from 'react';
import Link from 'next/link';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson, type CartaoCaso } from '../../../lib/api';

const CONF: Record<string, string> = { alta: 'cc-tag-oportunidade', media: 'cc-tag-alerta', baixa: 'cc-tag-critico' };
const URG: Record<string, string> = { alta: 'cc-tag-critico', media: 'cc-tag-alerta', baixa: 'cc-tag-informacao' };

function tempoParado(ms: number | null): string {
  if (ms === null) return '—';
  const h = ms / 3_600_000;
  if (h < 24) return `${String(Math.round(h))} h parado`;
  return `${String(Math.round(h / 24))} d parado`;
}

const Card = ({ c }: { c: CartaoCaso }): ReactElement => (
  <div className={`caso-card caso-urg-${c.urgencia}`}>
    <div className="caso-top">
      <span className="caso-nome">{c.clienteNome}</span>
      <span className={`cc-tag ${URG[c.urgencia]}`}>{c.urgencia === 'alta' ? 'Urgente' : c.urgencia === 'media' ? 'Atenção' : 'Normal'}</span>
    </div>
    <div className="caso-tags">
      <span className="caso-status">{c.status}</span>
      {c.grauConfianca ? <span className={`cc-tag ${CONF[c.grauConfianca]}`}>Confiança {c.grauConfianca}</span> : <span className="cc-tag cc-tag-informacao">Em apuração</span>}
    </div>
    <p className="caso-hipotese">{c.principalHipotese ?? 'Ainda sem tese sustentável — reunir os fatos básicos.'}</p>
    {c.proximaAcao ? <p className="caso-acao"><span>Próxima ação:</span> {c.proximaAcao}</p> : null}
    <dl className="caso-kv">
      <div><dt>Docs pendentes</dt><dd>{c.documentosPendentes.length === 0 ? 'nenhum' : c.documentosPendentes.join(', ')}</dd></div>
      <div><dt>Tempo parado</dt><dd>{tempoParado(c.tempoParadoMs)}</dd></div>
      <div><dt>Dossiê</dt><dd>{c.dossieDisponivel ? 'disponível' : 'em apuração'}</dd></div>
      <div><dt>Missão</dt><dd className="mono">{c.missionId ?? '—'}</dd></div>
      <div><dt>Responsável</dt><dd>{c.advogadoResponsavel ?? 'a distribuir'}</dd></div>
    </dl>
    <Link href={c.href} className="caso-cta">Abrir Dossiê →</Link>
  </div>
);

const CasosPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ casos: CartaoCaso[] }>('/admin/casos');
  if (!data) {
    return (
      <>
        <h1 className="page-title">Meus Casos</h1>
        <div className="error-box">API indisponível.</div>
      </>
    );
  }
  return (
    <>
      <AutoRefresh seconds={20} />
      <h1 className="page-title">Meus Casos</h1>
      <p className="page-sub">Cada card é um caso. Comece pelo Dossiê — a AHRI já preparou o parecer.</p>
      {data.casos.length === 0 ? (
        <div className="cc-empty">
          <div className="cc-empty-icon" aria-hidden>✓</div>
          <p>Nenhum caso na sua fila agora. Assim que um cliente chegar, a AHRI monta o dossiê e ele aparece aqui.</p>
        </div>
      ) : (
        <div className="caso-grid">
          {data.casos.map((c) => <Card key={c.chatId} c={c} />)}
        </div>
      )}
    </>
  );
};

export default CasosPage;
