// CENTRAL DO PERITO (Decreto 2026-07-21) — APENAS a função pericial:
// 1) FILA: clientes prontos aguardando perícia → baixar planilha (contratos por
//    banco, últimos 5 anos) e CONFIRMAR os pedidos administrativos;
// 2) PRAZO: contagem regressiva dos 10 dias por cliente (a mesma que o Admin
//    acompanha); vencido o prazo, o cliente vira "pronto p/ advogado" — a
//    destinação ao advogado sócio é decisão EXCLUSIVA do Admin.
import type { ReactElement } from 'react';
import { getJson, type ClienteDaFila } from '../lib/api';
import { logoutPerito } from '../lib/actions';
import AcoesCliente from '../components/acoes-cliente';

export const dynamic = 'force-dynamic';

const DEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;

function contagem(pedidosConfirmadosEm: string | null): string {
  if (pedidosConfirmadosEm === null) return '—';
  const fim = new Date(pedidosConfirmadosEm).getTime() + DEZ_DIAS_MS;
  const resta = fim - Date.now();
  if (resta <= 0) return 'prazo atingido';
  const dias = Math.floor(resta / (24 * 60 * 60 * 1000));
  const horas = Math.floor((resta % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${String(dias)}d ${String(horas)}h restantes`;
}

function dataBr(iso: string | null): string {
  if (iso === null) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const CentralPerito = async (): Promise<ReactElement> => {
  const todos =
    (await getJson<{ clientes: ClienteDaFila[] }>('/admin/jornada/clientes'))?.clientes ?? [];
  const fila = todos.filter((c) => c.status === 'PRONTO_AGUARDANDO_PERICIA');
  const emPrazo = todos.filter((c) => c.status === 'AGUARDANDO_10_DIAS');
  const prazoVencido = todos.filter((c) => c.status === 'AGUARDANDO_SOCIO');

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Central do Perito</h1>
        <form action={logoutPerito}>
          <button type="submit" className="btn">
            Sair
          </button>
        </form>
      </div>
      <p className="page-sub">
        Baixe a planilha de contratos, faça os pedidos administrativos e confirme — a confirmação
        inicia a contagem dos 10 dias.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Fila da perícia ({fila.length})</h3>
        {fila.length === 0 ? (
          <div className="empty">Nenhum cliente aguardando perícia.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Último contato</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {fila.map((c) => (
                  <tr key={c.clienteId}>
                    <td>{c.quem}</td>
                    <td className="mono">{dataBr(c.ultimoContatoAt)}</td>
                    <td>
                      <AcoesCliente clienteId={c.clienteId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
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
                  <tr key={c.clienteId}>
                    <td>{c.quem}</td>
                    <td className="mono">{dataBr(c.pedidosConfirmadosEm)}</td>
                    <td>
                      <span className="badge accent">{contagem(c.pedidosConfirmadosEm)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Prazo atingido — prontos para o advogado ({prazoVencido.length})</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          A destinação ao advogado sócio é feita pelo Admin.
        </p>
        {prazoVencido.length === 0 ? (
          <div className="empty">Nenhum cliente com prazo concluído.</div>
        ) : (
          <ul>
            {prazoVencido.map((c) => (
              <li key={c.clienteId}>
                {c.quem} — pedidos confirmados em {dataBr(c.pedidosConfirmadosEm)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

export default CentralPerito;
