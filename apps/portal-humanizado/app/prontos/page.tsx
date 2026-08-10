// CLIENTES PRONTOS (pedido do dono, 2026-08-09) — quem entregou os 4
// documentos vira CLIENTE: sai da fila de trabalho e entra nesta agenda
// permanente, organizada por ESTADO e por ADVOGADO. Serve para o contato
// FUTURO (pedir um documento novo, avisar de uma fase) — nada dispara daqui.
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { getJson, type AdvogadoOpcao, type ClienteHumanizado } from '../../lib/api';
import { operadorDaSessao, HUMANIZADO_SESSION_COOKIE } from '../../lib/session';
import { SairButton } from '../../components/sair-button';
import ProntosPainel, { type ClientePronto } from '../../components/prontos-painel';

export const dynamic = 'force-dynamic';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

const ProntosPage = async (): Promise<ReactElement> => {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO_SESSAO, cookie) === null) redirect('/login');

  const [data, advogadosData] = await Promise.all([
    getJson<{ clientes: ClienteHumanizado[] }>('/admin/humanizado/clientes', 20000),
    getJson<{ advogados: AdvogadoOpcao[] }>('/admin/humanizado/advogados', 10000),
  ]);

  // CLIENTE = documentação 100% entregue e não descartado.
  const prontos: ClientePronto[] = (data?.clientes ?? [])
    .filter((c) => c.completo && c.descartado !== true)
    .map((c) => ({
      chatId: c.chatId,
      nome: c.nome,
      telefone: c.telefone,
      uf: c.uf,
      contratos: c.contratos,
      potencial: c.potencial,
      confirmadoEm: c.confirmadoEm,
      advogadoId: c.advogadoId ?? null,
    }));

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '16px 20px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">✅ Clientes Prontos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" href="/">
            ← Mesa de atendimento
          </Link>
          <Link className="btn" href="/conversas">
            💬 Conversas
          </Link>
          <SairButton />
        </div>
      </div>
      <p className="page-sub">
        Documentação 100% entregue — estes já são CLIENTES da casa. O registro fica aqui para quando
        precisarmos chamar de volta (um documento novo, um aviso do processo), organizado por estado
        e por advogado responsável.
      </p>

      {data === null ? (
        <div className="error-box">API indisponível — recarregue a página.</div>
      ) : (
        <ProntosPainel clientes={prontos} advogados={advogadosData?.advogados ?? []} />
      )}
    </div>
  );
};

export default ProntosPage;
