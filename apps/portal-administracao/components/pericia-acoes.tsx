'use client';
// JORNADA B (B-R6) — os atos do PERITO na fila: BAIXAR a planilha de contratos
// (CSV; download via Blob — o token nunca chega ao browser) e CONFIRMAR o envio
// dos pedidos administrativos (confirmação explícita → inicia os 10 dias).
// Reutiliza os comandos canônicos via Server Actions (Regra 3 / Lei 12).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { confirmarPedidos, fetchPlanilhaCliente, fetchPlanilhasLote } from '../lib/actions';

function baixarArquivo(nome: string, mime: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export const PericiaAcoes = ({ clienteId }: { clienteId: string }): ReactElement => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const baixar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const p = await fetchPlanilhaCliente(clienteId);
    if (p) baixarArquivo(p.nomeArquivo, p.mime, p.conteudo);
    else setErro('Falha ao gerar a planilha.');
    setBusy(false);
  };

  const confirmar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const result = await confirmarPedidos(clienteId, null);
    if (result && result.confirmado) {
      setConfirming(false);
      router.refresh(); // a fila derivada move o cliente para AGUARDANDO_10_DIAS
    } else {
      setErro('Falha ao confirmar os pedidos.');
    }
    setBusy(false);
  };

  return (
    <div className="form-row" style={{ margin: 0 }}>
      <button
        disabled={busy}
        onClick={() => {
          void baixar();
        }}
      >
        Baixar planilha
      </button>
      {confirming ? (
        <>
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              void confirmar();
            }}
          >
            Confirmar envio dos pedidos
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
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            setConfirming(true);
            setErro(null);
          }}
        >
          Pedidos enviados
        </button>
      )}
      {erro ? <span style={{ color: 'var(--text-dim)' }}>{erro}</span> : null}
    </div>
  );
};

export const BaixarLote = (): ReactElement => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const baixarTodas = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    const lote = await fetchPlanilhasLote();
    if (lote === null) {
      setStatus('Falha ao gerar o lote.');
    } else if (lote.planilhas.length === 0) {
      setStatus('Fila vazia — nenhuma planilha a gerar.');
    } else {
      for (const p of lote.planilhas) baixarArquivo(p.nomeArquivo, p.mime, p.conteudo); // um arquivo POR CLIENTE
      setStatus(`${String(lote.planilhas.length)} planilha(s) baixada(s).`);
    }
    setBusy(false);
  };

  return (
    <div className="form-row" style={{ margin: 0 }}>
      <button
        disabled={busy}
        onClick={() => {
          void baixarTodas();
        }}
      >
        Baixar todas (uma por cliente)
      </button>
      {status ? <span style={{ color: 'var(--text-dim)' }}>{status}</span> : null}
    </div>
  );
};
