// PAINEL CONVERSAS (pedido do dono, 2026-08-05) — a janela estilo WhatsApp do
// canal da equipe: todas as conversas com nome do cliente (a mesa dá os nomes),
// busca, chat ao lado e os painéis inteligentes que filtram a lista.
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { getJson, type ClienteHumanizado } from '../../lib/api';
import { operadorDaSessao, HUMANIZADO_SESSION_COOKIE } from '../../lib/session';
import { SairButton } from '../../components/sair-button';
import ConversasPainel, { type ClienteDaMesa } from '../../components/conversas-painel';

export const dynamic = 'force-dynamic';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

const ConversasPage = async (): Promise<ReactElement> => {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO_SESSAO, cookie) === null) redirect('/login');

  const data = await getJson<{ clientes: ClienteHumanizado[] }>(
    '/admin/humanizado/clientes',
    20000,
  );
  const clientes: ClienteDaMesa[] = (data?.clientes ?? []).map((c) => ({
    chatId: c.chatId,
    nome: c.nome,
    uf: c.uf,
    completo: c.completo,
    aguardandoAssinatura: c.aguardandoAssinatura,
    aguardandoDesde: c.aguardandoDesde ?? null,
    descartado: c.descartado === true,
    docs: c.docs,
  }));

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '16px 20px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">💬 Conversas da equipe</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" href="/">
            ← Mesa de atendimento
          </Link>
          <Link className="btn" href="/prontos">
            ✅ Clientes Prontos
          </Link>
          <SairButton />
        </div>
      </div>
      <p className="page-sub">
        Todas as conversas do número oficial da equipe — 100% humanas (a AHRI não responde aqui).
        Clique nos painéis para filtrar; clique no cliente para abrir a conversa ao lado.
      </p>
      <ConversasPainel clientes={clientes} />
    </div>
  );
};

export default ConversasPage;
