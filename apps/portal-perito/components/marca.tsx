// MARCA do Projeto Reconstrua (identidade 2026-09-17, a mesma do Painel do
// Investidor): ícone + nome com o ouro; a faixa escura do topo e a coluna das
// telas de acesso. O src carrega o basePath (assets de public/ vivem sob /perito).
import type { ReactElement, ReactNode } from 'react';

const ICONE = '/perito/icone.png';

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
      <div className="acesso-kicker">Central do Perito</div>
      <div className="acesso-titulo">A fila da perícia, pronta para trabalhar.</div>
      <p>
        O pacote de cada cliente, a planilha de contratos e a confirmação dos pedidos
        administrativos nos bancos.
      </p>
    </div>
    <div className="marca-sub">Acesso individual por ID</div>
  </aside>
);
