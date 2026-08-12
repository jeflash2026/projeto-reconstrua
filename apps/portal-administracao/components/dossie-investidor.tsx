'use client';
// DOSSIÊ DE INVESTIDOR (2026-08-12) — a página que vai para a mesa de
// negociação. Duas regras de leitura: cada degrau mostra a taxa contra o degrau
// ANTERIOR (é ela que revela onde a máquina vaza), e o custo de IA por cliente
// fechado fica em destaque — é a métrica que sustenta a tese de eficiência.
// Sai em PDF pelo botão (window.print(); o CSS de impressão esconde a navegação).
import type { ReactElement } from 'react';

export interface EtapaFunil {
  id: string;
  rotulo: string;
  explicacao: string;
  quantidade: number;
  taxaDaAnterior: number | null;
  taxaDoTopo: number;
}
export interface CoorteMensal {
  mes: string;
  leads: number;
  fase1: number;
  confirmados: number;
  fechados: number;
}
export interface Dossie {
  geradoEm: string;
  funil: EtapaFunil[];
  coortes: CoorteMensal[];
  economia: {
    custoIaUsd: number;
    custoIaPorLeadUsd: number | null;
    custoIaPorClienteFechadoUsd: number | null;
    chamadasDeIa: number;
  };
  carteira: {
    contratosAnalisados: number;
    clientesComContrato: number;
    potencialConfirmado: number;
    clientesFechados: number;
    potencialMedianoPorClienteFechado: number | null;
    ufs: { uf: string; clientes: number }[];
  };
  velocidade: { diasAteParecer: number | null; diasParaConfirmar: number | null };
  fontes: { bloco: string; origem: string }[];
}

