'use client';
import type { ReactElement } from 'react';

export default function SairButton(): ReactElement {
  return (
    <button
      className="btn"
      onClick={() => {
        void fetch('/juridico/api/sair', { method: 'POST' }).finally(() => {
          window.location.href = '/juridico/login';
        });
      }}
    >
      Sair
    </button>
  );
}
