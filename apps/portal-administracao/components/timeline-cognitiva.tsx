// TIMELINE COGNITIVA (GO-LIVE 13A · seção 5) — a história do caso: como a AHRI
// pensou, passo a passo. Server component: busca /admin/clients/:chatId/timeline.
// Passos cognitivos permitem expandir os fatos utilizados (<details>). Cada item
// carrega responsável, origem e fonte. Nada recalculado; nada inventado.
import type { ReactElement } from 'react';
import { getJson, type TimelineCognitivaData, type TimelineCognitivaItem } from '../lib/api';

const CAT_ICON: Record<string, string> = {
  cliente: '💬', beneficio: '🎯', documento: '📄', reader: '🔍', contrato: '📑',
  knowledge: '🧠', reasoning: '⚖️', mind: '✔️', missao: '🗂️', advogado: '👤',
  dossie: '📋', encerramento: '🏁', feedback: '↩️',
};

const Item = ({ i }: { i: TimelineCognitivaItem }): ReactElement => (
  <li className="tlc-item">
    <span className="tlc-dot" aria-hidden>{CAT_ICON[i.categoria] ?? '•'}</span>
    <div className="tlc-body">
      <div className="tlc-top">
        <span className="tlc-title">{i.titulo}</span>
        <span className="tlc-when">{i.quando ? new Date(i.quando).toLocaleString('pt-BR') : '—'}</span>
      </div>
      {i.descricao ? <p className="tlc-desc">{i.descricao}</p> : null}
      <div className="tlc-meta">
        <span>{i.responsavel}</span>
        <span>·</span>
        <span>{i.origem}</span>
        <span className="cc-source">{i.fonte}</span>
      </div>
      {i.fatosUtilizados && i.fatosUtilizados.length > 0 ? (
        <details className="tlc-fatos">
          <summary>Fatos utilizados ({i.fatosUtilizados.length})</summary>
          <ul>{i.fatosUtilizados.map((f, k) => <li key={k} className="mono">{f}</li>)}</ul>
        </details>
      ) : null}
    </div>
  </li>
);

const TimelineCognitiva = async ({ chatId }: { chatId: string }): Promise<ReactElement | null> => {
  const data = await getJson<TimelineCognitivaData>(`/admin/clients/${encodeURIComponent(chatId)}/timeline`);
  if (!data || data.timeline.length === 0) return null;
  return (
    <section className="card tlc" style={{ marginBottom: 16 }}>
      <h3>Timeline Cognitiva — como a AHRI pensou este caso</h3>
      <ol className="tlc-list">
        {data.timeline.map((i) => <Item key={i.ordem} i={i} />)}
      </ol>
    </section>
  );
};

export default TimelineCognitiva;
