// MARCA do Projeto Reconstrua (identidade 2026-09-17, a mesma do Painel do
// Investidor): ícone + nome com o ouro, no topo escuro e nas telas de acesso.
// O src carrega o basePath (assets de public/ vivem sob /juridico).
import type { ReactElement } from 'react';

const ICONE = '/juridico/icone.png';

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

/** Coluna escura da tela de acesso. */
export const LadoAcesso = (): ReactElement => (
  <aside className="acesso-lado">
    <Marca sub="Operado pela AHRI Tecnologia" />
    <div>
      <div className="acesso-kicker">Painel Jurídico</div>
      <div className="acesso-titulo">Clientes, processos e publicações, com o parecer da AHRI.</div>
      <p>Andamentos dos tribunais, intimações do DJEN, guias e perícias — com os prazos à vista.</p>
    </div>
    <div className="marca-sub">Acesso restrito à equipe jurídica</div>
  </aside>
);
