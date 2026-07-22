'use client';
// Botão de AUTORIZAÇÃO do reaquecimento (decreto 2026-07-22): um clique = a
// AHRI reaquece ESTE lead. Guardrails (intervalo/teto) valem no servidor.
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { autorizarReaquecimento } from '../lib/actions';

export function ReaquecerLead({
  chatId,
  habilitado,
  motivoBloqueio,
}: {
  chatId: string;
  habilitado: boolean;
  motivoBloqueio: string | null;
}): ReactElement {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  if (!habilitado) {
    return <span className="page-sub">{motivoBloqueio ?? 'bloqueado'}</span>;
  }
  if (feito) return <span className="page-sub">Reaquecimento enviado</span>;
  return (
    <span>
      <button
        type="button"
        className="btn"
        disabled={pendente}
        onClick={() => {
          setErro(null);
          iniciar(() => {
            void (async () => {
              const r = await autorizarReaquecimento(chatId);
              if (r.ok) {
                setFeito(true);
                router.refresh();
              } else {
                setErro(r.error);
              }
            })();
          });
        }}
      >
        {pendente ? 'Enviando…' : 'Autorizar reaquecimento'}
      </button>
      {erro !== null ? (
        <span className="page-sub" style={{ marginLeft: 8 }}>
          {erro}
        </span>
      ) : null}
    </span>
  );
}
