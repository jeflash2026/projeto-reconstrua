'use client';
// CONEXÃO WHATSAPP — a tela pela qual o Administrador gerencia a instância Evolution
// SEM depender do painel da Evolution. Verifica status, cria nova instância (Founder),
// exibe o QR (auto-refresh), detecta a conexão e VALIDA que o ownerJid é o número
// oficial. As operações destrutivas passam por Server Actions que injetam o segredo
// Founder no servidor (nunca no browser).
import { useEffect, useState, useCallback, type ReactElement } from 'react';
import {
  fetchWhatsappStatus, fetchWhatsappQr, confirmWhatsapp, fetchApplyInstructions,
  createWhatsappInstance, discardWhatsappInstance, runWhatsappDiagnostics,
  type WhatsAppStatus, type WhatsAppQr, type ApplyInstructions, type DiagnosticReport,
} from '../lib/actions';

function fmtNumber(digits: string): string {
  return digits ? `+${digits}` : '—';
}

const WhatsAppConnection = (): ReactElement => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<WhatsAppQr | null>(null);
  const [activeInstance, setActiveInstance] = useState<string>('');
  const [newName, setNewName] = useState('reconstrua-prod');
  const [apply, setApply] = useState<ApplyInstructions | null>(null);
  // GO-LIVE-05 (BUG 2): diagnóstico sob demanda.
  const [diag, setDiag] = useState<DiagnosticReport | null>(null);
  const [diagErr, setDiagErr] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  const diagnosticar = async (): Promise<void> => {
    setDiagBusy(true); setDiag(null); setDiagErr(null);
    const res = await runWhatsappDiagnostics();
    setDiag(res.report);
    setDiagErr(res.error);
    setDiagBusy(false);
  };

  const refresh = useCallback(async (): Promise<void> => {
    const s = await fetchWhatsappStatus();
    setStatus(s);
    setLoading(false);
    if (s && (s.pending?.instance || s.active.instance)) {
      setActiveInstance((prev) => prev || s.pending?.instance || s.active.instance);
    }
  }, []);

  // Poll de status (tempo real).
  useEffect(() => {
    void refresh();
    const t = setInterval(() => { void refresh(); }, 5000);
    return () => { clearInterval(t); };
  }, [refresh]);

  // Auto-refresh do QR enquanto aguarda leitura (o QR da Evolution expira).
  useEffect(() => {
    if (!qr || !activeInstance) return;
    const t = setInterval(() => {
      void (async () => {
        const fresh = await fetchWhatsappQr(activeInstance);
        if (fresh?.base64) setQr(fresh);
      })();
    }, 20000);
    return () => { clearInterval(t); };
  }, [qr, activeInstance]);

  const connected = status?.matchesOfficial === true && status.live?.state === 'open';

  const createNew = async (): Promise<void> => {
    if (busy || newName.trim() === '') return;
    setBusy(true); setMsg(null); setError(null);
    const res = await createWhatsappInstance(newName.trim());
    if (res.ok && res.data) {
      setActiveInstance(res.data.instanceName);
      setQr(res.data.qr);
      setMsg('Instância criada. Leia o QR Code com o número oficial (+55 41 3798-9737).');
      void refresh();
    } else {
      // GO-LIVE-03 (item 6): a CAUSA real vem da API/servidor — nunca um erro genérico.
      setError(res.error ?? 'Falha ao criar a instância.');
    }
    setBusy(false);
  };

  const regenerateQr = async (): Promise<void> => {
    if (!activeInstance) return;
    setBusy(true); setError(null);
    const fresh = await fetchWhatsappQr(activeInstance);
    setQr(fresh);
    setBusy(false);
  };

  const confirm = async (): Promise<void> => {
    if (!activeInstance || busy) return;
    setBusy(true); setMsg(null); setError(null);
    const res = await confirmWhatsapp(activeInstance);
    if (res?.connected) {
      setMsg('Conexão confirmada com o número oficial.');
      setQr(null);
      void refresh();
    } else {
      setError(res?.error ?? 'Não foi possível confirmar. Gere um novo QR.');
    }
    setBusy(false);
  };

  const discardOld = async (instance: string): Promise<void> => {
    if (busy || instance === '') return;
    if (!window.confirm(`Descartar a instância "${instance}"? Esta ação é destrutiva.`)) return;
    setBusy(true); setMsg(null); setError(null);
    const res = await discardWhatsappInstance(instance);
    if (res.ok && res.data?.discarded) { setMsg(`Instância "${instance}" descartada.`); void refresh(); }
    else setError(res.error ?? 'Falha ao descartar a instância.');
    setBusy(false);
  };

  const showApply = async (): Promise<void> => {
    setApply(await fetchApplyInstructions());
  };

  // GO-LIVE-05 (BUG 2): o painel de diagnóstico — sempre disponível, INCLUSIVE
  // quando o status falha. Cada passo mostra a causa EXATA (nunca "API indisponível").
  const DiagPanel = (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Diagnóstico da conexão</h3>
      <p className="page-sub">Testa Evolution, autenticação, instância, webhook, banco e filas — e mostra onde falhou.</p>
      <button disabled={diagBusy} onClick={() => { void diagnosticar(); }}>
        {diagBusy ? 'Diagnosticando…' : 'Diagnóstico'}
      </button>
      {diagErr ? <div className="error-box" style={{ marginTop: 12 }}>{diagErr}</div> : null}
      {diag ? (
        <div style={{ marginTop: 12 }}>
          {diag.steps.map((s) => (
            <div key={s.step} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border, #2a2a2a)' }}>
              <span aria-hidden style={{ color: s.ok ? 'var(--accent, #1da851)' : 'var(--brand, #d90416)' }}>{s.ok ? '✓' : '✗'}</span>
              <span style={{ minWidth: 220, fontWeight: 600 }}>{s.step}</span>
              <span style={{ color: 'var(--text-dim)' }}>{s.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (loading) return <div className="card">Carregando conexão…</div>;
  if (!status) {
    return (
      <>
        <div className="error-box" style={{ marginBottom: 16 }}>
          Não foi possível carregar o status da conexão. Rode o diagnóstico abaixo para ver a causa exata.
        </div>
        {DiagPanel}
      </>
    );
  }

  return (
    <>
      {DiagPanel}
      {/* GO-LIVE-03 (item 6): pré-condições ausentes são DECLARADAS — nunca botões mortos. */}
      {status.capabilities.canManageInstances ? null : (
        <div className="error-box" style={{ marginBottom: 16 }}>
          <strong>Gerenciamento de instâncias indisponível.</strong> Faltam no .env do servidor:{' '}
          <span className="mono">{status.capabilities.missing.join(', ')}</span>. Defina-os e recrie os
          containers (api e portal-admin) para criar/descartar instâncias por aqui.
        </div>
      )}
      {/* Estado atual */}
      {connected ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <h3 style={{ color: 'var(--accent)' }}>✅ WhatsApp conectado</h3>
          <p>Número: <strong className="mono">{fmtNumber(status.live?.number ?? '')}</strong></p>
          <p>OwnerJid: <span className="mono">{status.live?.ownerJid ?? '—'}</span></p>
          <p>Status: <span className="badge accent">ONLINE</span></p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Última sincronização: {status.lastSyncAt ?? '—'}</p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Estado da conexão</h3>
          <p>Instância ativa (app): <span className="mono">{status.active.instance || '—'}</span> · número <span className="mono">{fmtNumber(status.active.number)}</span></p>
          {status.live ? (
            <p>Ao vivo (Evolution): estado <span className="badge dim">{status.live.state}</span> · número <span className="mono">{fmtNumber(status.live.number)}</span>
              {status.live.number && status.live.number !== status.officialNumber ? <span className="badge warn" style={{ marginLeft: 6 }}>número divergente</span> : null}
            </p>
          ) : <p style={{ color: 'var(--text-dim)' }}>Sem instância conectada.</p>}
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Número oficial esperado: +{status.officialNumber}</p>
        </div>
      )}

      {/* Config pendente de aplicação */}
      {status.hasPendingApply ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warn, #fbbf24)' }}>
          <h3>Configuração pendente de aplicação</h3>
          <p>Pendente: <span className="mono">{status.pending?.instance}</span> · número <span className="mono">{fmtNumber(status.pending?.number ?? '')}</span></p>
          <button disabled={busy} onClick={() => { void showApply(); }}>Aplicar Configuração</button>
          {apply?.pending ? (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <p style={{ color: 'var(--text-dim)' }}>{apply.note}</p>
              <pre style={{ overflow: 'auto' }}>EVOLUTION_INSTANCE={apply.envToSet?.EVOLUTION_INSTANCE}
WHATSAPP_NUMBER={apply.envToSet?.WHATSAPP_NUMBER}</pre>
              <p className="mono">{apply.command}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Instância antiga → descartar */}
      {status.active.instance && !connected ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Instância antiga</h3>
          <p>Número conectado: <span className="mono">{fmtNumber(status.live?.number ?? status.active.number)}</span></p>
          <button disabled={busy} onClick={() => { void discardOld(status.active.instance); }}>Descartar instância antiga</button>
        </div>
      ) : null}

      {/* Criar nova instância + QR */}
      {!connected ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Nova instância de produção</h3>
          <div className="form-row">
            <input type="text" value={newName} onChange={(e) => { setNewName(e.target.value); }} placeholder="nome da instância" />
            <button className="primary" disabled={busy} onClick={() => { void createNew(); }}>Criar nova instância</button>
          </div>
          {qr ? (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              {qr.base64 ? <img src={qr.base64} alt="QR Code do WhatsApp" style={{ width: 260, height: 260 }} /> : <p>QR indisponível.</p>}
              {qr.pairingCode ? <p>Código de pareamento: <strong className="mono">{qr.pairingCode}</strong></p> : null}
              <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Leia com o número oficial +55 41 3798-9737. O QR renova automaticamente.</p>
              <div className="form-row" style={{ justifyContent: 'center' }}>
                <button disabled={busy} onClick={() => { void regenerateQr(); }}>Gerar novo QR</button>
                <button className="primary" disabled={busy} onClick={() => { void confirm(); }}>Confirmar conexão</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="error-box" style={{ marginBottom: 12 }}>{error}</div> : null}
      {msg ? <p style={{ color: 'var(--text-dim)' }}>{msg}</p> : null}
    </>
  );
};

export default WhatsAppConnection;
