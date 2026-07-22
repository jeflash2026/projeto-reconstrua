// 15C-2 — estado de carregamento da lista (skeleton discreto).
import type { ReactElement } from 'react';

const Loading = (): ReactElement => (
  <>
    <h1 className="page-title">Solicitações de Documentos</h1>
    <div className="sol-skeleton-grid" aria-busy="true" aria-label="Carregando solicitações">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="sol-skeleton" />
      ))}
    </div>
  </>
);

export default Loading;
