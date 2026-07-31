// CLIENTES HOJE (decreto 2026-07-31) — quem a AHRI atendeu SÓ no dia de hoje
// (fuso de Brasília), sem misturar com a base histórica. Derivado em leitura do
// MESMO read model da lista Clientes (ultimoContatoAt): nada novo é gravado.
// Ordenado do contato mais recente para o mais antigo; o nome abre o cadastro
// completo (com a conversa em bolhas).
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type JornadaCliente } from '../../../../lib/api';
import { SAUDE_ICON, STATUS_LABEL } from '../../../../lib/status-cliente';

const TZ_BRASILIA = 'America/Sao_Paulo';

/** O instante cai no dia de HOJE no fuso de Brasília? (DST-proof via Intl) */
function ehHojeBrt(iso: string | null, agora: Date): boolean {
  if (iso === null) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d) === fmt.format(agora);
}

function horaBrt(iso: string | null): string {
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
    timeZone: TZ_BRASILIA,
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ClientesHojePage = async (): Promise<ReactElement> => {
  const agora = new Date();
  const data = await getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes');
  const hoje =
    data?.clientes
      .filter((c) => ehHojeBrt(c.ultimoContatoAt, agora))
      .sort((a, b) => (b.ultimoContatoAt ?? '').localeCompare(a.ultimoContatoAt ?? '')) ?? null;
  const fase1 = hoje?.filter((c) => c.pronto && c.cpfRegistrado === true).length ?? 0;
  const dataLegivel = agora.toLocaleDateString('pt-BR', {
    timeZone: TZ_BRASILIA,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Clientes Hoje</h1>
      <p className="page-sub">
        Quem a AHRI atendeu hoje ({dataLegivel}) — sem misturar com a base histórica. O contato mais
        recente aparece primeiro; clique no nome para abrir o cadastro com a conversa completa.
      </p>

      {hoje === null ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <>
          <div className="grid stats" style={{ marginTop: 8, marginBottom: 8 }}>
            <div className="card stat">
              <div className="value">{hoje.length}</div>
              <div className="label">Clientes atendidos hoje</div>
            </div>
            <div className="card stat">
              <div className="value">{fase1}</div>
              <div className="label">Destes, com fase 1 completa (CPF + HISCON)</div>
            </div>
          </div>

          {hoje.length === 0 ? (
            <div className="card empty">Nenhum atendimento hoje ainda.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Último contato</th>
                    <th>Cliente</th>
                    <th>WhatsApp</th>
                    <th>Status</th>
                    <th>Falta</th>
                    <th>Saúde</th>
                  </tr>
                </thead>
                <tbody>
                  {hoje.map((c) => {
                    const st = STATUS_LABEL[c.status];
                    return (
                      <tr key={c.chatId}>
                        <td className="mono">{horaBrt(c.ultimoContatoAt)}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default ClientesHojePage;
