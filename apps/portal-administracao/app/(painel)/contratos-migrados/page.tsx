// CONTRATOS MIGRADOS (Decreto Dossiê Pericial 2026-07-21) — por cliente e por
// banco: contratos cuja ORIGEM DA AVERBAÇÃO é "Migrado" NÃO precisam de pedido
// administrativo e ficam prontos para a destinação DIRETA a advogado — decisão
// SEMPRE manual do admin (nada aqui automatiza a atribuição).
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson, type MigradosDoClienteView } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/format';

const MigradosPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ clientes: MigradosDoClienteView[] }>('/admin/pericia-migrados');
  const clientes = data?.clientes ?? [];
  return (
    <>
      <AutoRefresh seconds={30} />
      <h1 className="page-title">Contratos Migrados</h1>
      <p className="page-sub">
        Sem pedido administrativo — prontos para você destinar diretamente a um advogado (a decisão
        é sempre sua; a atribuição continua em «Prontos p/ Advogado»).
      </p>
      {clientes.length === 0 ? (
        <div className="empty">Nenhum contrato migrado encontrado nos HISCONs recebidos.</div>
      ) : (
        clientes.map((cliente) => (
          <div className="card" key={cliente.chatId} style={{ marginBottom: 16 }}>
            <h3>
              <Link
                href={`/clientes/${encodeURIComponent(cliente.chatId)}`}
                style={{ color: 'var(--accent)' }}
              >
                {cliente.nomeCliente ?? cliente.chatId}
              </Link>{' '}
              — {cliente.totalMigrados} contrato(s) migrado(s)
            </h3>
            {/* O MAPA: DE contrato/banco de origem → PARA contrato/banco atual. */}
            <ul style={{ marginTop: 0 }}>
              {cliente.migracoes.map((m) => (
                <li key={m.paraContrato}>
                  Migrou de <span className="mono">{m.deContrato ?? '(origem não informada)'}</span>
                  {m.deBancoCodigo ? (
                    <span>
                      {' '}
                      @ {m.deBancoNome ?? 'banco'} <span className="mono">({m.deBancoCodigo})</span>
                    </span>
                  ) : null}{' '}
                  para <span className="mono">{m.paraContrato}</span> @{' '}
                  {m.paraBancoNome ?? 'banco atual'}{' '}
                  {m.paraBancoCodigo ? <span className="mono">({m.paraBancoCodigo})</span> : null}
                </li>
              ))}
            </ul>
            {cliente.porBanco.map((banco) => (
              <div key={banco.bancoNome} style={{ marginTop: 8 }}>
                <h4 style={{ marginBottom: 4 }}>
                  {banco.bancoNome}{' '}
                  {banco.bancoCodigo ? <span className="mono">({banco.bancoCodigo})</span> : null}
                </h4>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Contrato</th>
                        <th>Situação</th>
                        <th>Inclusão</th>
                        <th>Parcela</th>
                        <th>Emprestado</th>
                        <th>Origem da averbação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {banco.contratos.map((c) => (
                        <tr key={c.contrato}>
                          <td className="mono">{c.contrato}</td>
                          <td>{c.situacao ?? '—'}</td>
                          <td className="mono">{formatDate(c.dataInclusao)}</td>
                          <td>{formatMoney(c.valorParcela)}</td>
                          <td>{formatMoney(c.valorEmprestado)}</td>
                          <td style={{ whiteSpace: 'normal', fontSize: 12 }}>
                            {c.origemAverbacao ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </>
  );
};

export default MigradosPage;
