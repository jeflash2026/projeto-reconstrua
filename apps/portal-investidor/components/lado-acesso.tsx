// Coluna escura das telas de acesso (login e criação de senha).
import type { ReactElement } from 'react';

const LadoAcesso = (): ReactElement => (
  <aside className="acesso-lado">
    <div className="marca">
      <img src="/investidor/icone.png" alt="" />
      <div>
        <div className="marca-nome">
          Projeto <span>Reconstrua</span>
        </div>
        <div className="marca-sub">Operado pela AHRI Tecnologia</div>
      </div>
    </div>
    <div>
      <div className="kicker">Painel do Investidor</div>
      <h1>A sua carteira de créditos judiciais, acompanhada de perto.</h1>
      <p>
        Cada processo da sua carteira com a fase atual, o advogado responsável e o valor da sua
        parte — atualizados automaticamente a partir dos tribunais.
      </p>
    </div>
    <div className="marca-sub">Acesso individual por CPF</div>
  </aside>
);

export default LadoAcesso;
