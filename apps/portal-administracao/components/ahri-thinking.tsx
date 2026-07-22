// AHRI THINKING (GO-LIVE 14A) — o estado VIVO da IA. Nunca um loader genérico:
// mostra o que a AHRI está fazendo agora ("Gerando o Dossiê…", "Avaliando
// hipóteses…"). Orbe que respira + reticências suaves. Respeita prefers-reduced-
// motion (o CSS desliga a animação). Puro visual; nenhum dado.
import type { ReactElement } from 'react';

const AhriThinking = ({ label }: { label: string }): ReactElement => (
  <div className="ahri-thinking" role="status" aria-live="polite">
    <span className="ahri-orb" aria-hidden />
    <span className="ahri-thinking-label">
      {label}
      <span className="ahri-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </span>
  </div>
);

export default AhriThinking;
