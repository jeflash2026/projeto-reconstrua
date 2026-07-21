// PERÍCIAS — a OPERAÇÃO do Perito na Jornada B (B-R6): fila derivada (prontos em
// SOCIEDADE), planilha de contratos por cliente/lote e a confirmação dos pedidos
// administrativos. A antiga tabela "Perícias enquadradas" (entidade sem produtor —
// empty-state perpétuo) foi REMOVIDA (Regra 2). Mantidos: fila de handoff (real)
// e a gestão de Peritos.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import StaffPanel from '../../../components/staff-panel';
import { BaixarLote, PericiaAcoes } from '../../../components/pericia-acoes';
import { getJson, type JornadaCliente } from '../../../lib/api';
import { formatDate } from '../../../lib/format';

const DEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;
// Decreto 2026-07-21: a MESMA contagem regressiva que o perito vê na central dele.
function contagemRegressiva(pedidosConfirmadosEm: string | null): string {
  if (pedidosConfirmadosEm === null) return '—';
  const resta = new Date(pedidosConfirmadosEm).getTime() + DEZ_DIAS_MS - Date.now();
  if (resta <= 0) return 'prazo atingido';
  const dias = Math.floor(resta / (24 * 60 * 60 * 1000));
  const horas = Math.floor((resta % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${String(dias)}d ${String(horas)}h restantes`;
}

const PericiasPage = async (): Promise<ReactElement> => {
  const fila = await getJson<{ clientes: JornadaCliente[] }>(
    '/admin/jornada/clientes?fila=pericia',
  );
  const handoff = await getJson<{ queue: number }>('/admin/pericias');
  const clientes = fila?.clientes ?? null;
  const todosClientes =
    (await getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes'))?.clientes ?? [];
  const emPrazo = todosClientes.filter((c) => c.status === 'AGUARDANDO_10_DIAS');

  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Perícias</h1>
      <p className="page-sub">
        A fila de trabalho do perito: organizar o HISCON, exportar contratos e confirmar os pedidos
        administrativos.
      </p>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="value">{clientes?.length ?? '—'}</div>
          <div className="label">Clientes na fila da perícia</div>
        </div>
        <div className="card stat">
          <div className="value">{handoff?.queue ?? '—'}</div>
          <div className="label">Escalonamentos aguardando perito</div>
        </div>
      </div>

      {!clientes ? (
        <div className="error-box">API indisponível.</div>
      ) : clientes.length === 0 ? (
        <div className="card empty">Nenhum cliente na fila da perícia.</div>
      ) : (
        <>
          <div className="form-row">
            <BaixarLote />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th>Último contato</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
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
                    <td>{formatDate(c.ultimoContatoAt)}</td>
                    <td>
                      <PericiaAcoes clienteId={c.clienteId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Decreto 2026-07-21: o Admin acompanha o MESMO prazo que o perito vê. */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Aguardando o prazo dos pedidos ({emPrazo.length})</h3>
        {emPrazo.length === 0 ? (
          <div className="empty">Nenhum cliente com prazo correndo.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pedidos confirmados em</th>
                  <th>Contagem regressiva</th>
                </tr>
              </thead>
              <tbody>
                {emPrazo.map((c) => (
                  <tr key={c.chatId}>
                    <td>
                      <Link
                        href={`/clientes/${encodeURIComponent(c.chatId)}`}
                        style={{ color: 'var(--accent)' }}
                      >
                        {c.quem}
                      </Link>
                    </td>
                    <td className="mono">{formatDate(c.pedidosConfirmadosEm)}</td>
                    <td>
                      <span className="badge accent">
                        {contagemRegressiva(c.pedidosConfirmadosEm)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <StaffPanel role="perito" title="Peritos" />
      </div>
    </>
  );
};

export default PericiasPage;
