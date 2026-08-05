// MEUS CLIENTES (decreto 2026-07-29) — os clientes que o Administrador destinou
// a este advogado, POR NOME. Clicar no nome abre todos os documentos recebidos
// pelo WhatsApp, prontos para download (isolamento por atribuição no servidor).
import Link from 'next/link';
import type { CSSProperties, ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson, type MeuCliente, type PericiaDoCliente } from '../../../lib/api';
import { formatDate } from '../../../lib/format';

/** PEDIDO ADMINISTRATIVO (pedido do dono, 2026-08-05) — o status na frente do
 *  nome, atualizado pela CONDIÇÃO:
 *   • perito ainda não baixou o pacote → aguardando perícia;
 *   • baixou → contagem regressiva dos 10 dias (verde/âmbar/vermelho);
 *   • banco respondeu OU prazo venceu → concluído (luz verde p/ ajuizar). */
const SeloPedido = ({ p }: { p: PericiaDoCliente | null | undefined }): ReactElement => {
  const base: CSSProperties = {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
  if (p == null)
    return (
      <span style={{ ...base, background: 'rgba(150,160,170,.15)', color: 'var(--text-dim)' }}>
        aguardando perícia
      </span>
    );
  if (p.respostaBanco != null)
    return (
      <span
        style={{ ...base, background: 'rgba(60,170,90,.18)', color: '#3fae5f' }}
        title={`Resposta em ${formatDate(p.respostaBanco.registradaEm)}: ${p.respostaBanco.texto}`}
      >
        ✅ banco respondeu — pronto p/ ajuizar
      </span>
    );
  if (p.expirado)
    return (
      <span
        style={{ ...base, background: 'rgba(60,170,90,.18)', color: '#3fae5f' }}
        title={`Pedido feito em ${formatDate(p.iniciadaEm)} — 10 dias vencidos sem resposta`}
      >
        🟢 prazo vencido — pronto p/ ajuizar
      </span>
    );
  const dias = Math.floor(p.horasRestantes / 24);
  const horas = p.horasRestantes % 24;
  const cor =
    dias > 5
      ? { background: 'rgba(60,170,90,.18)', color: '#3fae5f' }
      : dias >= 2
        ? { background: 'rgba(217,154,0,.18)', color: '#d99a00' }
        : { background: 'rgba(200,60,60,.18)', color: '#d05050' };
  return (
    <span
      style={{ ...base, ...cor }}
      title={`Pedido feito em ${formatDate(p.iniciadaEm)} — prazo até ${formatDate(p.prazoEm)}`}
    >
      ⏳ {dias}d {horas}h restantes
    </span>
  );
};

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
                <th>Pedido administrativo</th>
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
                  <td>
                    <SeloPedido p={c.pericia} />
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
