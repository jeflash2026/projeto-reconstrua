'use client';
// COBRAR CPF (decreto 2026-07-27) — botão na aba Clientes para quem JÁ entregou
// o HISCON mas ainda não informou o CPF. A AHRI envia a mensagem canônica do
// dono; trava de 24h e regras duras valem no SERVIDOR (o clique nunca vira spam).
import { useState, type ReactElement } from 'react';
import { cobrarCpfCliente } from '../lib/actions';

const CobrarCpf = ({ chatId }: { chatId: string }): ReactElement => {
  const [estado, setEstado] = useState<'ocioso' | 'enviando' | 'ok' | 'erro'>('ocioso');
  const [msg, setMsg] = useState<string | null>(null);

  const cobrar = async (): Promise<void> => {
    if (estado === 'enviando') return;
    setEstado('enviando');
    setMsg(null);
    const r = await cobrarCpfCliente(chatId);
    if (r.ok) {
      setEstado('ok');
    } else {
      setEstado('erro');
      setMsg(r.error);
    }
  };

  if (estado === 'ok') return <span className="badge ok">CPF cobrado ✓</span>;

  return (
    <div className="form-row" style={{ margin: 0, gap: 6, alignItems: 'center' }}>
      <button
        className="primary"
        disabled={estado === 'enviando'}
        onClick={() => {
          void cobrar();
        }}
      >
        {estado === 'enviando' ? 'Enviando…' : 'Cobrar CPF'}
      </button>
      {estado === 'erro' ? (
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{msg ?? 'falhou'}</span>
      ) : null}
    </div>
  );
};

export default CobrarCpf;
