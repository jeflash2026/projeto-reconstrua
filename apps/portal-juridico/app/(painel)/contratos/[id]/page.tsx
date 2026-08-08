// DETALHE do contrato — dados, encerrar/excluir, anexos e histórico auditado.
import type { ReactElement } from 'react';
import { getJson, moeda, dataBr, type ContratoJuridico } from '../../../../lib/api';
import AnexosBox from '../../../../components/anexos-box';
import ContratoAcoes from '../../../../components/contrato-acoes';

export const dynamic = 'force-dynamic';

const Linha = ({ rotulo, valor }: { rotulo: string; valor: string }): ReactElement => (
  <div>
    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-dim)' }}>{rotulo}</div>
    <div style={{ fontWeight: 600 }}>{valor || 'Não informado'}</div>
  </div>
);

export default async function ContratoPage({
  params,
}: {
  params: { id: string };
}): Promise<ReactElement> {
  const dados = await getJson<{ contrato: ContratoJuridico; clienteNome: string }>(
    `/admin/juridico/contratos/${encodeURIComponent(params.id)}`,
  );
  if (dados === null) return <div className="erro-box">Contrato não encontrado.</div>;
  const { contrato, clienteNome } = dados;

  return (
    <>
      <h1 className="titulo mono" style={{ fontSize: '1.25rem' }}>
        {contrato.processoNumero}{' '}
        <span className={`selo-status ${contrato.status}`}>{contrato.status}</span>
      </h1>
      <p className="subtitulo">
        {clienteNome} · {contrato.banco}
      </p>
      <div className="acoes-topo">
        <a className="btn" href={`/juridico/clientes/${contrato.clienteId}`}>
          Cliente
        </a>
      </div>

      <div className="secao-form">
        <h3>Dados do contrato</h3>
        <div className="form-grade">
          <Linha rotulo="Cliente" valor={clienteNome} />
          <Linha rotulo="Banco" valor={contrato.banco} />
          <Linha rotulo="Contrato" valor={contrato.numero} />
          <Linha rotulo="Valor" valor={moeda(contrato.valor)} />
          <Linha rotulo="Assinatura" valor={dataBr(contrato.assinatura)} />
          <Linha rotulo="Início" valor={dataBr(contrato.inicio)} />
          <Linha rotulo="Fim previsto" valor={dataBr(contrato.fimPrevisto)} />
          <Linha rotulo="Última alteração" valor={dataBr(contrato.atualizadoEm)} />
        </div>
        {contrato.encerramento !== null ? (
          <div className="ok-box" style={{ marginTop: 12 }}>
            Encerrado em {dataBr(contrato.encerramento.data)}
            {contrato.encerramento.motivo ? ` — ${contrato.encerramento.motivo}` : ''}
          </div>
        ) : null}
        {contrato.exclusao !== null ? (
          <div className="erro-box" style={{ marginTop: 12 }}>
            Movido para excluídos em {dataBr(contrato.exclusao.em)}
            {contrato.exclusao.motivo ? ` — ${contrato.exclusao.motivo}` : ''}
          </div>
        ) : null}
        {contrato.observacoes !== '' ? (
          <div style={{ marginTop: 12 }}>
            <Linha rotulo="Observações" valor={contrato.observacoes} />
          </div>
        ) : null}
      </div>

      <ContratoAcoes contratoId={contrato.id} status={contrato.status} />

      <AnexosBox
        titulo="Anexos"
        anexos={contrato.anexos}
        destino={`/juridico/api/j/contratos/${contrato.id}`}
        baseDownload={`/juridico/api/j/contratos/${contrato.id}/anexo`}
      />

      <div className="secao-form">
        <h3>Histórico</h3>
        {contrato.historico.map((h, i) => (
          <div className="hist-item" key={i}>
            <div style={{ fontWeight: 600 }}>{h.texto}</div>
            <div className="hist-meta">
              {h.autor} · {dataBr(h.em)}{' '}
              {new Date(h.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
