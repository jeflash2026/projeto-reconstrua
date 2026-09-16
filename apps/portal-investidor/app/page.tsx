// PAINEL DO INVESTIDOR (2026-09-16) — a carteira de créditos judiciais do
// investidor autenticado: o valor de hoje, a composição por fase, cada processo
// (cliente por iniciais, bancos, advogado, fase, maturação e a parte dele), o
// extrato e as premissas do cálculo. Só leitura; tudo do PRÓPRIO CPF.
import { cookies } from 'next/headers';
import type { ReactElement } from 'react';
import ComposicaoCarteira from '../components/composicao-carteira';
import { SairButton } from '../components/sair-button';
import {
  COR_DA_FASE,
  dataBr,
  getJson,
  moeda,
  moedaComSinal,
  moedaCurta,
  type PainelInvestidor,
  type ProcessoNoPainel,
} from '../lib/api';
import { INVESTIDOR_SESSION_COOKIE, investidorDaSessao } from '../lib/session';

export const dynamic = 'force-dynamic';

const SEGREDO = process.env['ADMIN_API_TOKEN'] ?? '';

function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0] ?? '';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

const Barra = ({ nome }: { nome: string | null }): ReactElement => (
  <div className="barra">
    <div className="marca">
      <img src="/investidor/icone.png" alt="" />
      <div>
        <div className="marca-nome">
          Projeto <span>Reconstrua</span>
        </div>
        <div className="marca-sub">Painel do Investidor</div>
      </div>
    </div>
    <div className="sessao">
      {nome !== null ? <span>{nome}</span> : null}
      <SairButton />
    </div>
  </div>
);

const Maturacao = ({ p, prazo }: { p: ProcessoNoPainel; prazo: number }): ReactElement => {
  if (p.valor.tipo !== 'referencia')
    return (
      <div className="maturacao">
        <div className="dim">
          {p.valor.tipo === 'apurado'
            ? `Valor apurado em ${dataBr(p.valor.em)} · aguardando o pagamento`
            : p.valor.tipo === 'recebido'
              ? `Pago em ${dataBr(p.valor.em)}`
              : `Encerrado em ${dataBr(p.valor.em)}`}
        </div>
      </div>
    );
  const fracao = Math.min(1, p.mesesDecorridos / prazo);
  return (
    <div className="maturacao">
      <div className="medidor" aria-hidden>
        <i style={{ width: `${String(Math.max(3, Math.round(fracao * 100)))}%` }} />
      </div>
      <div className="dim">
        {p.mesesDecorridos} de ~{prazo} meses · desde {dataBr(p.desde)}
      </div>
    </div>
  );
};

const ROTULO_VALOR: Record<ProcessoNoPainel['valor']['tipo'], string> = {
  referencia: 'referência',
  apurado: 'apurado',
  recebido: 'recebido',
  'sem-exito': 'sem êxito',
};

const SuaParte = ({ p }: { p: ProcessoNoPainel }): ReactElement => (
  <>
    <div className="valor-parte">{moedaCurta(p.valor.parte)}</div>
    <div className="etiqueta">{ROTULO_VALOR[p.valor.tipo]}</div>
    {p.valor.valorDoProcesso !== null ? (
      <div className="dim sem-quebra">{moedaCurta(p.valor.valorDoProcesso)} no processo</div>
    ) : null}
  </>
);

