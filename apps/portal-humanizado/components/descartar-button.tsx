'use client';
// DESCARTE DA MESA (pedido do dono, 2026-08-04) — o cliente que NÃO demonstra
// interesse ou NÃO entrega a documentação sai da fila da secretária, em 2
// passos (clique + confirmação; nada acontece por engano). Nada é perdido:
// a reativação manual — ou um SIM novo do cliente no WhatsApp — o traz de
// volta à mesa e o atendimento recomeça.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { descartarCliente } from '../lib/actions';

const DescartarButton = ({
  chatId,
  descartado,
}: {
  chatId: string;
  descartado: boolean;
}): ReactElement => {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);

  const aplicar = async (valor: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    await descartarCliente(chatId, valor);
    router.refresh();
    setBusy(false);
    setConfirmando(false);
  };

  if (descartado) {
    return (
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => {
          void aplicar(false);
        }}
      >
        {busy ? 'Reativando…' : '↩️ Reativar — voltar para a minha fila'}
      </button>
    );
  }

  return confirmando ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: 'var(--texto-dim)' }}>
        Tirar este cliente da fila? Ele volta se confirmar interesse de novo.
      </span>
      <button
        type="button"
        className="btn descartar"
        disabled={busy}
        onClick={() => {
          void aplicar(true);
        }}
      >
        {busy ? 'Descartando…' : 'Confirmar descarte'}
      </button>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => {
          setConfirmando(false);
        }}
      >
        Cancelar
      </button>
    </span>
  ) : (
    <button
      type="button"
      className="btn descartar"
      disabled={busy}
      onClick={() => {
        setConfirmando(true);
      }}
    >
      🗑 Descartar (sem interesse / sem documentação)
    </button>
  );
};

export default DescartarButton;
