'use client';
// TOGGLE "aguardando devolução assinada" — a secretária marca quando JÁ enviou
// a documentação ao cliente e está esperando a volta assinada; desmarca quando
// o cliente devolver. Organização da mesa; nada automático deriva daqui.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { marcarAguardando } from '../lib/actions';

const AguardandoToggle = ({
  chatId,
  aguardando,
  desde,
}: {
  chatId: string;
  aguardando: boolean;
  /** QUANDO foi marcado (já formatado) — a mesa mostra o horário do envio. */
  desde?: string | null;
}): ReactElement => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const alternar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    await marcarAguardando(chatId, !aguardando);
    router.refresh();
    setBusy(false);
  };

  return aguardando ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span className="badge aviso">
        ⏳ documentação enviada{desde != null && desde !== '' ? ` em ${desde}` : ''} — aguardando
        devolução assinada
      </span>
      <button
        type="button"
        className="btn"
        style={{ fontSize: 12, padding: '2px 10px' }}
        disabled={busy}
        onClick={() => {
          void alternar();
        }}
      >
        desmarcar
      </button>
    </span>
  ) : (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={() => {
        void alternar();
      }}
    >
      📤 Enviei a documentação — aguardando devolução
    </button>
  );
};

export default AguardandoToggle;
