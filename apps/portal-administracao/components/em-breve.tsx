// Estado vazio ELEGANTE (13A) — área de Inteligência ainda em construção nesta
// Sprint. Sem dado inventado: apenas anuncia o que a AHRI vai tornar visível aqui.
import type { ReactElement } from 'react';
import Link from 'next/link';

const EmBreve = ({ titulo, descricao }: { titulo: string; descricao: string }): ReactElement => (
  <>
    <h1 className="page-title">{titulo}</h1>
    <div className="cc-empty" style={{ marginTop: 20 }}>
      <div className="cc-empty-icon" aria-hidden>◷</div>
      <p>{descricao}</p>
      <Link href="/" className="cc-entry" style={{ maxWidth: 260, alignItems: 'center' }}>
        <span className="cc-entry-title">Voltar ao Centro de Comando</span>
      </Link>
    </div>
  </>
);

export default EmBreve;
