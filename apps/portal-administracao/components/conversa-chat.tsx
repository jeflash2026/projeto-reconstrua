'use client';
// CONVERSA DO CLIENTE (decreto 2026-07-31) — o diálogo cliente ↔ AHRI em
// BOLHAS, estilo WhatsApp, para auditoria humana. Nasceu com o canal oficial
// Meta: o número novo não tem aplicativo — o painel É o lugar de ler as
// conversas, de TODOS os canais (oficial/Evolution/webchat). Client component
// só pelo auto-scroll ao fim (a mensagem mais recente sempre à vista).
import { useEffect, useRef, type ReactElement } from 'react';

export interface BolhaConversa {
  de: 'cliente' | 'ahri';
  texto: string;
  em: string;
}

const ROTULO_CANAL: Record<string, string> = {
  meta: 'WhatsApp oficial (16 99636-9934)',
  evolution: 'WhatsApp (instância Evolution)',
  webchat: 'Webchat do site',
};

function horaLegivel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ConversaChat = ({
  mensagens,
  canal,
}: {
  mensagens: BolhaConversa[];
  canal: string | null;
}): ReactElement => {
  const fimRef = useRef<HTMLDivElement>(null);
  // A mensagem mais recente sempre à vista (como no WhatsApp).
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'nearest' });
  }, [mensagens.length]);

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>Conversa ({mensagens.length})</h3>
        {canal !== null ? (
          <span className="badge accent">{ROTULO_CANAL[canal] ?? canal}</span>
        ) : null}
      </div>
      {mensagens.length === 0 ? (
        <div className="empty">Sem mensagens ainda.</div>
      ) : (
        <div
          style={{
            maxHeight: 480,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '4px 2px',
          }}
        >
          {mensagens.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.de === 'cliente' ? 'flex-start' : 'flex-end',
                maxWidth: '78%',
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: 14,
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                background: m.de === 'cliente' ? 'rgba(148,163,184,0.14)' : 'rgba(37,211,102,0.14)',
                border: `1px solid ${
                  m.de === 'cliente' ? 'rgba(148,163,184,0.25)' : 'rgba(37,211,102,0.3)'
                }`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.65,
                  marginBottom: 2,
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'space-between',
                }}
              >
                <strong>{m.de === 'cliente' ? 'Cliente' : 'AHRI'}</strong>
                <span className="mono">{horaLegivel(m.em)}</span>
              </div>
              {m.texto}
            </div>
          ))}
          <div ref={fimRef} />
        </div>
      )}
    </div>
  );
};

export default ConversaChat;
