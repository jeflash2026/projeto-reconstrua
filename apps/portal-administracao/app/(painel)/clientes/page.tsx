// CLIENTES — a LISTA ÚNICA da Jornada A (R4): status DERIVADO em leitura (ALIR +
// Readiness + modalidade + venda), com os atos do Admin na própria linha.
// ORGANIZAÇÃO (decreto 2026-07-22): a lista é SEGMENTADA por fase para controle —
//   • HISCON recebido (Fase 1 completa) → prontos para estudo/perícia;
//   • Aguardando HISCON (só contato ou outros docs) → com botão "Cobrar HISCON".
// O detalhe do cliente (/clientes/[chatId]) permanece inalterado.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import JornadaAcoes, { type AdvogadoOption } from '../../../components/jornada-acoes';
import CobrarHiscon from '../../../components/cobrar-hiscon';
import DisparoEmLote from '../../../components/disparo-em-lote';
import { getJson, type ClienteStatus, type JornadaCliente, type StaffData } from '../../../lib/api';
import { formatDate } from '../../../lib/format';

const STATUS_LABEL: Record<ClienteStatus, { label: string; badge: 'ok' | 'warn' | '' }> = {
  ATENDIMENTO: { label: 'em atendimento', badge: '' },
  COLETANDO_DOCUMENTOS: { label: 'coletando documentos', badge: 'warn' },
  PRONTO_AGUARDANDO_MODALIDADE: { label: 'pronto — decidir modalidade', badge: 'warn' },
  PRONTO_AGUARDANDO_VENDA: { label: 'pronto — aguardando venda', badge: 'ok' },
  PRONTO_AGUARDANDO_PERICIA: { label: 'pronto — fila da perícia', badge: 'ok' },
  AGUARDANDO_10_DIAS: { label: 'pedidos enviados — prazo de 10 dias', badge: 'warn' },
  AGUARDANDO_SOCIO: { label: 'prazo vencido — escolher sócio', badge: 'warn' },
  EM_PROCESSO: { label: 'em processo', badge: 'ok' },
  VENDIDO: { label: 'vendido', badge: 'ok' },
  ENCERRADO: { label: 'encerrado', badge: '' },
};

const SAUDE_ICON: Record<'GREEN' | 'YELLOW' | 'RED', string> = {
  GREEN: '🟢',
  YELLOW: '🟡',
  RED: '🔴',
};

/** Tabela de um segmento. `aguardandoHiscon` troca a coluna de ação: os que ainda
 *  não mandaram o HISCON ganham o botão "Cobrar HISCON"; os prontos, os atos da
 *  jornada (modalidade/venda/sócio). */
function TabelaClientes({
  clientes,
  advogados,
  aguardandoHiscon,
}: {
  clientes: readonly JornadaCliente[];
  advogados: readonly AdvogadoOption[];
  aguardandoHiscon: boolean;
}): ReactElement {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>WhatsApp</th>
            <th>Status</th>
            <th>Falta</th>
            <th>Saúde</th>
            <th>Último contato</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => {
            const st = STATUS_LABEL[c.status];
            return (
              <tr key={c.chatId}>
                <td>
                  <Link
                    href={`/clientes/${encodeURIComponent(c.chatId)}`}
                    style={{ color: 'var(--accent)', fontWeight: 600 }}
                  >
                    {c.quem}
                  </Link>
                </td>
                <td className="mono">{c.chatId}</td>
                <td>
                  {st.badge === '' ? (
                    st.label
                  ) : (
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                  )}
                </td>
                <td>
                  {c.faltando.length === 0 ? (
                    <span className="badge ok">nada</span>
                  ) : (
                    c.faltando.join(', ')
                  )}
                </td>
                <td>{c.saude === null ? '—' : SAUDE_ICON[c.saude]}</td>
                <td>{formatDate(c.ultimoContatoAt)}</td>
                <td>
                  {aguardandoHiscon ? (
                    <CobrarHiscon chatId={c.chatId} />
                  ) : (
                    <JornadaAcoes
                      clienteId={c.clienteId}
                      missionId={c.missionId}
                      status={c.status}
                      advogados={advogados}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ClientsPage = async ({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<ReactElement> => {
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const data = await getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes');
  // B-R4: advogados para o ato "escolher sócio" (staff existente; só os ativos).
  const staff = await getJson<StaffData>('/admin/staff/advogado');
  const advogados = (staff?.members ?? [])
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, name: m.name }));

  const todos =
    data === null
      ? null
      : q === ''
        ? data.clientes
        : data.clientes.filter(
            (c) =>
              c.quem.toLowerCase().includes(q) ||
              c.chatId.toLowerCase().includes(q) ||
              STATUS_LABEL[c.status].label.includes(q),
          );

  // Fase 1: HISCON recebido (pronto) = pronto para estudo/perícia. Os demais ainda
  // não mandaram o HISCON (só contato ou outros documentos) — precisam de cobrança.
  const comHiscon = todos?.filter((c) => c.pronto) ?? [];
  const aguardando = todos?.filter((c) => !c.pronto) ?? [];

  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Clientes</h1>
      <p className="page-sub">
        A jornada de cada cliente, separada por fase. Status derivado em tempo real.
      </p>

      {/* Sem `action` absoluto: submete à própria URL (funciona sob o basePath /admin). */}
      <form className="form-row" method="get">
        <input
          type="text"
          name="q"
          placeholder="Pesquisar por nome, WhatsApp ou status…"
          defaultValue={searchParams.q ?? ''}
        />
        <button type="submit" className="primary">
          Pesquisar
        </button>
      </form>

      {!todos ? (
        <div className="error-box">API indisponível.</div>
      ) : todos.length === 0 ? (
        <div className="card empty">Nenhum cliente encontrado.</div>
      ) : (
        <>
          {/* Totais por fase — visão rápida de quantos estão prontos para estudo. */}
          <div className="grid stats" style={{ marginTop: 8, marginBottom: 8 }}>
            <div className="card stat">
              <div className="value">{comHiscon.length}</div>
              <div className="label">Fase 1 — HISCON recebido (prontos p/ estudo)</div>
            </div>
            <div className="card stat">
              <div className="value">{aguardando.length}</div>
              <div className="label">Aguardando HISCON (em cobrança)</div>
            </div>
          </div>

          <h2 className="page-title" style={{ fontSize: '1.15rem', marginTop: 24 }}>
            ✅ HISCON recebido — Fase 1 completa{' '}
            <span className="badge ok">{comHiscon.length}</span>
          </h2>
          <p className="page-sub">Prontos para estudo/perícia. Documentação inicial completa.</p>
          {comHiscon.length === 0 ? (
            <div className="card empty">Ninguém com HISCON recebido ainda.</div>
          ) : (
            <TabelaClientes clientes={comHiscon} advogados={advogados} aguardandoHiscon={false} />
          )}

          <h2 className="page-title" style={{ fontSize: '1.15rem', marginTop: 32 }}>
            ⏳ Aguardando HISCON <span className="badge warn">{aguardando.length}</span>
          </h2>
          <p className="page-sub">
            Entraram em contato mas ainda não enviaram o HISCON. Use “Cobrar HISCON” para a AHRI
            pedir o documento e concluir o cadastro.
          </p>
          <DisparoEmLote chatIds={aguardando.map((c) => c.chatId)} />
          {aguardando.length === 0 ? (
            <div className="card empty">Ninguém pendente — todos enviaram o HISCON.</div>
          ) : (
            <TabelaClientes clientes={aguardando} advogados={advogados} aguardandoHiscon />
          )}
        </>
      )}
    </>
  );
};

export default ClientsPage;
