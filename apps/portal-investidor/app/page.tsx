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
  if (p.realizado !== null)
    return (
      <div className="maturacao">
        <div className="dim">Encerrado em {dataBr(p.desfechoEm)}</div>
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

const SuaParte = ({ p }: { p: ProcessoNoPainel }): ReactElement => {
  if (p.realizado === null)
    return (
      <>
        <div className="valor-parte">{moedaCurta(p.referencia)}</div>
        <div className="etiqueta">referência</div>
      </>
    );
  const ajuste = p.realizado - p.referencia;
  return (
    <>
      <div className="valor-parte">{moedaCurta(p.realizado)}</div>
      <div className={ajuste > 0 ? 'dim positivo' : ajuste < 0 ? 'dim negativo' : 'dim'}>
        {p.fase === 'pago'
          ? `pago ${moedaCurta(p.valorRecebido ?? 0)} · ${moedaComSinal(ajuste)}`
          : `sem êxito · ${moedaComSinal(ajuste)}`}
      </div>
    </>
  );
};

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
  const encerrados = totais.pagos + totais.perdidos;

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
                {totais.processos} {totais.processos === 1 ? 'processo' : 'processos'} ·{' '}
                {moedaCurta(totais.valorDosProcessos)} em processos · a sua parte é a da empresa (
                {percentual}%)
              </div>
            </div>
            <div className="hero-tiles">
              <div className="tile">
                <div className="tile-rotulo">Já realizado</div>
                <div className="tile-valor">{moedaCurta(totais.realizado)}</div>
                <div className="tile-sub">
                  {encerrados} {encerrados === 1 ? 'processo encerrado' : 'processos encerrados'}
                </div>
              </div>
              <div className="tile">
                <div className="tile-rotulo">A receber (referência)</div>
                <div className="tile-valor">{moedaCurta(totais.aReceber)}</div>
                <div className="tile-sub">{totais.emCurso} em curso</div>
              </div>
              <div className="tile">
                <div className="tile-rotulo">Ajuste sobre a referência</div>
                <div className="tile-valor">
                  {encerrados === 0 ? '—' : moedaComSinal(totais.ajuste)}
                </div>
                <div className="tile-sub">valor real dos encerrados</div>
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
                Processos da carteira em cada fase, do mais novo ao desfecho. O valor soma a
                referência dos processos em curso e o valor real dos encerrados.
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
                  Cada processo tem <b>{moeda(premissas.valorReferenciaProcesso)}</b> de referência
                  — raramente o resultado é menor que isso.
                </span>
              </li>
              <li>
                <span className="n">2</span>
                <span>
                  A sua parte é a da empresa: <b>{percentual}%</b> do resultado, ou{' '}
                  <b>{moeda(premissas.referenciaPorProcesso)}</b> por processo enquanto ele corre.
                </span>
              </li>
              <li>
                <span className="n">3</span>
                <span>
                  Quando o processo é pago, vale o <b>valor real</b>: se passar da referência, a sua
                  parte aumenta; se ficar abaixo, diminui.
                </span>
              </li>
              <li>
                <span className="n">4</span>
                <span>
                  Processo <b>encerrado sem êxito</b> não gera valor e sai do total.
                </span>
              </li>
              <li>
                <span className="n">5</span>
                <span>
                  O prazo estimado até o resultado é de <b>18 a 24 meses</b> desde a distribuição,
                  mas depende do andamento de cada processo.
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
