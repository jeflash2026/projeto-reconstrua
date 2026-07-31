'use client';
// PARECER EM LOTE (Onda 3, 2026-07-31) — a base LEGADA (fase 1 completa que
// nunca viu o dossiê) recebe o parecer + pedido de CONFIRMAÇÃO com UM clique do
// Admin. O fato do parecer é o claim: repetir o lote nunca duplica mensagem.
import { useEffect, useState, type ReactElement } from 'react';
import { dispararParecerLote, parecerLotePendentes } from '../lib/actions';

const DisparoParecerEmLote = (): ReactElement | null => {
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    void parecerLotePendentes().then((r) => {
      setTotal(r?.pendentes.length ?? null);
    });
  }, []);

  const disparar = async (): Promise<void> => {
    if (busy || total === null || total === 0) return;
    if (
      !window.confirm(
        `Enviar o PARECER (dossiê + pedido de confirmação) para ${String(total)} cliente(s) da fase 1 que ainda não o receberam?`,
      )
    )
      return;
    setBusy(true);
    setResultado(null);
    const r = await dispararParecerLote();
    setResultado(
      r === null
        ? 'Falha no disparo — tente novamente.'
        : `Enviados: ${String(r.enviados)} · Pulados: ${String(r.pulados)}${r.erros.length > 0 ? ` · ${r.erros.slice(0, 5).join('; ')}` : ''}`,
    );
    setTotal(0);
    setBusy(false);
  };

  if (total === null || (total === 0 && resultado === null)) return null;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>📨 Parecer + confirmação (base antiga)</strong>
        <span className="badge warn">{total} sem parecer</span>
        <button
          type="button"
          className="btn primary"
          disabled={busy || total === 0}
          onClick={() => {
            void disparar();
          }}
        >
          {busy ? 'Enviando…' : 'Enviar parecer em lote'}
        </button>
      </div>
      <p className="page-sub" style={{ margin: '6px 0 0' }}>
        A AHRI envia o dossiê jurídico + o pedido de confirmação a quem completou a fase 1 e ainda
        não o recebeu. Quem responder SIM entra na mesa do Atendimento Humanizado.
      </p>
      {resultado !== null ? <p style={{ marginTop: 6, fontSize: 13 }}>{resultado}</p> : null}
    </div>
  );
};

export default DisparoParecerEmLote;
