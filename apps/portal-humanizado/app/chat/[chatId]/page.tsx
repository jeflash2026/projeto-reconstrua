// PÁGINA DO CHAT DA EQUIPE (decreto 2026-08-05) — a conversa 100% humana com
// UM cliente pelo número (41) da Meta, dentro do portal. A AHRI nunca fala
// aqui; quem responde é a secretária logada. O cabeçalho traz o cliente da
// mesa (quando é da mesa) — número desconhecido também aparece: cliente que
// escreveu direto ao número da equipe.
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { getJson, type ClienteHumanizado } from '../../../lib/api';
import { operadorDaSessao, HUMANIZADO_SESSION_COOKIE } from '../../../lib/session';
import { SairButton } from '../../../components/sair-button';
import ChatConversa from '../../../components/chat-conversa';
import StatusDocsCliente from '../../../components/status-docs-cliente';

export const dynamic = 'force-dynamic';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

const ChatPage = async ({
  params,
  searchParams,
}: {
  params: { chatId: string };
  searchParams: { apresentacao?: string };
}): Promise<ReactElement> => {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO_SESSAO, cookie) === null) redirect('/login');

  const chatId = decodeURIComponent(params.chatId);
  const telefone = chatId.split('@')[0] ?? chatId;
  const data = await getJson<{ clientes: ClienteHumanizado[] }>(
    '/admin/humanizado/clientes',
    20000,
  );
  const cliente = data?.clientes.find((c) => c.chatId === chatId) ?? null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ fontSize: '1.2rem' }}>
          💬 {cliente?.nome ?? `Cliente ${telefone}`}
        </h1>
        <SairButton />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link className="btn" href="/">
          ← Voltar à mesa
        </Link>
        <span className="mono" style={{ fontSize: 12, color: 'var(--texto-dim)' }}>
          {telefone}
        </span>
        {cliente !== null ? <span className="badge">{cliente.uf}</span> : null}
      </div>
      <p className="page-sub" style={{ marginTop: 8 }}>
        Conversa pelo número oficial da equipe — 100% humana (a AHRI não responde aqui). Anexo que o
        cliente devolver pode ser salvo no perfil com um clique em &quot;Confirmar&quot;.
      </p>
      {/* STATUS DOS DOCUMENTOS (2026-08-06): o que falta / 100% verde. */}
      {cliente !== null ? (
        <StatusDocsCliente docs={cliente.docs} completo={cliente.completo} />
      ) : null}
      <ChatConversa
        chatId={chatId}
        nomeCliente={cliente?.nome ?? null}
        // Botão da mesa "mensagem pronta": chega com a apresentação da Layara
        // armada — um clique dispara o template com o nome do cliente.
        sugerirApresentacao={searchParams.apresentacao === '1'}
      />
    </div>
  );
};

export default ChatPage;
