// DASHBOARD — espelho do original: cards, contratos recentes, ranking por
// banco e o histórico auditado ("Contrato cadastrado. · Fulano · Juliano").
import type { ReactElement } from 'react';
import { getJson, dataBr, type DashboardJuridico } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<ReactElement> {
  const dados = await getJson<DashboardJuridico>('/admin/juridico/dashboard');

  return (
    <>
      <h1 className="titulo">Dashboard administrativo</h1>
      <p className="subtitulo">
        Visão geral de clientes, processos, contratos e movimentações recentes.
      </p>
      <div className="acoes-topo">
        <a className="btn primario" href="/juridico/clientes/novo">
          Novo cliente
        </a>
        <a className="btn" href="/juridico/processos/novo">
          Novo processo
        </a>
        <a className="btn" href="/juridico/guias">
          Nova guia
        </a>
        <a className="btn" href="/juridico/pericias">
          Nova perícia
        </a>
      </div>

      {dados === null ? (
        <div className="erro-box">API indisponível — recarregue em instantes.</div>
      ) : (
        <>
          <div className="cards">
            <div className="card">
              <div className="rotulo">Clientes</div>
              <div className="valor">{dados.clientes}</div>
            </div>
            <div className="card">
              <div className="rotulo">Contratos</div>
              <div className="valor">{dados.contratos}</div>
            </div>
            <div className="card ok">
              <div className="rotulo">Ativos</div>
              <div className="valor">{dados.ativos}</div>
            </div>
            <div className="card warn">
              <div className="rotulo">Encerrados</div>
              <div className="valor">{dados.encerrados}</div>
            </div>
            <div className="card">
              <div className="rotulo">Excluídos</div>
              <div className="valor">{dados.excluidos}</div>
            </div>
          </div>

          <div className="grade-2">
            <section>
              <h2 style={{ fontSize: '1.05rem' }}>Contratos recentes</h2>
              {dados.recentes.length === 0 ? (
                <div className="vazio">Nenhum contrato cadastrado ainda.</div>
              ) : (
                <div className="tabela-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Processo</th>
                        <th>Banco</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {dados.recentes.map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.clienteNome}</td>
                          <td className="mono">{c.processoNumero}</td>
                          <td>{c.banco}</td>
                          <td>
                            <span className={`selo-status ${c.status}`}>{c.status}</span>
                          </td>
                          <td>
                            <a className="btn" href={`/juridico/contratos/${c.id}`}>
                              Abrir
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 style={{ fontSize: '1.05rem' }}>Contratos por banco</h2>
              {dados.porBanco.length === 0 ? (
                <div className="vazio">Sem contratos ainda.</div>
              ) : (
                <div className="tabela-wrap">
                  <table>
                    <tbody>
                      {dados.porBanco.map((b) => (
                        <tr key={b.banco}>
                          <td>{b.banco}</td>
                          <td style={{ fontWeight: 800, textAlign: 'right' }}>{b.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h2 style={{ fontSize: '1.05rem', marginTop: 20 }}>Histórico recente</h2>
              <div className="secao-form" style={{ marginBottom: 0 }}>
                {dados.historico.length === 0 ? (
                  <div className="vazio" style={{ border: 'none' }}>
                    Nenhuma movimentação ainda.
                  </div>
                ) : (
                  dados.historico.map((h, i) => (
                    <div className="hist-item" key={i}>
                      <div style={{ fontWeight: 600 }}>{h.texto}</div>
                      <div className="hist-meta">
                        {h.detalhe} · {h.autor} · {dataBr(h.em)}{' '}
                        {new Date(h.em).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
