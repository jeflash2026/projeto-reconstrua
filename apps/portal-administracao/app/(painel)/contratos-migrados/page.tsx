// CONTRATOS MIGRADOS (Decreto Dossiê Pericial 2026-07-21; reorganizado 2026-07-23)
// — contratos cuja ORIGEM DA AVERBAÇÃO é "Migrado" NÃO precisam de pedido
// administrativo: ficam prontos para a DESTINAÇÃO DIRETA (venda ou sócio), decisão
// SEMPRE manual do admin. Painéis no topo: quantos clientes, quantos contratos e o
// potencial de recuperação SÓ dos migrados.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import JornadaAcoes, { type AdvogadoOption } from '../../../components/jornada-acoes';
import {
  getJson,
  type JornadaCliente,
  type MigradosDoClienteView,
  type StaffData,
} from '../../../lib/api';
import { formatMoney } from '../../../lib/format';

const MigradosPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ clientes: MigradosDoClienteView[] }>('/admin/pericia-migrados');
  // Junta com a lista única (clienteId/missionId/status) + advogados ativos para
  // oferecer a destinação direta (venda/sócio) na própria linha do cliente.
  const jornada = await getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes');
  const staff = await getJson<StaffData>('/admin/staff/advogado');
  const advogados: AdvogadoOption[] = (staff?.members ?? [])
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, name: m.name }));
  const porChat = new Map((jornada?.clientes ?? []).map((c) => [c.chatId, c]));

  const clientes = data?.clientes ?? [];
  const totalContratos = clientes.reduce((s, c) => s + c.totalMigrados, 0);
  const totalPotencial = clientes.reduce((s, c) => s + c.potencialMigrados, 0);

  return (
    <>
      <AutoRefresh seconds={30} />
      <h1 className="page-title">Contratos Migrados</h1>
      <p className="page-sub">
        Sem pedido administrativo — prontos para destinar diretamente a <strong>venda</strong> ou a
        um <strong>advogado sócio</strong> (a decisão é sempre sua).
      </p>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="value">{clientes.length}</div>
          <div className="label">Clientes com contrato migrado</div>
        </div>
        <div className="card stat">
          <div className="value">{totalContratos}</div>
          <div className="label">Total de contratos migrados</div>
        </div>
        <div className="card stat">
          <div className="value">{formatMoney(totalPotencial)}</div>
          <div className="label">Potencial de recuperação (migrados)</div>
        </div>
      </div>

      {clientes.length === 0 ? (
        <div className="card empty">Nenhum contrato migrado encontrado nos HISCONs recebidos.</div>
      ) : (
        clientes.map((cliente) => {
          const j = porChat.get(cliente.chatId);
          return (
            <div className="card" key={cliente.chatId} style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 4 }}>
                <Link
                  href={`/clientes/${encodeURIComponent(cliente.chatId)}`}
                  style={{ color: 'var(--accent)' }}
                >
                  {cliente.nomeCliente ?? cliente.chatId}
                </Link>{' '}
                — {cliente.totalMigrados} contrato(s) migrado(s) · potencial{' '}
                <strong>{formatMoney(cliente.potencialMigrados)}</strong>
              </h3>

              {/* Destinação DIRETA (sem pedido administrativo): venda ou sócio. */}
              {j ? (
                <div
                  style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0 12px' }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Destinar direto:</span>
                  <JornadaAcoes
                    clienteId={j.clienteId}
                    missionId={j.missionId}
                    status={j.status}
                    advogados={advogados}
                  />
                </div>
              ) : null}

              {/* O MAPA: DE contrato/banco de origem → PARA contrato/banco atual. */}
              <ul style={{ marginTop: 0 }}>
                {cliente.migracoes.map((m) => (
                  <li key={m.paraContrato}>
                    Migrou de{' '}
                    <span className="mono">{m.deContrato ?? '(origem não informada)'}</span>
                    {m.deBancoCodigo ? (
                      <span>
                        {' '}
                        @ {m.deBancoNome ?? 'banco'}{' '}
                        <span className="mono">({m.deBancoCodigo})</span>
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
                          <th>Início</th>
                          <th>Fim</th>
                          <th>Parcela</th>
                          <th>Emprestado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {banco.contratos.map((c) => (
                          <tr key={c.contrato}>
                            <td className="mono">{c.contrato}</td>
                            <td>{c.situacao ?? '—'}</td>
                            <td className="mono">{c.competenciaInicio ?? '—'}</td>
                            <td className="mono">{c.competenciaFim ?? '—'}</td>
                            <td>{formatMoney(c.valorParcela)}</td>
                            <td>{formatMoney(c.valorEmprestado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </>
  );
};

export default MigradosPage;
