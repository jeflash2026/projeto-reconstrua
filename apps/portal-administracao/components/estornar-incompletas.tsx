'use client';
// CADA CLIENTE NO SEU ESTÁGIO REAL (decreto 2026-08-03) — as perícias iniciadas
// no fluxo ANTIGO (antes do dossiê, da confirmação do cliente e da coleta da
// fase 2 pelo Atendimento Humanizado) não representam trabalho válido: o
// cliente sequer viu o parecer. Este ato devolve esses casos ao ponto real do
// funil e PRESERVA quem completou o ciclo. Backup de tudo; confirmação em 2
// passos; nada acontece sozinho.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { pdEstornarPericiasIncompletas } from '../lib/actions';

const EstornarIncompletas = (): ReactElement => {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState<{ estornados: number; preservados: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const estornar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    try {
      const r = await pdEstornarPericiasIncompletas();
      if (r === null) setErro('A API não respondeu — tente novamente.');
      else {
        setFeito(r);
        router.refresh();
      }
    } finally {
      setBusy(false);
      setConfirmando(false);
    }
  };

  if (feito !== null) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Estágios reorganizados</h3>
        <p>
          <strong>{feito.estornados}</strong> caso(s) do fluxo antigo voltaram ao estágio real do
          funil (aguardando dossiê, confirmação ou documentos). <strong>{feito.preservados}</strong>{' '}
          caso(s) com o ciclo completo permaneceram em perícia. Tudo guardado em backup.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3>Reorganizar estágios (perícias do fluxo antigo)</h3>
      <p className="page-sub" style={{ marginTop: 4 }}>
        Devolve ao funil os casos que entraram em perícia <strong>antes</strong> do novo fluxo — sem
        dossiê enviado, sem confirmação do cliente ou sem a procuração/RG/comprovante colhidos pelo
        Atendimento Humanizado. Quem completou o ciclo <strong>continua</strong> em perícia. Nada é
        perdido: tudo vai para backup.
      </p>
      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {confirmando ? (
        <div className="form-row">
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              void estornar();
            }}
          >
            {busy ? 'Reorganizando…' : 'Confirmar — devolver ao estágio real'}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setConfirmando(false);
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          className="primary"
          onClick={() => {
            setConfirmando(true);
          }}
        >
          Reorganizar estágios…
        </button>
      )}
    </div>
  );
};

export default EstornarIncompletas;
