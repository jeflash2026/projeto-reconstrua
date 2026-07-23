'use client';
// DISPARO EM LOTE — cobra o HISCON de N clientes de uma vez (fase "Aguardando
// HISCON"). Reutiliza o MESMO reaquecimento autorizado por cliente; a TRAVA DE 24h
// (e o teto de tentativas) vale no SERVIDOR — clientes já cobrados nas últimas 24h
// são pulados e voltam a ficar elegíveis só depois desse período. Sequencial de
// propósito (nunca rajada), com relatório de enviados × não enviados.
import { useState, type ReactElement } from 'react';
import { autorizarReaquecimento } from '../lib/actions';

const DisparoEmLote = ({ chatIds }: { chatIds: readonly string[] }): ReactElement | null => {
  const total = chatIds.length;
  const [lote, setLote] = useState(Math.min(10, total));
  const [estado, setEstado] = useState<'ocioso' | 'disparando' | 'feito'>('ocioso');
  const [res, setRes] = useState<{ enviados: number; naoEnviados: number } | null>(null);

  if (total === 0) return null;
  const n = Math.max(1, Math.min(lote || 1, total));

  const disparar = async (): Promise<void> => {
    if (estado === 'disparando') return;
    setEstado('disparando');
    setRes(null);
    let enviados = 0;
    let naoEnviados = 0;
    for (const id of chatIds.slice(0, n)) {
      const r = await autorizarReaquecimento(id);
      if (r.ok) enviados += 1;
      else naoEnviados += 1;
    }
    setRes({ enviados, naoEnviados });
    setEstado('feito');
  };

  return (
    <div
      className="card"
      style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <strong>Disparo em lote</strong>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Quantidade:
        <input
          type="number"
          min={1}
          max={total}
          value={lote}
          onChange={(e) => {
            setLote(Number(e.target.value));
          }}
          style={{ width: 72 }}
          disabled={estado === 'disparando'}
        />
      </label>
      <button
        className="primary"
        disabled={estado === 'disparando'}
        onClick={() => {
          void disparar();
        }}
      >
        {estado === 'disparando' ? 'Disparando…' : `Cobrar HISCON de ${String(n)}`}
      </button>
      {res ? (
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Enviados: <strong>{res.enviados}</strong> · Não enviados: {res.naoEnviados} (já cobrados
          nas últimas 24h ou inelegíveis)
        </span>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          A AHRI pede o HISCON. Trava de 24h por cliente evita repetir cedo demais.
        </span>
      )}
    </div>
  );
};

export default DisparoEmLote;
