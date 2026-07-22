// Tabela compartilhada de registros jurídicos (server component).
import Link from 'next/link';
import type { ReactElement } from 'react';
import type { JuridicalEntry } from '../lib/api';
import { formatDate, kindLabel, shortId } from '../lib/format';

const EntriesTable = ({
  entries,
  emptyText,
}: {
  entries: JuridicalEntry[] | null;
  emptyText: string;
}): ReactElement => {
  if (!entries)
    return (
      <div className="error-box">API indisponível ou identificação ausente (defina no Perfil).</div>
    );
  if (entries.length === 0) return <div className="card empty">{emptyText}</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Quando</th>
            <th>Tipo</th>
            <th>Conteúdo</th>
            <th>Processo</th>
            <th>Vencimento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="mono">{formatDate(e.createdAt)}</td>
              <td>
                <span className="badge accent">{kindLabel(e.kind)}</span>
              </td>
              <td style={{ whiteSpace: 'normal', maxWidth: 420 }}>{e.text}</td>
              <td>
                <Link
                  href={`/processos/${e.missionId}`}
                  className="mono"
                  style={{ color: 'var(--accent)' }}
                >
                  {shortId(e.missionId)}
                </Link>
              </td>
              <td className="mono">{formatDate(e.dueAt)}</td>
              <td>
                {e.done ? (
                  <span className="badge ok">concluída</span>
                ) : (
                  <span className="badge warn">aberta</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EntriesTable;
