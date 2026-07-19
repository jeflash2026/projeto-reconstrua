// INTELIGÊNCIA · EVOLUÇÃO DO CATÁLOGO (GO-LIVE 13A · seção 4) — o catálogo se
// medindo: precisão, confiança, estratégias mais/nunca usadas e corrigidas,
// documentos que mais faltam, fatos difíceis, tempo médio e histórico mensal.
// Derivado de /admin/inteligencia/evolucao (Catalog Evolution 11B/11C).
import type { ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type EvolucaoData } from '../../../../lib/api';

const Rank = ({ titulo, itens, sufixo }: { titulo: string; itens: { chave: string; valor: string }[]; sufixo?: string }): ReactElement => (
  <div className="card">
    <h3>{titulo}</h3>
    {itens.length === 0 ? <div className="empty">Sem dados ainda.</div> : (
      <ul className="lab-rank">
        {itens.map((i, k) => (
          <li key={k}><span className="lab-rank-key">{i.chave}</span><span className="lab-rank-val">{i.valor}{sufixo ?? ''}</span></li>
        ))}
      </ul>
    )}
  </div>
);

const EvolucaoPage = async (): Promise<ReactElement> => {
  const d = await getJson<EvolucaoData>('/admin/inteligencia/evolucao');
  if (!d) {
    return (<><h1 className="page-title">Evolução do Catálogo</h1><div className="error-box">API indisponível.</div></>);
  }
  const vazio = d.totalAtendimentos === 0;
  return (
    <>
      <AutoRefresh seconds={30} />
      <h1 className="page-title">Evolução do Catálogo</h1>
      <p className="page-sub">O catálogo se medindo continuamente. Cada métrica nasce dos atendimentos encerrados.</p>

      {vazio ? (
        <div className="cc-empty"><div className="cc-empty-icon" aria-hidden>◷</div><p>Ainda sem atendimentos encerrados. Quando os primeiros casos fecharem, o catálogo começa a se medir aqui.</p></div>
      ) : (
        <>
          <div className="cc-ind-grid" style={{ marginBottom: 20 }}>
            <div className="cc-ind"><div className="cc-ind-value">{Math.round(d.taxaAcerto * 100)}%</div><div className="cc-ind-label">Precisão</div></div>
            <div className="cc-ind"><div className="cc-ind-value">{Math.round(d.confiancaMedia * 100)}%</div><div className="cc-ind-label">Confiança média</div></div>
            <div className="cc-ind"><div className="cc-ind-value">{d.totalAtendimentos}</div><div className="cc-ind-label">Casos aprendidos</div></div>
            <div className="cc-ind"><div className="cc-ind-value">{Math.round(d.tempoMedioAteDecisaoMs / 60000)} min</div><div className="cc-ind-label">Tempo médio até decisão</div></div>
          </div>

          <div className="grid two" style={{ marginBottom: 12 }}>
            <Rank titulo="Estratégias mais utilizadas" itens={d.estrategiasMaisUtilizadas.map((e) => ({ chave: e.chave, valor: String(e.ocorrencias) }))} sufixo=" uso(s)" />
            <Rank titulo="Estratégias frequentemente corrigidas" itens={d.estrategiasMaisCorrigidas.map((e) => ({ chave: e.ref, valor: `${Math.round(e.taxaCorrecao * 100)}%` }))} />
            <Rank titulo="Documentos que mais faltam" itens={d.documentosMaisFaltantes.map((e) => ({ chave: e.chave, valor: String(e.ocorrencias) }))} sufixo="×" />
            <Rank titulo="Fatos mais difíceis de descobrir" itens={d.fatosDificeis.map((e) => ({ chave: e.chave, valor: String(e.ocorrencias) }))} sufixo="×" />
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3>Estratégias nunca utilizadas</h3>
            {d.estrategiasNuncaUtilizadas.length === 0 ? <div className="empty">Todas já foram usadas ao menos uma vez.</div> : (
              <div className="lab-chips">{d.estrategiasNuncaUtilizadas.map((r) => <span key={r} className="lab-chip warn">{r}</span>)}</div>
            )}
          </div>

          <div className="card">
            <h3>Histórico mensal</h3>
            {d.historicoMensal.length === 0 ? <div className="empty">Sem histórico ainda.</div> : (
              <ul className="lab-rank">
                {d.historicoMensal.map((m) => (
                  <li key={m.mes}>
                    <span className="lab-rank-key mono">{m.mes}</span>
                    <span className="lab-rank-val">{m.total} caso(s) · {Math.round(m.taxaAcerto * 100)}% acerto · {Math.round(m.confiancaMedia * 100)}% confiança</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default EvolucaoPage;