export default async function PainelPage(): Promise<ReactElement> {
  const cpf = investidorDaSessao(SEGREDO, cookies().get(INVESTIDOR_SESSION_COOKIE)?.value ?? '');
  const painel =
    cpf === null
      ? null
      : await getJson<PainelInvestidor>(`/admin/investidor/painel/${encodeURIComponent(cpf)}`);

  if (painel === null) {
    return (
      <>
        <header className="faixa">
          <div className="faixa-inner">
            <Barra nome={null} />
          </div>
        </header>
        <main className="conteudo">
          <div className="cartao vazio">
            Não foi possível carregar a sua carteira agora. Atualize a página em instantes — se
            continuar, fale com o escritório.
          </div>
        </main>
      </>
    );
  }

  const { totais, premissas } = painel;
  const percentual = Math.round(premissas.parteDaEmpresa * 100);
  const percentualLimite = Math.round(premissas.limiteSobreCredito * 100);
  const usoDoLimite = totais.limite > 0 ? Math.min(1, totais.valorAtual / totais.limite) : 0;

  return (
    <>
      <header className="faixa">
        <div className="faixa-inner">
          <Barra nome={painel.nome} />
          <section className="hero">
            <div>
              <div className="kicker">Carteira de créditos judiciais</div>
              <div className="saudacao">Olá, {primeiroNome(painel.nome)}</div>
              <div className="hero-rotulo">Valor da sua carteira hoje</div>
              <div className="hero-valor">{moedaCurta(totais.valorAtual)}</div>
              <div className="hero-sub">
                Crédito de {moedaCurta(totais.credito)} · {totais.processos}{' '}
                {totais.processos === 1 ? 'processo' : 'processos'} · limite de recebimento{' '}
                {moedaCurta(totais.limite)} (crédito + {percentualLimite}%)
              </div>
              {totais.limite > 0 ? (
                <div className="limite">
                  <div className="limite-barra" aria-hidden>
                    <i
                      style={{ width: `${String(Math.max(1, Math.round(usoDoLimite * 100)))}%` }}
                    />
                  </div>
                  <div className="limite-legenda">
                    {Math.round(usoDoLimite * 100)}% do limite · {moedaCurta(totais.valorAtual)} de{' '}
                    {moedaCurta(totais.limite)}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hero-tiles">
              <div className="tile">
                <div className="tile-rotulo">Recebido</div>
                <div className="tile-valor">{moedaCurta(totais.recebido)}</div>
                <div className="tile-sub">
                  {totais.pagos} {totais.pagos === 1 ? 'processo pago' : 'processos pagos'}
                </div>
              </div>
              <div className="tile">
                <div className="tile-rotulo">Apurado, aguardando pagamento</div>
                <div className="tile-valor">{moedaCurta(totais.apurado)}</div>
                <div className="tile-sub">
                  {totais.apurados} {totais.apurados === 1 ? 'processo' : 'processos'} na execução
                </div>
              </div>
              <div className="tile">
                <div className="tile-rotulo">A receber (referência)</div>
                <div className="tile-valor">{moedaCurta(totais.aReceber)}</div>
                <div className="tile-sub">{totais.emCurso} em curso</div>
              </div>
            </div>
          </section>
        </div>
      </header>

      <main className="conteudo">
        {totais.processos === 0 ? (
          <div className="cartao vazio">
            A sua carteira está sendo montada. Assim que os processos forem alocados, eles aparecem
            aqui com a fase de cada um.
          </div>
        ) : (
          <>
            <section className="cartao">
              <h2>Composição por fase</h2>
              <p className="cartao-sub">
                Processos da carteira em cada fase, do mais novo ao desfecho. O valor soma a sua
                parte em cada processo: a referência enquanto corre, o valor real quando apurado ou
                pago.
              </p>
              <ComposicaoCarteira porFase={painel.porFase} />
            </section>

            <section className="cartao">
              <h2>Seus processos</h2>
              <p className="cartao-sub">
                Os clientes aparecem pelas iniciais, para preservar os dados pessoais deles. A fase
                e a última movimentação vêm do acompanhamento automático dos tribunais.
              </p>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Bancos</th>
                      <th>Advogado responsável</th>
                      <th>Fase</th>
                      <th>Última movimentação</th>
                      <th>Maturação</th>
                      <th className="num">Sua parte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {painel.processos.map((p) => (
                      <tr key={p.numero}>
                        <td>
                          <div className="mono">{p.numero}</div>
                          <div className="dim">
                            Cliente {p.iniciais}
                            {p.tribunal !== '' ? ` · ${p.tribunal}` : ''}
                          </div>
                        </td>
                        <td>{p.bancos.join(', ')}</td>
                        <td>{p.advogado ?? <span className="dim">a definir</span>}</td>
                        <td>
                          <span className="fase">
                            <i style={{ background: COR_DA_FASE[p.fase] }} />
                            {p.faseRotulo}
                          </span>
                        </td>
                        <td>
                          {p.ultimaMovimentacao !== null ? (
                            <>
                              <div>{p.ultimaMovimentacao.nome}</div>
                              <div className="dim">{dataBr(p.ultimaMovimentacao.data)}</div>
                            </>
                          ) : (
                            <span className="dim">aguardando a primeira publicação</span>
                          )}
                        </td>
                        <td>
                          <Maturacao p={p} prazo={premissas.prazoEstimadoMeses} />
                        </td>
                        <td className="num">
                          <SuaParte p={p} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <div className="duas-colunas">
          <section className="cartao">
            <h2>Extrato</h2>
            <p className="cartao-sub">Cada movimento que mudou o valor da sua carteira.</p>
            {painel.extrato.length === 0 ? (
              <div className="dim">Nenhum movimento ainda.</div>
            ) : (
              <ul className="extrato">
                {painel.extrato.map((l, i) => (
                  <li key={`${l.em}-${String(i)}`}>
                    <span className="quando">{dataBr(l.em)}</span>
                    <span>{l.descricao}</span>
                    <span
                      className={
                        l.valor > 0 ? 'quanto positivo' : l.valor < 0 ? 'quanto negativo' : 'quanto'
                      }
                    >
                      {moedaComSinal(l.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cartao">
            <h2>Como a sua carteira é calculada</h2>
            <p className="cartao-sub">As premissas por trás de cada número deste painel.</p>
            <ul className="premissas">
              <li>
                <span className="n">1</span>
                <span>
                  O seu crédito é coberto por processos que valem{' '}
                  <b>{moeda(premissas.referenciaPorProcesso)}</b> cada para você: a parte da empresa
                  ({percentual}%) em <b>{moeda(premissas.valorReferenciaProcesso)}</b> de referência
                  por processo.
                </span>
              </li>
              <li>
                <span className="n">2</span>
                <span>
                  Na <b>execução</b>, o valor real do processo é apurado e já entra no seu painel —
                  falta só o tempo processual até o pagamento.
                </span>
              </li>
              <li>
                <span className="n">3</span>
                <span>
                  Vale sempre o <b>valor real</b>: se o processo render mais que a referência, a sua
                  parte aumenta; se render menos, diminui.
                </span>
              </li>
              <li>
                <span className="n">4</span>
                <span>
                  O seu recebimento tem limite de <b>crédito + {percentualLimite}%</b>
                  {totais.limite > 0 ? <> ({moeda(totais.limite)})</> : null}.
                </span>
              </li>
              <li>
                <span className="n">5</span>
                <span>
                  Processo <b>encerrado sem êxito</b> não gera valor.
                </span>
              </li>
              <li>
                <span className="n">6</span>
                <span>
                  O prazo estimado até o pagamento é de <b>18 a 24 meses</b> desde a distribuição, e
                  depende do andamento de cada processo.
                </span>
              </li>
            </ul>
          </section>
        </div>

        <p className="rodape">
          Valores de referência são estimativas, não garantia de resultado: cada processo depende da
          decisão judicial. Painel atualizado em {dataBr(painel.geradoEm)} a partir do
          acompanhamento processual (DataJud e Diário de Justiça Eletrônico Nacional).
        </p>
      </main>
    </>
  );
}
