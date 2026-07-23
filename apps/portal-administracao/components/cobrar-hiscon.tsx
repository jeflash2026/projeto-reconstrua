'use client';
// COBRAR HISCON — botão de follow-up na lista de clientes (Fase 1). Reutiliza
// INTEGRALMENTE o reaquecimento autorizado (POST /admin/reaquecimento/:chatId):
// a AHRI envia a mensagem do estágio do lead — que, para quem ainda não mandou o
// HISCON, é justamente o pedido do HISCON. Os guardrails (intervalo/teto) valem no
// servidor, então o clique nunca vira spam.
import { useState, type ReactElement } from 'react';
import { autorizarReaquecimento } from '../lib/actions';

const CobrarHiscon = ({ chatId }: { chatId: string }): ReactElement => {
  const [estado, setEstado] = useState<'ocioso' | 'enviando' | 'ok' | 'erro'>('ocioso');
  const [msg, setMsg] = useState<string | null>(null);

  const cobrar = async (): Promise<void> => {
    if (estado === 'enviando') return;
    setEstado('enviando');
    setMsg(null);
    const r = await autorizarReaquecimento(chatId);
    if (r.ok) {
      setEstado('ok');
    } else {
      setEstado('erro');
      setMsg(r.error);
    }
  };

  if (estado === 'ok') return <span className="badge ok">HISCON cobrado ✓</span>;

  return (
    <div className="form-row" style={{ margin: 0, gap: 6, alignItems: 'center' }}>
      <button
        className="primary"
        disabled={estado === 'enviando'}
        onClick={() => {
          void cobrar();
        }}
      >
        {estado === 'enviando' ? 'Enviando…' : 'Cobrar HISCON'}
      </button>
      {estado === 'erro' ? (
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{msg ?? 'falhou'}</span>
      ) : null}
    </div>
  );
};

export default CobrarHiscon;
