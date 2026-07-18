// PRESENÇA — o pulso com semântica REAL (Presence §2): atenta (~3s) · serena
// (~5s, espera legítima) · repouso (imóvel e pleno — "não fui embora").
import type { ReactElement } from 'react';
import type { EstadoPresenca } from '../lib/api';

const MICROTEXTO: Record<EstadoPresenca, string> = {
  atenta: 'AHRI — acompanhando seu caso',
  serena: 'AHRI — acompanhando seu caso',
  repouso: 'AHRI — com você',
};

const Presenca = ({ estado }: { estado: EstadoPresenca }): ReactElement => (
  <div className={`bloco presenca presenca--${estado}`}>
    <span className="presenca__ponto" aria-hidden />
    <span>{MICROTEXTO[estado]}</span>
  </div>
);

export default Presenca;
