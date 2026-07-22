'use client';
// ENCERRAMENTO (B4.1) — o Operador finaliza OFICIALMENTE o processo. Chama a API do
// Admin via Server Action (server-side, autenticada). A partir do encerramento, a AHRI
// PARA: o Estado torna-se terminal (ENCERRADA) e TODO acompanhamento recorrente futuro
// fica bloqueado. Ato humano deliberado (confirmação explícita), compatível com futura
// reabertura (B4.3). Reutiliza o padrão de AssignForm (BL-3.4).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { encerrarMission, reabrirMission } from '../lib/actions';

// Ciclo de vida do processo: ENCERRAR (B4.1) e REABRIR (B4.3). O encerramento cala a
// AHRI; a reabertura (fato jurídico legítimo) devolve o processo ao acompanhamento
// recorrente (B4.2). Ambos são atos humanos deliberados (confirmação explícita).
const EncerrarForm = ({ missionId }: { missionId: string }): ReactElement => {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    const result = await encerrarMission(missionId, reason.trim() === '' ? null : reason.trim());
    if (result && result.closed) {
      setStatus(
        result.skipped
          ? 'Processo já estava encerrado.'
          : 'Processo encerrado. A AHRI não fará mais acompanhamento.',
      );
      setConfirming(false);
      router.refresh();
    } else {
      setStatus('Falha ao encerrar (verifique se a missão tem Verdade estabelecida).');
    }
    setBusy(false);
  };

  const reopen = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    const result = await reabrirMission(missionId, reason.trim() === '' ? null : reason.trim());
    if (result && result.reopened) {
      setStatus('Processo reaberto. A AHRI volta a acompanhar o cliente automaticamente.');
      router.refresh();
    } else {
      setStatus('Falha ao reabrir (verifique se a missão tem Verdade estabelecida).');
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Ciclo de vida do processo</h3>
      <p style={{ margin: '0 0 8px', color: 'var(--text-dim)' }}>
        Encerrar finaliza o processo e cala a AHRI. Reabrir (fato jurídico legítimo) devolve o
        processo ao acompanhamento automático.
      </p>
      <div className="form-row">
        <input
          type="text"
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
          style={{ flex: 1 }}
        />
        {confirming ? (
          <>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                void submit();
              }}
            >
              Confirmar encerramento
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => {
                setConfirming(true);
                setStatus(null);
              }}
            >
              Encerrar processo
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void reopen();
              }}
            >
              Reabrir processo
            </button>
          </>
        )}
      </div>
      {status ? <p style={{ margin: '8px 0 0', color: 'var(--text-dim)' }}>{status}</p> : null}
    </div>
  );
};

export default EncerrarForm;
