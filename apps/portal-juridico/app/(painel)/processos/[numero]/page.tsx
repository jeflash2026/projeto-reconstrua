// FICHA DO PROCESSO (2026-09-11) — capa, contratos e o acompanhamento
// (DataJud + DJEN) com o PARECER da AHRI de cada intimação; em destaque, o da
// publicação atual (a mais recente com texto no DJEN).
import type { ReactElement } from 'react';
import {
  getJson,
  moeda,
  dataBr,
  type AnaliseDaComunicacao,
  type DeterminacaoComVencimento,
  type DeterminacaoDoJuizo,
  type MovimentoComParecer,
  type ProcessoDetalhe,
} from '../../../../lib/api';
import GerarParecer from '../../../../components/gerar-parecer';

export const dynamic = 'force-dynamic';

const TOM: Record<AnaliseDaComunicacao['tom'], { rotulo: string; cor: string }> = {
  favoravel: { rotulo: 'favorável', cor: '#1e7e34' },
  desfavoravel: { rotulo: 'desfavorável', cor: '#c0392b' },
  neutro: { rotulo: 'andamento', cor: 'var(--ink-dim)' },
};

const Tom = ({ tom }: { tom: AnaliseDaComunicacao['tom'] }): ReactElement => (
  <span
    style={{
      fontSize: 12,
      fontWeight: 700,
      color: TOM[tom].cor,
      border: '1px solid currentColor',
      borderRadius: 999,
      padding: '1px 8px',
    }}
  >
    {TOM[tom].rotulo}
  </span>
);

function prazoTexto(dias: number | null): string {
  if (dias === null) return 'sem prazo escrito';
  if (dias < -1) return `venceu há ${String(-dias)} dias`;
  if (dias === -1) return 'venceu ontem';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `faltam ${String(dias)} dias`;
}

/** Vermelho até 3 dias (ou vencido), âmbar até 7, verde depois. */
function corPrazo(dias: number | null): string {
  if (dias === null) return 'var(--ink-dim)';
  if (dias <= 3) return '#c0392b';
  if (dias <= 7) return 'var(--ambar, #8a6100)';
  return '#1e7e34';
}

type Determinacao = DeterminacaoDoJuizo &
  Partial<Pick<DeterminacaoComVencimento, 'vencimentoEstimado' | 'diasRestantes'>>;