const reais = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dolares = (v: number, casas = 2): string =>
  `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
const mesLegivel = (mes: string): string => {
  const [ano, m] = mes.split('-');
  return `${m ?? '??'}/${ano ?? '????'}`;
};

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}): ReactElement {
  return (
    <div className="dossie-num">
      <div className="dossie-num-rotulo">{rotulo}</div>
      <strong className={destaque === true ? 'dossie-num-valor destaque' : 'dossie-num-valor'}>
        {valor}
      </strong>
      {nota !== undefined ? <div className="dossie-num-nota">{nota}</div> : null}
    </div>
  );
}

export default function DossieInvestidor({ dossie }: { dossie: Dossie }): ReactElement {
  const topo = dossie.funil[0]?.quantidade ?? 0;
  const fechados = dossie.funil[dossie.funil.length - 1]?.quantidade ?? 0;

  return (
    <div className="dossie">
      <div className="so-tela" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="primary"
          onClick={() => {
            window.print();
          }}
        >
          Salvar como PDF / Imprimir
        </button>
      </div>

      <div className="card">
        <h3>O funil, degrau a degrau</h3>
        <p className="page-sub">
          A coluna que importa é <strong>“do degrau anterior”</strong>: é ela que mostra onde a
          máquina perde gente. A do topo serve só para dimensionar.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Pessoas</th>
                <th>Do degrau anterior</th>
                <th>Do topo</th>
              </tr>
            </thead>
            <tbody>
              {dossie.funil.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.rotulo}</strong>
                    <div className="dossie-explica">{e.explicacao}</div>
                  </td>
                  <td>{e.quantidade}</td>
                  <td>{e.taxaDaAnterior === null ? '—' : `${e.taxaDaAnterior}%`}</td>
                  <td>{e.taxaDoTopo}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="page-sub" style={{ marginTop: 8 }}>
          De {topo} pessoa(s) que abriram conversa, {fechados} chegaram com a documentação completa.
        </p>
      </div>

      <div className="card">
        <h3>O que custa operar</h3>
        <div className="dossie-numeros">
          <Numero
            rotulo="Custo de IA por cliente fechado"
            valor={
              dossie.economia.custoIaPorClienteFechadoUsd === null
                ? '—'
                : dolares(dossie.economia.custoIaPorClienteFechadoUsd)
            }
            nota="atendimento + leitura de documentos, ponta a ponta"
            destaque
          />
          <Numero
            rotulo="Custo de IA por contato"
            valor={
              dossie.economia.custoIaPorLeadUsd === null
                ? '—'
                : dolares(dossie.economia.custoIaPorLeadUsd, 4)
            }
          />
          <Numero rotulo="Gasto de IA acumulado" valor={dolares(dossie.economia.custoIaUsd)} />
          <Numero
            rotulo="Chamadas de IA"
            valor={dossie.economia.chamadasDeIa.toLocaleString('pt-BR')}
          />
        </div>
        <p className="page-sub">
          Tokens reais medidos chamada a chamada, multiplicados pelo preço de tabela do modelo. Não
          inclui tráfego pago, equipe nem infraestrutura.
        </p>
      </div>

      <div className="card">
        <h3>Velocidade da máquina</h3>
        <div className="dossie-numeros">
          <Numero
            rotulo="Do primeiro contato ao dossiê"
            valor={
              dossie.velocidade.diasAteParecer === null
                ? '—'
                : `${dossie.velocidade.diasAteParecer} dias`
            }
            nota="mediana"
          />
          <Numero
            rotulo="Do dossiê até o SIM"
            valor={
              dossie.velocidade.diasParaConfirmar === null
                ? '—'
                : `${dossie.velocidade.diasParaConfirmar} dias`
            }
            nota="mediana"
          />
        </div>
      </div>

      <div className="card">
        <h3>A carteira</h3>
        <div className="dossie-numeros">
          <Numero
            rotulo="Potencial confirmado"
            valor={reais(dossie.carteira.potencialConfirmado)}
            nota={`${dossie.carteira.clientesFechados} cliente(s) com documentação completa`}
            destaque
          />
          <Numero
            rotulo="Potencial mediano por cliente"
            valor={
              dossie.carteira.potencialMedianoPorClienteFechado === null
                ? '—'
                : reais(dossie.carteira.potencialMedianoPorClienteFechado)
            }
          />
          <Numero
            rotulo="Contratos analisados"
            valor={dossie.carteira.contratosAnalisados.toLocaleString('pt-BR')}
            nota={`em ${dossie.carteira.clientesComContrato} cliente(s)`}
          />
        </div>
        {dossie.carteira.ufs.length > 0 ? (
          <p className="page-sub">
            Cobertura:{' '}
            {dossie.carteira.ufs.map((u) => `${u.uf} (${String(u.clientes)})`).join(' · ')}
          </p>
        ) : null}
      </div>

      {dossie.coortes.length > 0 ? (
        <div className="card">
          <h3>Mês a mês, pela entrada do contato</h3>
          <p className="page-sub">
            Cada linha segue as pessoas que <em>chegaram</em> naquele mês até onde elas estão hoje —
            é assim que se vê a máquina melhorando (ou não).
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Contatos</th>
                  <th>Fase 1</th>
                  <th>Confirmaram</th>
                  <th>Documentação completa</th>
                </tr>
              </thead>
              <tbody>
                {dossie.coortes.map((c) => (
                  <tr key={c.mes}>
                    <td>{mesLegivel(c.mes)}</td>
                    <td>{c.leads}</td>
                    <td>{c.fase1}</td>
                    <td>{c.confirmados}</td>
                    <td>{c.fechados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h3>De onde vem cada número</h3>
        <ul className="dossie-fontes">
          {dossie.fontes.map((f) => (
            <li key={f.bloco}>
              <strong>{f.bloco}:</strong> {f.origem}
            </li>
          ))}
        </ul>
        <p className="page-sub">
          Relatório gerado em {new Date(dossie.geradoEm).toLocaleString('pt-BR')}. Nenhum nome, CPF
          ou telefone de cliente aparece aqui — a base é dado pessoal e não circula em negociação.
        </p>
      </div>
    </div>
  );
}
