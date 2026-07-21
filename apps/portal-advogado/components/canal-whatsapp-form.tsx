'use client';
// Decreto Tráfego Pago · B2 — o NÚMERO de WhatsApp do advogado: é para ele que a
// AHRI avisa quando um documento solicitado chega. Grava o NotificationChannel.
import { useState, useTransition, type ReactElement } from 'react';
import { definirCanalWhatsApp } from '../lib/actions';

const CanalWhatsAppForm = ({ atual }: { atual: string | null }): ReactElement => {
  const [numero, setNumero] = useState(atual ?? '');
  const [salvo, setSalvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const salvar = (): void => {
    setSalvo(null);
    setErro(null);
    // Transition SÍNCRONA envolvendo o trabalho async — compila igual nas
    // tipagens do React 18 e 19 (async direto quebrava o build Docker quando a
    // resolução de tipos mudou com a entrada do React 19 no workspace).
    iniciar(() => {
      void (async () => {
        const r = await definirCanalWhatsApp(numero);
        if (r.ok) setSalvo('Número salvo — a AHRI avisará você por este WhatsApp.');
        else setErro(r.error ?? 'não consegui salvar');
      })();
    });
  };

  return (
    <div className="card">
      <h3>Meu WhatsApp (avisos da AHRI)</h3>
      <p className="page-sub">
        Quando um documento solicitado chegar, a AHRI avisa você neste número.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="sol-input mono"
          style={{ maxWidth: 260 }}
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
          }}
          placeholder="5541999999999 (DDI+DDD+número)"
          inputMode="numeric"
        />
        <button className="sol-btn sol-btn-primario" onClick={salvar} disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar número'}
        </button>
      </div>
      {salvo ? <p className="sol-nota">✅ {salvo}</p> : null}
      {erro ? <p className="sol-erro">{erro}</p> : null}
    </div>
  );
};

export default CanalWhatsAppForm;
