// PROCESSOS — agrupados por cliente + nº CNJ, com os contratos de cada banco
// e o ACOMPANHAMENTO AUTOMÁTICO do DataJud (classe, última movimentação).
import type { ReactElement } from 'react';
import {
  getJson,
  moeda,
  dataBr,
  type AndamentoProcesso,
  type ContratoJuridico,
} from '../../../lib/api';
import AtualizarAndamentos from '../../../components/atualizar-andamentos';

export const dynamic = 'force-dynamic';

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}): Promise<ReactElement> {
  const [dados, andamentosData] = await Promise.all([
    getJson<{ contratos: ContratoJuridico[] }>('/admin/juridico/contratos'),
    getJson<{ andamentos: AndamentoProcesso[] }>('/admin/juridico/andamentos'),
  ]);
  const andamentoPorNumero = new Map(
    (andamentosData?.andamentos ?? []).map((a) => [a.numero.replace(/\D/g, ''), a]),
  );
  const busca = (searchParams.q ?? '').trim().toLowerCase();
  const filtroStatus = searchParams.status ?? '';
  const todos = dados?.contratos ?? null;
  const contratos =
    todos === null
      ? null
      : todos.filter(
          (c) =>
            (filtroStatus === '' || c.status === filtroStatus) &&
            (busca === '' ||
              (c.clienteNome ?? '').toLowerCase().includes(busca) ||
              c.processoNumero.toLowerCase().includes(busca) ||
              c.banco.toLowerCase().includes(busca) ||
              c.numero.toLowerCase().includes(busca)),
        );

  // Agrupa por cliente + processo (como no original).
  const grupos = new Map<
    string,
    { clienteNome: string; processo: string; itens: ContratoJuridico[] }
  >();
  for (const c of contratos ?? []) {
    const chave = `${c.clienteId}|${c.processoNumero}`;
    const grupo = grupos.get(chave) ?? {
      clienteNome: c.clienteNome ?? '—',
      processo: c.processoNumero,
      itens: [],
    };
    grupo.itens.push(c);
    grupos.set(chave, grupo);
  }

  return (
    <>
      <h1 className="titulo">Processos</h1>
      <p className="subtitulo">Localize por cliente, nº do processo, banco ou contrato.</p>
      <div className="acoes-topo">
        <a className="btn primario" href="/juridico/processos/novo">
          Novo processo
        </a>
        <AtualizarAndamentos processos={grupos.size} />
        <form
          method="GET"
          action="/juridico/processos"
          style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}
        >
          <input name="q" placeholder="Buscar…" defaultValue={searchParams.q ?? ''} />
          <select name="status" defaultValue={filtroStatus}>
            <option value="">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="encerrado">Encerrados</option>
            <option value="excluido">Excluídos</option>
          </select>
          <button className="btn" type="submit">
            Filtrar
          </button>
        </form>
      </div>

      {contratos === null ? (
        <div className="erro-box">API indisponível.</div>
      ) : grupos.size === 0 ? (
        <div className="vazio">Nenhum processo encontrado.</div>
      ) : (
        [...grupos.values()].map((g) => {
          const bancos = new Set(g.itens.map((c) => c.banco));
          const andamento = andamentoPorNumero.get(g.processo.replace(/\D/g, '')) ?? null;
          return (
            <div className="secao-form" key={`${g.clienteNome}-${g.processo}`}>
              <div style={{ fontWeight: 800 }}>{g.clienteNome}</div>
              <div className="mono" style={{ marginBottom: 4 }}>
                {g.processo}{' '}
                {andamento?.emExecucao === true ? (
                  <span className="selo-status encerrado">⚡ Em execução</span>
                ) : null}{' '}
                {andamento?.novidade === true ? (
                  <span className="selo-status ativo">novidade</span>
                ) : null}
              </div>
              {/* ACOMPANHAMENTO AUTOMÁTICO (DataJud/CNJ): classe + última
                  movimentação — sem digitação manual. */}
              {andamento !== null && andamento.erro === null ? (
                <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 4 }}>
                  <strong style={{ color: 'var(--ink)' }}>{andamento.classe || 'Classe —'}</strong>
                  {andamento.orgaoJulgador !== '' ? ` · ${andamento.orgaoJulgador}` : ''}
                  {andamento.ultimoMovimento !== null ? (
                    <>
                      {' · última mov.: '}
                      <strong style={{ color: 'var(--ink)' }}>
                        {andamento.ultimoMovimento.nome}
                      </strong>{' '}
                      em {dataBr(andamento.ultimoMovimento.dataHora)}
                    </>
                  ) : null}
                  {` (DataJud, consultado em ${dataBr(andamento.consultadoEm)})`}
                </div>
              ) : andamento !== null && andamento.erro !== null ? (
                <div style={{ fontSize: 13, color: 'var(--ambar, #8a6100)', marginBottom: 4 }}>
                  DataJud: {andamento.erro}
                </div>
              ) : null}
              <div style={{ color: 'var(--ink-dim)', fontSize: 13, marginBottom: 10 }}>
                {g.itens.length} contrato(s) em {bancos.size} banco(s)
              </div>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Banco</th>
                      <th>Contrato</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {g.itens.map((c) => (
                      <tr key={c.id}>
                        <td>{c.banco}</td>
                        <td className="mono">{c.numero}</td>
                        <td>{moeda(c.valor)}</td>
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
            </div>
          );
        })
      )}
    </>
  );
}
