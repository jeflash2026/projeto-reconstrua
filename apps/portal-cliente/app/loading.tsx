// SKELETON — "a AHRI escrevendo" (UX: sem spinners; a espera também tem voz).
import type { ReactElement } from 'react';

const Loading = (): ReactElement => (
  <main className="carta">
    <div className="bloco presenca presenca--atenta">
      <span className="escrevendo" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span>Um instante — estou organizando as informações do seu caso…</span>
    </div>
    <div className="bloco" aria-hidden>
      <div className="linha-suave" style={{ width: '55%', height: 28, marginBottom: 14 }} />
      <div className="linha-suave" style={{ width: '90%' }} />
      <div className="linha-suave" style={{ width: '75%', marginTop: 8 }} />
    </div>
  </main>
);

export default Loading;
