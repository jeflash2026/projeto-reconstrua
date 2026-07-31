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
import CobrarCpf from '../../../components/cobrar-cpf';
import DisparoEmLote from '../../../components/disparo-em-lote';
import DisparoCpfEmLote from '../../../components/disparo-cpf-em-lote';
import { getJson, type JornadaCliente, type StaffData } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { SAUDE_ICON, STATUS_LABEL } from '../../../lib/status-cliente';

/** Tabela de um segmento. `acao` troca a coluna de ação: quem não mandou o
 *  HISCON ganha "Cobrar HISCON"; quem mandou mas falta o CPF, "Cobrar CPF";
 *  fase 1 completa ganha os atos da jornada (modalidade/venda/sócio). */
function TabelaClientes({
  clientes,
  advogados,
  acao,
}: {
  clientes: readonly JornadaCliente[];
  advogados: readonly AdvogadoOption[];
  acao: 'jornada' | 'cobrar-hiscon' | 'cobrar-cpf';
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
                  {acao === 'cobrar-hiscon' ? (
                    <CobrarHiscon chatId={c.chatId} />
                  ) : acao === 'cobrar-cpf' ? (
                    <CobrarCpf chatId={c.chatId} />
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

  // Decreto 2026-07-27 — a FASE 1 completa exige CPF + HISCON. Segmentos:
  //   • fase1: CPF + HISCON entregues ⇒ é quem alimenta a fila da perícia;
  //   • faltaCpf: HISCON ok, CPF pendente ⇒ cobrar CPF (unitário ou lote);
  //   • aguardando: sem HISCON ⇒ cobrar HISCON (unitário ou lote).
  const fase1 = todos?.filter((c) => c.pronto && c.cpfRegistrado === true) ?? [];
  const faltaCpf = todos?.filter((c) => c.pronto && c.cpfRegistrado !== true) ?? [];
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
          {/* Totais por fase — a régua da FASE 1 é CPF + HISCON (decreto 2026-07-27). */}
          <div className="grid stats" style={{ marginTop: 8, marginBottom: 8 }}>
            <div className="card stat">
              <div className="value">{fase1.length}</div>
              <div className="label">Fase 1 completa — CPF + HISCON entregues</div>
            </div>
            <div className="card stat">
              <div className="value">{faltaCpf.length}</div>
              <div className="label">Com HISCON, faltando CPF (em cobrança)</div>
            </div>
            <div className="card stat">
              <div className="value">{aguardando.length}</div>
              <div className="label">Aguardando HISCON (em cobrança)</div>
            </div>
          </div>

          <h2 className="page-title" style={{ fontSize: '1.15rem', marginTop: 24 }}>
            ✅ Fase 1 completa — CPF + HISCON <span className="badge ok">{fase1.length}</span>
          </h2>
          <p className="page-sub">
            Documentação inicial completa — são estes que alimentam a fila da perícia.
          </p>
          {fase1.length === 0 ? (
            <div className="card empty">Ninguém com CPF + HISCON ainda.</div>
          ) : (
            <TabelaClientes clientes={fase1} advogados={advogados} acao="jornada" />
          )}

          <h2 className="page-title" style={{ fontSize: '1.15rem', marginTop: 32 }}>
            🪪 Com HISCON, faltando CPF <span className="badge warn">{faltaCpf.length}</span>
          </h2>
          <p className="page-sub">
            Já enviaram o HISCON, mas sem o CPF a perícia não protocola o pedido nos bancos. Use
            “Cobrar CPF” (unitário ou em lote) — a AHRI envia a mensagem canônica.
          </p>
          <DisparoCpfEmLote chatIds={faltaCpf.map((c) => c.chatId)} />
          {faltaCpf.length === 0 ? (
            <div className="card empty">Ninguém pendente de CPF.</div>
          ) : (
            <TabelaClientes clientes={faltaCpf} advogados={advogados} acao="cobrar-cpf" />
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
            <TabelaClientes clientes={aguardando} advogados={advogados} acao="cobrar-hiscon" />
          )}
        </>
      )}
    </>
  );
};

export default ClientsPage;
