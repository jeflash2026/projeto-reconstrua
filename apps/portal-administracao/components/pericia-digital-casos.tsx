'use client';
// CENTRAL DE PERÍCIA DIGITAL — fila de casos + criação (a partir do HISCON do
// cliente). Atrás da feature flag na API; esta tela só aparece quando habilitada.
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pdCriarCaso, type PdCaso, type PdClienteComHiscon } from '../lib/actions';

/** O Nº do caso é só a ETIQUETA do laudo (como um nº de protocolo): identifica
 *  este caso na minuta, na cadeia de custódia e na conversa com o advogado.
 *  Sugerido automaticamente (PD-ANO-SEQ) para o admin não ter que inventar. */
function proximoNumeroCaso(casos: PdCaso[]): string {
  const ano = new Date().getFullYear();
  const prefixo = `PD-${String(ano)}-`;
  const usados = casos
    .map((c) => c.numeroCaso)
    .filter((n) => n.startsWith(prefixo))
    .map((n) => Number(n.slice(prefixo.length)))
    .filter((n) => Number.isFinite(n));
  const proximo = usados.length > 0 ? Math.max(...usados) + 1 : 1;
  return `${prefixo}${String(proximo).padStart(3, '0')}`;
}

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

const PericiaDigitalCasos = ({
  casos,
  clientes,
}: {
  casos: PdCaso[];
  clientes: PdClienteComHiscon[];
}): ReactElement => {
  const router = useRouter();
  const [chatId, setChatId] = useState('');
  const [numeroCaso, setNumeroCaso] = useState(() => proximoNumeroCaso(casos));
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Clientes que já viraram caso não aparecem de novo (o servidor recusaria).
  const jaComCaso = new Set(casos.map((c) => c.chatId));
  const disponiveis = clientes.filter((c) => !jaComCaso.has(c.chatId));

  const criar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const r = await pdCriarCaso(chatId.trim(), numeroCaso.trim());
    if (!r.ok) setErro(r.error ?? 'falha ao criar');
    else {
      setChatId('');
      setNumeroCaso(proximoNumeroCaso(casos));
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Abrir caso pericial (a partir do HISCON)</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          Escolha um cliente que já entregou o HISCON. O Nº do caso é apenas a etiqueta deste laudo
          (como um número de protocolo) — já vem preenchido, mas você pode trocar.
        </p>
        {disponiveis.length === 0 ? (
          <div className="empty">
            {clientes.length === 0
              ? 'Nenhum cliente com HISCON legível ainda.'
              : 'Todos os clientes com HISCON já têm caso pericial aberto.'}
          </div>
        ) : (
          <div className="form-row">
            <select
              value={chatId}
              onChange={(e) => {
                setChatId(e.target.value);
              }}
              style={{ flex: 2 }}
            >
              <option value="">Selecione o cliente…</option>
              {disponiveis.map((c) => (
                <option key={c.chatId} value={c.chatId}>
                  {c.quem} — {c.totalContratos} contrato(s)
                </option>
              ))}
            </select>
            <input
              placeholder="Nº do caso"
              title="Etiqueta deste laudo (nº de protocolo). Aparece na minuta e na cadeia de custódia."
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
        )}
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
