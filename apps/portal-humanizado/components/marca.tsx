// MARCA do Projeto Reconstrua (identidade 2026-09-17, a mesma do Painel do
// Investidor): ícone + nome com o ouro; a faixa escura do topo e a coluna das
// telas de acesso. O src carrega o basePath (assets de public/ vivem sob /humanizado).
import type { ReactElement, ReactNode } from 'react';

const ICONE = '/humanizado/icone.png';

export const Marca = ({ sub }: { sub: string }): ReactElement => (
  <div className="marca">
    <img src={ICONE} alt="" />
    <div>
      <div className="marca-nome">
        Projeto <span>Reconstrua</span>
      </div>
      <div className="marca-sub">{sub}</div>
    </div>
  </div>
);

export const FaixaTopo = ({
  sub,
  largura,
  children,
}: {
  sub: string;
  largura: number;
  children?: ReactNode;
}): ReactElement => (
  <header className="faixa-topo">
    <div className="faixa-topo-inner" style={{ maxWidth: largura }}>
      <Marca sub={sub} />
      <div className="faixa-topo-acoes">{children}</div>
    </div>
  </header>
);

/** Coluna escura das telas de acesso (login e criação de senha). */
export const LadoAcesso = (): ReactElement => (
  <aside className="acesso-lado">
    <Marca sub="Operado pela AHRI Tecnologia" />
    <div>
      <div className="acesso-kicker">Atendimento Humanizado</div>
      <div className="acesso-titulo">A mesa do atendimento, organizada por estado.</div>
      <p>
        Os clientes que confirmaram o parecer, as conversas da equipe e os documentos da fase 2 —
        tudo em um lugar.
      </p>
    </div>
    <div className="marca-sub">Acesso individual da equipe</div>
  </aside>
);
