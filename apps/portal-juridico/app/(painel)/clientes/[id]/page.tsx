// DETALHE do cliente — dados civis, anexos (upload) e contratos por processo.
import type { ReactElement } from 'react';
import {
  getJson,
  moeda,
  dataBr,
  type ClienteJuridico,
  type ContratoJuridico,
} from '../../../../lib/api';
import AnexosBox from '../../../../components/anexos-box';

export const dynamic = 'force-dynamic';

const Linha = ({ rotulo, valor }: { rotulo: string; valor: string }): ReactElement => (
  <div>
    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-dim)' }}>{rotulo}</div>
    <div style={{ fontWeight: 600 }}>{valor || 'Não informado'}</div>
  </div>
);

export default async function ClientePage({
  params,
}: {
  params: { id: string };
}): Promise<ReactElement> {
  const dados = await getJson<{ cliente: ClienteJuridico; contratos: ContratoJuridico[] }>(
    `/admin/juridico/clientes/${encodeURIComponent(params.id)}`,
  );
  if (dados === null) {
    return <div className="erro-box">Cliente não encontrado (ou API indisponível).</div>;
  }
  const { cliente, contratos } = dados;
  const endereco = [
    [cliente.endereco.logradouro, cliente.endereco.numero].filter(Boolean).join(' '),
    cliente.endereco.bairro,
    cliente.endereco.cidade && `${cliente.endereco.cidade}, ${cliente.endereco.uf}`,
    cliente.endereco.cep && `CEP ${cliente.endereco.cep}`,
  ]
    .filter(Boolean)
    .join(' · ');

  // Contratos agrupados por PROCESSO (como no original).
  const porProcesso = new Map<string, ContratoJuridico[]>();
  for (const c of contratos) {
    porProcesso.set(c.processoNumero, [...(porProcesso.get(c.processoNumero) ?? []), c]);
  }

  return (
    <>
      <h1 className="titulo">{cliente.nome}</h1>
      <p className="subtitulo">
        Cadastrado em {dataBr(cliente.em)} por {cliente.criadoPor}
      </p>
      <div className="acoes-topo">
        <a className="btn primario" href={`/juridico/processos/novo?cliente=${cliente.id}`}>
          Novo processo
        </a>
        <a className="btn" href={`/juridico/clientes/${cliente.id}/editar`}>
          Editar cliente
        </a>
      </div>

      <div className="secao-form">
        <h3>Dados do cliente</h3>
        <div className="form-grade">
          <Linha rotulo="Data de nascimento" valor={dataBr(cliente.nascimento || null)} />
          <Linha rotulo="CPF/CNPJ" valor={cliente.cpfCnpj} />
          <Linha rotulo="RG" valor={cliente.rg} />
          <Linha rotulo="Órgão emissor" valor={cliente.orgaoEmissor} />
          <Linha rotulo="UF emissão" valor={cliente.ufEmissao} />
          <Linha rotulo="Sexo" valor={cliente.sexo} />
          <Linha rotulo="E-mail" valor={cliente.email} />
          <Linha rotulo="Telefone" valor={cliente.telefone} />
          <Linha rotulo="Celular 1" valor={cliente.celular1} />
          <Linha rotulo="Celular 2" valor={cliente.celular2} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Linha rotulo="Endereço" valor={endereco} />
        </div>
        {cliente.observacoes !== '' ? (
          <div style={{ marginTop: 12 }}>
            <Linha rotulo="Observações" valor={cliente.observacoes} />
          </div>
        ) : null}
      </div>

      <AnexosBox
        titulo="Anexos"
        anexos={cliente.anexos}
        destino={`/juridico/api/j/clientes/${cliente.id}/anexo`}
        baseDownload={`/juridico/api/j/clientes/${cliente.id}/anexo`}
      />

      <h2 style={{ fontSize: '1.05rem' }}>Processos e contratos</h2>
      {porProcesso.size === 0 ? (
        <div className="vazio">Nenhum processo cadastrado para este cliente.</div>
      ) : (
        [...porProcesso.entries()].map(([processo, lista]) => (
          <div className="secao-form" key={processo}>
            <h3 className="mono" style={{ textTransform: 'none', fontSize: 14 }}>
              {processo} — {lista.length} contrato(s)
            </h3>
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
                  {lista.map((c) => (
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
        ))
      )}
    </>
  );
}
