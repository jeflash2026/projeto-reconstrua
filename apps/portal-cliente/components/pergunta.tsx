// PERGUNTA — título-pergunta pequeno, resposta grande (a resposta é a estrela).
import type { ReactElement, ReactNode } from 'react';

const Pergunta = ({ titulo, children }: { titulo: string; children: ReactNode }): ReactElement => (
  <section className="bloco pergunta">
    <h2>{titulo}</h2>
    {children}
  </section>
);

export default Pergunta;
