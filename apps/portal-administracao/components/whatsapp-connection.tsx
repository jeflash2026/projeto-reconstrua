'use client';
// CONEXÃO WHATSAPP — tela MÍNIMA (STEP 7B): apenas Status da conexão, botão
// "Gerar QR Code", o QR Code (quando existir) e "Atualizar Status". Sem lógica de
// Evolution/backend: o componente só RENDERIZA o base64/pairingCode já retornados
// pela API (fetchWhatsappQr) — corrige o QR que não aparecia (base64 sem prefixo
// data:) e remove o excesso de informações técnicas.
import { useEffect, useState, useCallback, type ReactElement } from 'react';
import { fetchWhatsappStatus, fetchWhatsappQr, type WhatsAppStatus, type WhatsAppQr } from '../lib/actions';

function fmtNumber(digits: string): string {
  return digits ? `+${digits}` : '—';
}

/** Aceita tanto data-URL quanto base64 cru (Evolution varia) — sempre renderizável. */
function qrSrc(base64: string | null): string | null {
  if (!base64) return null;
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

const WhatsAppConnection = (): ReactElement => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<WhatsAppQr | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    const s = await fetchWhatsappStatus();
    setStatus(s);
    setLoading(false);
    if (s === null) setError('Não foi possível carregar o status (API indisponível).');
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const instance = status?.resolvedInstance ?? (status?.active.instance || '');
  const connected = status?.matchesOfficial === true && status.live?.state === 'open';

  const gerarQr = async (): Promise<void> => {
    if (busy || instance === '') return;
    setBusy(true); setError(null); setQr(null);
    const fresh = await fetchWhatsappQr(instance);
    if (fresh && (fresh.base64 || fresh.pairingCode)) setQr(fresh);
    else setError('Não foi possível gerar o QR agora. Clique em "Atualizar Status" e tente novamente.');
    setBusy(false);
    void refresh();
  };

  if (loading) return <div className="card">Carregando…</div>;

  const src = qrSrc(qr?.base64 ?? null);

  return (
    <>
      {/* 1) Status da conexão */}
      <div className="card" style={{ marginBottom: 16, borderColor: connected ? 'var(--accent)' : undefined }}>
        <h3 style={connected ? { color: 'var(--accent)' } : undefined}>
          {connected ? '✅ WhatsApp conectado' : '⚠️ WhatsApp desconectado'}
        </h3>
        {connected ? (
          <p>Número: <strong className="mono">{fmtNumber(status?.live?.number ?? '')}</strong></p>
        ) : (
          <>
            <p>Estado: <span className="badge dim">{status?.live?.state ?? 'sem conexão'}</span></p>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Gere o QR e leia com o WhatsApp oficial (+{status?.officialNumber ?? '—'}) para conectar.
            </p>
          </>
        )}
      </div>

      {/* 2) Ações: Gerar QR Code + Atualizar Status */}
      <div className="card">
        <div className="form-row">
          <button className="primary" disabled={busy || instance === ''} onClick={() => { void gerarQr(); }}>
            {busy ? 'Gerando…' : 'Gerar QR Code'}
          </button>
          <button disabled={busy} onClick={() => { void refresh(); }}>Atualizar Status</button>
        </div>

        {error ? <div className="error-box" style={{ marginTop: 12 }}>{error}</div> : null}

        {/* 3) QR Code (quando existir) + pairingCode abaixo */}
        {src ? (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <img src={src} alt="QR Code do WhatsApp" style={{ width: 260, height: 260 }} />
            {qr?.pairingCode ? (
              <p style={{ marginTop: 8 }}>Código de pareamento: <strong className="mono">{qr.pairingCode}</strong></p>
            ) : null}
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              No celular oficial: WhatsApp → Aparelhos conectados → Conectar um aparelho.
            </p>
          </div>
        ) : qr?.pairingCode ? (
          <p style={{ marginTop: 16 }}>Código de pareamento: <strong className="mono">{qr.pairingCode}</strong></p>
        ) : null}
      </div>
    </>
  );
};

export default WhatsAppConnection;
