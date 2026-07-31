'use client';
// Botão de imprimir/salvar PDF do Parecer visual (decreto 2026-07-31) — client
// component só pelo window.print(); some na impressão (classe so-tela).
import type { ReactElement } from 'react';

const ImprimirParecer = (): ReactElement => (
  <button
    type="button"
    className="btn primary so-tela"
    onClick={() => {
      window.print();
    }}
  >
    Salvar como PDF / Imprimir
  </button>
);

export default ImprimirParecer;
