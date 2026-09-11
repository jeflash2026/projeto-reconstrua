'use client';
// ACOMPANHAMENTO PROCESSUAL (2026-09-11) — "Ciente" num alerta de prazo: o
// advogado confirma que viu; o alerta desce na lista e para de contar.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cienteAcompanhamento } from '../lib/actions';

const CienteAlerta = ({ chave }: { chave: string }): ReactElement => {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);
  return (
    <>
      <button
        className="sol-btn"
        disabled={pendente}
        onClick={() => {
          setErro(false);
          iniciar(() => {
            // Transition síncrona + IIFE async (tipagens React 18 e 19).
            void (async () => {
              const r = await cienteAcompanhamento(chave);
              if (!r.ok) {
                setErro(true);
                return;
              }
              router.refresh();
            })();
          });
        }}
      >
        {pendente ? 'Registrando…' : 'Ciente'}
      </button>
      {erro ? <span className="sol-erro">Não foi possível registrar agora.</span> : null}
    </>
  );
};

export default CienteAlerta;
