'use client';
// DISPARO EM LOTE DE CPF (decreto 2026-07-27) — cobra o CPF de N clientes que
// JÁ entregaram o HISCON. As regras duras (só sem CPF, trava de 24h) valem no
// SERVIDOR; bloqueados são pulados e a varredura segue até N elegíveis.
import { useState, type ReactElement } from 'react';
import { cobrarCpfCliente } from '../lib/actions';

const DisparoCpfEmLote = ({ chatIds }: { chatIds: readonly string[] }): ReactElement | null => {
  const total = chatIds.length;
  const [lote, setLote] = useState(Math.min(10, total));
  const [estado, setEstado] = useState<'ocioso' | 'disparando' | 'feito'>('ocioso');
  const [res, setRes] = useState<{
    enviados: number;
    pulados: number;
    motivos: [string, number][];
  } | null>(null);

  if (total === 0) return null;
  const n = Math.max(1, Math.min(lote || 1, total));

  const disparar = async (): Promise<void> => {
    if (estado === 'disparando') return;
    setEstado('disparando');
    setRes(null);
    let enviados = 0;
    let pulados = 0;
    const motivos = new Map<string, number>();
    for (const id of chatIds) {
      if (enviados >= n) break;
      const r = await cobrarCpfCliente(id);
      if (r.ok) enviados += 1;
      else {
        pulados += 1;
        const m = r.error ?? 'motivo desconhecido';
        motivos.set(m, (motivos.get(m) ?? 0) + 1);
      }
    }
    setRes({
      enviados,
      pulados,
      motivos: [...motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    });
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
        {estado === 'disparando' ? 'Disparando…' : `Cobrar CPF de ${String(n)}`}
      </button>
      {res ? (
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Enviados: <strong>{res.enviados}</strong> · Pulados: {res.pulados}
          {res.motivos.length > 0 ? (
            <>
              {' '}
              · Motivos:{' '}
              {res.motivos.map(([m, c], i) => (
                <span key={m}>
                  {i > 0 ? ' · ' : ''}
                  &quot;{m}&quot; ({c})
                </span>
              ))}
            </>
          ) : null}
        </span>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Mensagem canônica do CPF. Trava de 24h por cliente evita repetição.
        </span>
      )}
    </div>
  );
};

export default DisparoCpfEmLote;
