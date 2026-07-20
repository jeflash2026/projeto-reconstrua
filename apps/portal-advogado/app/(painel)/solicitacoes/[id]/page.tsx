// 15C-2 · TELA 2 — Detalhe da solicitação: cabeçalho + LINHA DO TEMPO completa
// (o histórico nunca é escondido) + ações (abrir/copiar/reabrir/cancelar).
import type { ReactElement } from 'react';
import Link from 'next/link';
import AutoRefresh from '../../../../components/auto-refresh';
import SolicitacaoAcoes from '../../../../components/solicitacao-acoes';
import { getJson, type Solicitacao, type SolicitacaoHistorico } from '../../../../lib/api';
import { STATUS_AMIGAVEL, STATUS_CLASSE, prazoDe } from '../../../../components/solicitacao-status';

const ICONE: Record<string, string> = { PENDING: '📨', AWAITING_CONFIRMATION: '❓', RECEIVED: '📥', REOPENED: '↩️', CANCELLED: '🚫' };

function tituloDoPasso(h: SolicitacaoHistorico): string {
  if (h.de === null) return 'Solicitação criada';
  if (h.de === h.para && h.nota === 'mensagem enviada ao cliente') return 'AHRI notificou o cliente';
  if (h.de === h.para && h.nota === 'lembrete automático enviado') return 'AHRI lembrou o cliente';
  switch (h.para) {
    case 'AWAITING_CONFIRMATION': return 'AHRI confirmando com o cliente';
    case 'RECEIVED': return 'Documento recebido';
    case 'REOPENED': return 'Solicitação reaberta pelo advogado';
    case 'CANCELLED': return 'Solicitação cancelada';
    case 'PENDING': return 'Voltou a aguardar o cliente';
  }
}

const DetalhePage = async ({ params }: { params: { id: string } }): Promise<ReactElement> => {
  const s = await getJson<Solicitacao>(`/advogado/document-requests/${encodeURIComponent(params.id)}`);
  if (!s) {
    return (
      <>
        <h1 className="page-title">Solicitação</h1>
        <div className="error-box">Solicitação não encontrada (ou a operação está indisponível).</div>
        <Link href="/solicitacoes" className="sol-btn" style={{ marginTop: 12, display: 'inline-block' }}>← Voltar às solicitações</Link>
      </>
    );
  }
  const prazo = prazoDe(s.dueAt, s.status);
  return (
    <>
      <AutoRefresh seconds={15} />
      <Link href="/solicitacoes" className="sol-voltar">← Solicitações</Link>

      {/* Cabeçalho */}
      <div className="sol-detalhe-head">
        <div>
          <h1 className="page-title">{s.documentName}</h1>
          <div className="sol-detalhe-meta">
            <span className="mono" title="Cliente">{s.clientId.replace('@s.whatsapp.net', '')}</span>
            <span className="mono" title="Processo/Caso">caso {s.caseId}</span>
            <span title="Advogado responsável">{s.requestedBy}</span>
            {s.priority === 'alta' ? <span className="sol-tag sol-tag-alta">PRIORIDADE ALTA</span> : null}
            <span className={prazo.vencida ? 'sol-vencida' : ''}>{prazo.texto}</span>
          </div>
        </div>
        <span className={`sol-tag sol-tag-grande ${STATUS_CLASSE[s.status]}`}>{STATUS_AMIGAVEL[s.status]}</span>
      </div>

      {s.optionalMessage ? <div className="sol-mensagem-original">Sua mensagem ao cliente: “{s.optionalMessage}”</div> : null}

      <SolicitacaoAcoes s={s} />

      {/* Linha do tempo completa — nunca esconder o histórico */}
      <div className="sol-timeline-wrap">
        <h3 className="sol-secao">Linha do tempo</h3>
        <ol className="sol-timeline">
          {s.history.map((h, i) => (
            <li key={i} className="sol-passo">
              <span className="sol-passo-icone" aria-hidden>{h.de === null ? '📝' : h.de === h.para ? '💬' : ICONE[h.para]}</span>
              <div className="sol-passo-corpo">
                <div className="sol-passo-titulo">{tituloDoPasso(h)}</div>
                {h.nota ? <div className="sol-passo-nota">{h.nota}</div> : null}
                <div className="sol-passo-meta">{new Date(h.at).toLocaleString('pt-BR')} · por {h.por}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
};

export default DetalhePage;
