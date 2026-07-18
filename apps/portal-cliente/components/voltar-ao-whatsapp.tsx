// A ÚNICA AÇÃO da página — a volta ao relacionamento (Princípio 8).
import type { ReactElement } from 'react';

const VoltarAoWhatsApp = ({ numero }: { numero: string }): ReactElement => (
  <a className="whatsapp" href={`https://wa.me/${numero}`} rel="noopener noreferrer">
    Conversar no WhatsApp
  </a>
);

export default VoltarAoWhatsApp;
