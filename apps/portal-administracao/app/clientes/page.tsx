// CLIENTES — pesquisa e lista, alimentadas pelo read model de memória viva.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import { getJson, type ClientRow } from '../../lib/api';
import { formatDate } from '../../lib/format';

const ClientsPage = async ({ searchParams }: { searchParams: { q?: string } }): Promise<ReactElement> => {
  const q = searchParams.q ?? '';
  const clients = await getJson<ClientRow[]>(`/admin/clients?q=${encodeURIComponent(q)}`);
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Clientes</h1>
      <p className="page-sub">Pesquise por nome, telefone ou qualquer atributo lembrado.</p>

      <form className="form-row" action="/clientes" method="get">
        <input type="text" name="q" placeholder="Pesquisar clientes…" defaultValue={q} />
        <button type="submit" className="primary">
          Pesquisar
        </button>
      </form>

      {!clients ? (
        <div className="error-box">API indisponível.</div>
      ) : clients.length === 0 ? (
        <div className="card empty">Nenhum cliente encontrado.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Primeiro contato</th>
                <th>Último contato</th>
                <th>Mensagens</th>
                <th>Docs pendentes</th>
                <th>Missões</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.chatId}>
                  <td>
                    <Link href={`/clientes/${encodeURIComponent(c.chatId)}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {c.name ?? 'sem nome registrado'}
                    </Link>
                  </td>
                  <td className="mono">{c.chatId}</td>
                  <td>{formatDate(c.firstContactAt)}</td>
                  <td>{formatDate(c.lastContactAt)}</td>
                  <td>{c.messageCount}</td>
                  <td>{c.pendingDocuments.length === 0 ? <span className="badge ok">nenhum</span> : <span className="badge warn">{c.pendingDocuments.length}</span>}</td>
                  <td>{c.missions.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default ClientsPage;