const Determinacoes = ({ itens }: { itens: readonly Determinacao[] }): ReactElement | null =>
  itens.length === 0 ? null : (
    <ul style={{ margin: '6px 0 8px 18px', padding: 0 }}>
      {itens.map((d, i) => (
        <li key={i} style={{ margin: '4px 0' }}>
          <strong>{d.oQue}</strong>{' '}
          <span style={{ color: 'var(--ink-dim)' }}>({d.responsavel})</span>
          {d.prazoDias !== null ? (
            <>
              {' '}
              — {d.prazoDias} dias {d.diasCorridos ? 'corridos' : 'úteis'}
              {d.vencimentoEstimado !== undefined && d.vencimentoEstimado !== null ? (
                <>
                  , vence por volta de <strong>{dataBr(d.vencimentoEstimado)}</strong>{' '}
                  <span style={{ color: corPrazo(d.diasRestantes ?? null), fontWeight: 700 }}>
                    ({prazoTexto(d.diasRestantes ?? null)})
                  </span>
                </>
              ) : null}
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );

const TextoPublicado = ({ m }: { m: MovimentoComParecer }): ReactElement | null =>
  typeof m.texto === 'string' && m.texto !== '' ? (
    <details style={{ marginTop: 4 }}>
      <summary
        style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600 }}
      >
        ler o texto publicado
      </summary>
      <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{m.texto}</div>
      {typeof m.link === 'string' && m.link !== '' ? (
        <a href={m.link} target="_blank" rel="noreferrer">
          abrir no sistema do tribunal →
        </a>
      ) : null}
    </details>
  ) : null;

export default async function ProcessoPage({
  params,
}: {
  params: { numero: string };
}): Promise<ReactElement> {
  const digitos = params.numero.replace(/\D/g, '');
  const dados = await getJson<ProcessoDetalhe>(`/admin/juridico/processos/${digitos}`);
  if (dados === null) {
    return <div className="erro-box">Processo não encontrado (ou API indisponível).</div>;
  }
  const { andamento, acompanhamento } = dados;
  const bancos = [...new Set(dados.contratos.map((c) => c.banco))];
  const atual = acompanhamento?.atual ?? null;
  const movimentos: MovimentoComParecer[] =
    acompanhamento?.movimentos ??
    (andamento?.movimentos ?? []).map((m) => ({
      ...m,
      chave: null,
      analise: null,
      aguardandoParecer: false,
    }));
  const movimentoAtual =
    atual === null ? null : (movimentos.find((m) => m.chave === atual.analise.chave) ?? null);
  const capa =
    andamento === null
      ? ''
      : [andamento.classe, andamento.orgaoJulgador, andamento.tribunal]
          .filter((x) => x !== '')
          .join(' · ');

  return (
    <>
      <h1 className="titulo mono" style={{ fontSize: '1.25rem' }}>
        {dados.numero}
      </h1>
      <p className="subtitulo">
        {dados.clienteNome}
        {bancos.length > 0 ? ` · ${bancos.join(', ')}` : ''}
      </p>
      <div className="acoes-topo">
        <a className="btn" href={`/juridico/clientes/${dados.clienteId}`}>
          Cliente
        </a>
        <a className="btn" href="/juridico/processos">
          Todos os processos
        </a>
      </div>

      {/* ── PARECER DA AHRI — a publicação atual ─────────────────────────── */}
      <div
        className="secao-form"
        style={{ borderColor: '#f0dfae', background: 'var(--ambar-bg, #fdf6e3)' }}
      >
        <h3 style={{ color: 'var(--ambar, #8a6100)' }}>Parecer da AHRI — publicação atual</h3>
        {acompanhamento === null ? (
          <div className="vazio">Parecer automático indisponível nesta instalação.</div>
        ) : atual !== null ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{atual.analise.tipo}</strong>
              <span style={{ color: 'var(--ink-dim)' }}>
                publicada no DJEN em {dataBr(atual.analise.dataPublicacao)}
              </span>
              <Tom tom={atual.analise.tom} />
            </div>
            <p style={{ margin: '10px 0 4px', fontSize: 15 }}>{atual.analise.resumo}</p>
            <Determinacoes itens={atual.determinacoes} />
            {atual.analise.proximoPasso !== '' ? (
              <p style={{ margin: '4px 0' }}>
                <strong>Próximo passo:</strong> {atual.analise.proximoPasso}
              </p>
            ) : null}
            {movimentoAtual !== null ? <TextoPublicado m={movimentoAtual} /> : null}
            <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '10px 0 0' }}>
              Vencimentos são estimativas em dias úteis a partir da publicação no DJEN, sem feriados
              locais — confira a contagem oficial no eproc. O parecer resume o texto publicado e não
              substitui a leitura do advogado.
            </p>
          </>
        ) : acompanhamento.atualPendente ? (
          <>
            <p style={{ margin: '0 0 10px' }}>
              A publicação mais recente deste processo ainda não tem parecer.
            </p>
            {acompanhamento.parecerDisponivel ? (
              <GerarParecer numero={digitos} />
            ) : (
              <div className="vazio">Parecer automático indisponível nesta instalação.</div>
            )}
          </>
        ) : (
          <div className="vazio">
            Ainda não há publicação com texto no DJEN para este processo. O parecer aparece quando
            sair a primeira intimação.
          </div>
        )}
      </div>

      {/* ── ACOMPANHAMENTO: capa + linha do tempo com o parecer de cada ato ── */}
      <div className="secao-form">
        <h3>Acompanhamento (DataJud + DJEN)</h3>
        {andamento === null ? (
          <div className="vazio">
            Processo ainda não consultado — a consulta automática roda a cada 6 horas (ou use
            &quot;Atualizar andamentos&quot; em Processos).
          </div>
        ) : (
          <>
            <div style={{ color: 'var(--ink-dim)', fontSize: 13, marginBottom: 8 }}>
              {capa !== '' ? (
                <strong style={{ color: 'var(--ink)' }}>{capa}</strong>
              ) : (
                'Capa ainda não publicada'
              )}
              {andamento.assunto !== '' ? ` · assunto: ${andamento.assunto}` : ''}
              {andamento.dataAjuizamento !== ''
                ? ` · ajuizado em ${dataBr(andamento.dataAjuizamento)}`
                : ''}
              {` · consultado em ${dataBr(andamento.consultadoEm)}`}
            </div>
            {andamento.erro !== null ? (
              <div style={{ fontSize: 13, color: 'var(--ambar, #8a6100)', marginBottom: 8 }}>
                Acompanhamento: {andamento.erro}
              </div>
            ) : null}
            {movimentos.length === 0 ? (
              <div style={{ color: 'var(--ink-dim)' }}>Sem movimentações registradas.</div>
            ) : (
              movimentos.map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 0',
                    fontSize: 13.5,
                    borderBottom: i < movimentos.length - 1 ? '1px solid var(--linha)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{dataBr(m.dataHora)}</strong> — {m.nome}
                    {m.analise !== null ? <Tom tom={m.analise.tom} /> : null}
                    {m.aguardandoParecer ? (
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 600 }}>
                        parecer em preparação
                      </span>
                    ) : null}
                  </div>
                  {m.analise !== null ? (
                    <div style={{ marginTop: 4 }}>
                      <div>{m.analise.resumo}</div>
                      <Determinacoes itens={m.analise.determinacoes} />
                      {m.analise.proximoPasso !== '' ? (
                        <div>
                          <strong>Próximo passo:</strong> {m.analise.proximoPasso}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <TextoPublicado m={m} />
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* ── CONTRATOS DESTE PROCESSO ─────────────────────────────────────── */}
      <h2 style={{ fontSize: '1.05rem' }}>Contratos ({dados.contratos.length})</h2>
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
            {dados.contratos.map((c) => (
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
    </>
  );
}
