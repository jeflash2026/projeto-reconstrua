// CLIENTES — a LISTA ÚNICA da Jornada A (R4): status DERIVADO em leitura (ALIR +
// Readiness + modalidade + venda), com os atos do Admin (definir modalidade, vender)
// na própria linha. Substitui a antiga listagem por memória (Regra 2 — sem LEGACY).
// O detalhe do cliente (/clientes/[chatId]) permanece inalterado.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import JornadaAcoes from '../../components/jornada-acoes';
import { getJson, type ClienteStatus, type JornadaCliente, type StaffData } from '../../lib/api';
import { formatDate } from '../../lib/format';

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

const SAUDE_ICON: Record<'GREEN' | 'YELLOW' | 'RED', string> = { GREEN: '🟢', YELLOW: '🟡', RED: '🔴' };

const ClientsPage = async ({ searchParams }: { searchParams: { q?: string } }): Promise<ReactElement> => {
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const data = await getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes');
  // B-R4: advogados para o ato "escolher sócio" (staff existente; só os ativos).
  const staff = await getJson<StaffData>('/admin/staff/advogado');
  const advogados = (staff?.members ?? []).filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const clientes =
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

  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Clientes</h1>
      <p className="page-sub">A jornada de cada cliente — do primeiro contato à venda. Status derivado em tempo real.</p>

      <form className="form-row" action="/clientes" method="get">
        <input type="text" name="q" placeholder="Pesquisar por nome, WhatsApp ou status…" defaultValue={searchParams.q ?? ''} />
        <button type="submit" className="primary">
          Pesquisar
        </button>
      </form>

      {!clientes ? (
        <div className="error-box">API indisponível.</div>
      ) : clientes.length === 0 ? (
        <div className="card empty">Nenhum cliente encontrado.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Status</th>
                <th>Modalidade</th>
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
                      <Link href={`/clientes/${encodeURIComponent(c.chatId)}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {c.quem}
                      </Link>
                    </td>
                    <td className="mono">{c.chatId}</td>
                    <td>{st.badge === '' ? st.label : <span className={`badge ${st.badge}`}>{st.label}</span>}</td>
                    <td>{c.modalidade ?? '—'}</td>
                    <td>{c.faltando.length === 0 ? <span className="badge ok">nada</span> : c.faltando.join(', ')}</td>
                    <td>{c.saude === null ? '—' : SAUDE_ICON[c.saude]}</td>
                    <td>{formatDate(c.ultimoContatoAt)}</td>
                    <td>
                      <JornadaAcoes clienteId={c.clienteId} missionId={c.missionId} status={c.status} advogados={advogados} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default ClientsPage;
