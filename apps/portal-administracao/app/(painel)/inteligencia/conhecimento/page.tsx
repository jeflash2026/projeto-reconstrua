// INTELIGÊNCIA · CONHECIMENTO (GO-LIVE 13A · seção 3) — o Conversation Knowledge
// estruturado: só fatos aprendidos (nunca mensagens), agrupados por categoria.
// Derivado de /admin/inteligencia/conhecimento (Read Models).
import type { ReactElement } from 'react';
import Link from 'next/link';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type CategoriaConhecimento } from '../../../../lib/api';

const Grupo = ({ g }: { g: CategoriaConhecimento }): ReactElement => (
  <div className="lab-know">
    <div className="lab-know-head">
      <span className="lab-know-cat">{g.categoria}</span>
      <span className="lab-know-count">{g.itens.length}</span>
    </div>
    <ul className="lab-know-list">
      {g.itens.map((f, i) => (
        <li key={i}>
          <span className="lab-know-val">{f.valor}</span>
          <Link href={`/clientes/${encodeURIComponent(f.clienteId)}`} className="lab-know-cli">{f.clienteNome}</Link>
          <span className="lab-know-meta">{f.confianca} · {f.origem}</span>
          <span className="cc-source">{f.fonte}</span>
        </li>
      ))}
    </ul>
  </div>
);

const ConhecimentoPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ categorias: CategoriaConhecimento[] }>('/admin/inteligencia/conhecimento');
  if (!data) {
    return (<><h1 className="page-title">Conhecimento</h1><div className="error-box">API indisponível.</div></>);
  }
  return (
    <>
      <AutoRefresh seconds={25} />
      <h1 className="page-title">Conhecimento</h1>
      <p className="page-sub">O que a AHRI aprendeu conversando — apenas fatos estruturados, nunca mensagens.</p>
      {data.categorias.length === 0 ? (
        <div className="cc-empty"><div className="cc-empty-icon" aria-hidden>◷</div><p>Nenhum fato aprendido ainda. A cada conversa, a AHRI estrutura o que descobre e mostra aqui.</p></div>
      ) : (
        <div className="lab-know-grid">{data.categorias.map((g) => <Grupo key={g.factKey} g={g} />)}</div>
      )}
    </>
  );
};

export default ConhecimentoPage;
