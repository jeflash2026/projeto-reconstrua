// 15C-2 · TELA 1 — Solicitações de Documentos do advogado. Dados do read model
// via /advogado/document-requests; filtros e busca no cliente. Estados vazio e
// de erro explícitos. Nada recalculado fora dos Read Models.
import type { ReactElement } from 'react';
import Link from 'next/link';
import AutoRefresh from '../../../components/auto-refresh';
import SolicitacoesList from '../../../components/solicitacoes-list';
import { getJson, type Solicitacao } from '../../../lib/api';

const SolicitacoesPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ solicitacoes: Solicitacao[] }>('/advogado/document-requests');
  if (!data) {
    return (
      <>
        <h1 className="page-title">Solicitações de Documentos</h1>
        <div className="error-box">
          Não consegui falar com a operação agora. Tente novamente em instantes.
        </div>
      </>
    );
  }
  return (
    <>
      <AutoRefresh seconds={20} />
      <div className="sol-header">
        <div>
          <h1 className="page-title">Solicitações de Documentos</h1>
          <p className="page-sub">
            Você pede aqui; a AHRI conversa com o cliente e avisa quando o documento chegar.
          </p>
        </div>
        <Link href="/solicitacoes/nova" className="sol-btn sol-btn-primario">
          + Solicitar documento
        </Link>
      </div>
      <SolicitacoesList solicitacoes={data.solicitacoes} />
    </>
  );
};

export default SolicitacoesPage;
