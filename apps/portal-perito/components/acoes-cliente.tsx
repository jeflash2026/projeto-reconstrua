'use client';
// AÇÕES do perito sobre um cliente da fila: baixar a planilha (proxy server-side)
// e CONFIRMAR os pedidos administrativos — o ato que inicia os 10 dias.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { confirmarPedidos } from '../lib/actions';

const AcoesCliente = ({ clienteId }: { clienteId: string }): ReactElement => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = async (): Promise<void> => {
    if (busy) return;
    if (
      !window.confirm(
        'Confirmar que TODOS os pedidos administrativos deste cliente foram feitos? Isso inicia a contagem dos 10 dias.',
      )
    ) {
      return;
    }
    setBusy(true);
    setErro(null);
    const r = await confirmarPedidos(clienteId);
    if (!r.ok) setErro('falha ao confirmar — tente novamente');
    router.refresh();
    setBusy(false);
  };

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <a className="btn" href={`/perito/api/planilha/${encodeURIComponent(clienteId)}`}>
        Baixar planilha
      </a>
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => void confirmar()}
      >
        {busy ? 'Confirmando…' : 'Pedidos enviados'}
      </button>
      {erro !== null ? <span className="error-box">{erro}</span> : null}
    </span>
  );
};

export default AcoesCliente;
