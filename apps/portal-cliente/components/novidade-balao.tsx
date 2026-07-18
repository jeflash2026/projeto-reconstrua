// NOVIDADE — mensagem da AHRI (o formato que o cliente já conhece do WhatsApp:
// é a MESMA entidade falando — Princípio 1). Sem campo de resposta (D6).
import type { ReactElement } from 'react';

const NovidadeBalao = ({ quando, texto }: { quando: string; texto: string }): ReactElement => (
  <div className="balao">
    <div className="balao__quando">{quando}</div>
    <p>{texto}</p>
  </div>
);

export default NovidadeBalao;
