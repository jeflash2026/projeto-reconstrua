// DASHBOARD v2 (2026-08-08) — visão executiva: ALERTAS de movimentação
// importante (execução, recebimento, sentença…) com o nome do cliente,
// números que importam (valor em contratos, guias, perícias próximas) e o
// acompanhamento VIVO do DataJud (a api consulta sozinha a cada 6h).
import type { ReactElement } from 'react';
import { getJson, moeda, dataBr, ROTULO_SITUACAO, type DashboardJuridico } from '../../lib/api';

export const dynamic = 'force-dynamic';

function horaBr(iso: string | null): string {
  if (iso === null) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default async function DashboardPage(): Promise<ReactElement> {
  const dados = await getJson<DashboardJuridico>('/admin/juridico/dashboard');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="titulo" style={{ marginBottom: 0 }}>
          Dashboard
        </h1>
        {dados !== null ? (
          <span style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600 }}>
            Acompanhamento automático (DataJud) · última consulta:{' '}
            {horaBr(dados.ultimaConsultaDatajud)} · próxima em até 6h
          </span>
        ) : null}
      </div>
      <p className="subtitulo">Visão geral da operação jurídica.</p>
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
          {/* ── ALERTAS: o que precisa da atenção de vocês AGORA ───────────── */}
          {dados.alertas.length > 0 ? (
            <div
              className="secao-form"
              style={{ borderColor: '#f0dfae', background: 'var(--ambar-bg, #fdf6e3)' }}
            >
              <h3 style={{ color: 'var(--ambar, #8a6100)' }}>
                🔔 Atenção — movimentações importantes (últimos 60 dias)
              </h3>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Situação</th>
                      <th>Cliente</th>
                      <th>Processo</th>
                      <th>Movimentação</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.alertas.map((a, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                          {a.tipo}{' '}
                          {a.novidade ? <span className="selo-status ativo">novo</span> : null}
                        </td>
                        <td style={{ fontWeight: 600 }}>{a.clienteNome}</td>
                        <td className="mono" style={{ fontSize: 12.5 }}>
                          <a href={`/juridico/processos?q=${encodeURIComponent(a.processo)}`}>
                            {a.processo}
                          </a>
                        </td>
                        <td>{a.movimento}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{dataBr(a.dataHora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="ok-box">
              ✓ Nenhuma movimentação importante nos últimos 60 dias — processos seguindo o curso
              normal.
            </div>
          )}

          {/* ── NÚMEROS QUE IMPORTAM ───────────────────────────────────────── */}
          <div className="cards">
            <div className="card">
              <div className="rotulo">Clientes</div>
              <div className="valor">{dados.clientes}</div>
            </div>
            <div className="card ok">
              <div className="rotulo">Contratos ativos</div>
              <div className="valor">{dados.ativos}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600 }}>
                {dados.encerrados} encerrados · {dados.excluidos} excluídos
              </div>
            </div>
            <div className="card">
              <div className="rotulo">Valor em contratos ativos</div>
              <div className="valor" style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)' }}>
                {moeda(dados.valorAtivos)}
              </div>
            </div>
            <div className="card ok">
              <div className="rotulo">Guias ({dados.guias.total})</div>
              <div className="valor" style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)' }}>
                {moeda(dados.guias.valor)}
              </div>
            </div>
            <div className="card warn">
              <div className="rotulo">Perícias próximas</div>
              <div className="valor">{dados.periciasProximas.length}</div>
            </div>
          </div>

          <div className="grade-2">
            <section>
              {/* ── PRÓXIMAS PERÍCIAS ─────────────────────────────────────── */}
              {dados.periciasProximas.length > 0 ? (
                <>
                  <h2 style={{ fontSize: '1.05rem' }}>Próximas perícias</h2>
                  <div className="tabela-wrap" style={{ marginBottom: 20 }}>
                    <table>
                      <tbody>
                        {dados.periciasProximas.map((p) => (
                          <tr key={p.id}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                              {dataBr(p.data)}
                              {p.horario !== null ? ` ${p.horario}` : ''}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{p.requerente}</div>
                              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
                                {p.local || '—'} · {ROTULO_SITUACAO[p.situacao] ?? p.situacao}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              <h2 style={{ fontSize: '1.05rem' }}>Contratos recentes</h2>
              {dados.recentes.length === 0 ? (
                <div className="vazio">Nenhum contrato cadastrado ainda.</div>
              ) : (
                <div className="tabela-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Banco</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {dados.recentes.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.clienteNome}</div>
                            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                              {c.processoNumero}
                            </div>
                          </td>
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
                <div className="tabela-wrap" style={{ marginBottom: 20 }}>
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

              <h2 style={{ fontSize: '1.05rem' }}>Histórico recente</h2>
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
                        {h.detalhe} · {h.autor} · {horaBr(h.em)}
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
