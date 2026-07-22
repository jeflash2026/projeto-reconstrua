// 15C-2 · TELA 3 — Nova Solicitação (com preview da mensagem da AHRI). Aceita
// pré-preenchimento por query (?caso=&cliente=) para vir de um processo.
// Decreto Tráfego Pago: o advogado escolhe o CLIENTE PELO NOME (só os que o
// escritório destinou a ele) — caso e WhatsApp saem da seleção, sem digitação.
import type { ReactElement } from 'react';
import Link from 'next/link';
import NovaSolicitacaoForm from '../../../../components/nova-solicitacao-form';
import { advogadoId, getJson, type Perfil } from '../../../../lib/api';

interface MeuCliente {
  missionId: string;
  chatId: string;
  nome: string;
}

const NovaPage = async ({
  searchParams,
}: {
  searchParams: { caso?: string; cliente?: string };
}): Promise<ReactElement> => {
  const perfil = advogadoId() !== null ? await getJson<Perfil>('/advogado/perfil') : null;
  const meus =
    advogadoId() !== null ? await getJson<{ clientes: MeuCliente[] }>('/advogado/clientes') : null;
  return (
    <>
      <Link href="/solicitacoes" className="sol-voltar">
        ← Solicitações
      </Link>
      <h1 className="page-title">Solicitar Documento</h1>
      <p className="page-sub">
        Você define o que precisa; a AHRI conversa com o cliente, cobra com gentileza e te avisa
        quando chegar.
      </p>
      <NovaSolicitacaoForm
        casoInicial={searchParams.caso ?? ''}
        clienteInicial={searchParams.cliente ?? ''}
        requestedBy={perfil?.name ?? 'Seu advogado'}
        meusClientes={meus?.clientes ?? []}
      />
    </>
  );
};

export default NovaPage;
