// MEUS CLIENTES (decreto 2026-07-29) — os clientes que o Administrador destinou
// a este advogado, POR NOME. Clicar no nome abre todos os documentos recebidos
// pelo WhatsApp, prontos para download (isolamento por atribuição no servidor).
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson, type MeuCliente } from '../../../lib/api';
import { formatDate } from '../../../lib/format';

const MeusClientesPage = async ({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<ReactElement> => {
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const data = await getJson<{ clientes: MeuCliente[] }>('/advogado/meus-clientes');
  const clientes =
    data === null
      ? null
      : q === ''
        ? data.clientes
        : data.clientes.filter(
            (c) => c.nome.toLowerCase().includes(q) || (c.chatId ?? '').includes(q),
          );

  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Meus Clientes</h1>
      <p className="page-sub">
        Os clientes destinados a você pelo escritório. Clique no nome para ver e baixar todos os
        documentos que o cliente enviou pelo WhatsApp.
      </p>

      {/* Sem `action` absoluto: submete à própria URL (funciona sob o basePath). */}
      <form className="form-row" method="get">
        <input
          type="text"
          name="q"
          placeholder="Buscar cliente por nome…"
          defaultValue={searchParams.q ?? ''}
        />
        <button type="submit" className="primary">
          Buscar
        </button>
      </form>

      {!clientes ? (
        <div className="error-box">API indisponível ou identificação inválida/inativa.</div>
      ) : clientes.length === 0 ? (
        <div className="card empty">
          {q === ''
            ? 'Nenhum cliente destinado a você ainda — quando o escritório atribuir, ele aparece aqui.'
            : 'Nenhum cliente encontrado com esse nome.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Documentos</th>
                <th>Destinado em</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.missionId}>
                  <td>
                    <Link
                      href={`/meus-clientes/${encodeURIComponent(c.missionId)}?nome=${encodeURIComponent(c.nome)}`}
                      style={{ color: 'var(--accent)', fontWeight: 600 }}
                    >
                      {c.nome}
                    </Link>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {c.chatId ?? '—'}
                  </td>
                  <td>{c.documentos}</td>
                  <td>{formatDate(c.atribuidoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default MeusClientesPage;
