'use client';
// CENTRAL DE PERÍCIA DIGITAL — fila de casos + criação (a partir do HISCON do
// cliente). Atrás da feature flag na API; esta tela só aparece quando habilitada.
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pdCriarCaso, type PdCaso } from '../lib/actions';

const STATUS_ROTULO: Record<string, string> = {
  HISCON_RECEBIDO: 'HISCON recebido',
  CONTRATOS_IDENTIFICADOS: 'Contratos identificados',
  DOCUMENTACAO_PENDENTE: 'Documentação pendente',
  EVIDENCIAS_EM_ANALISE: 'Evidências em análise',
  MINUTA_GERADA: 'Minuta gerada',
  EM_REVISAO_PELO_PERITO: 'Em revisão pelo perito',
  AJUSTES_SOLICITADOS: 'Ajustes solicitados',
  APROVADO_PELO_PERITO: 'Aprovado pelo perito',
  ASSINADO: 'Assinado',
  LIBERADO_PARA_O_ADVOGADO: 'Liberado para o advogado',
  CANCELADO: 'Cancelado',
};

const PericiaDigitalCasos = ({ casos }: { casos: PdCaso[] }): ReactElement => {
  const router = useRouter();
  const [chatId, setChatId] = useState('');
  const [numeroCaso, setNumeroCaso] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const criar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const r = await pdCriarCaso(chatId.trim(), numeroCaso.trim());
    if (!r.ok) setErro(r.error ?? 'falha ao criar');
    else {
      setChatId('');
      setNumeroCaso('');
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Abrir caso pericial (a partir do HISCON)</h3>
        <div className="form-row">
          <input
            placeholder="WhatsApp do cliente (chatId)"
            value={chatId}
            onChange={(e) => {
              setChatId(e.target.value);
            }}
          />
          <input
            placeholder="Nº do caso (ex.: C-2026-001)"
            value={numeroCaso}
            onChange={(e) => {
              setNumeroCaso(e.target.value);
            }}
          />
          <button
            className="primary"
            disabled={busy || chatId.trim() === '' || numeroCaso.trim() === ''}
            onClick={() => {
              void criar();
            }}
          >
            {busy ? 'Abrindo…' : 'Abrir caso'}
          </button>
        </div>
        {erro ? <div className="error-box">{erro}</div> : null}
      </div>

      <div className="card">
        <h3>Casos periciais ({casos.length})</h3>
        {casos.length === 0 ? (
          <div className="empty">Nenhum caso aberto ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nº do caso</th>
                  <th>Cliente</th>
                  <th>Contratos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {casos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/pericia-digital/${encodeURIComponent(c.id)}`}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                      >
                        {c.numeroCaso}
                      </Link>
                    </td>
                    <td>{c.dados.nomeCliente ?? c.chatId}</td>
                    <td>{c.fichas.length}</td>
                    <td>
                      <span className="badge accent">{STATUS_ROTULO[c.status] ?? c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default PericiaDigitalCasos;
