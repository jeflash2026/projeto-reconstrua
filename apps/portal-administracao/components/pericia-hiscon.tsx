// PERÍCIA — o HISCON parseado (Decreto Dossiê Pericial 2026-07-21): contratos
// por banco (janela de 5 anos), MIGRADOS destacados (sem pedido administrativo —
// destinação MANUAL do admin a advogado) e indícios de estratégia para o perito.
import type { ReactElement } from 'react';
import { getJson, type DossiePericialView, type ContratoHisconView } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';

const Contrato = ({ c }: { c: ContratoHisconView }): ReactElement => (
  <tr>
    <td className="mono">{c.contrato}</td>
    <td>
      <span className={`badge ${c.migrado ? 'warn' : 'dim'}`}>
        {c.migrado ? 'MIGRADO' : c.modalidade}
      </span>
    </td>
    <td>{c.situacao ?? '—'}</td>
    <td className="mono">{formatDate(c.dataInclusao)}</td>
    <td>{c.qtdeParcelas ?? '—'}</td>
    <td>{formatMoney(c.valorParcela)}</td>
    <td>{formatMoney(c.valorEmprestado)}</td>
    <td>{c.taxaJurosMensal !== null ? `${String(c.taxaJurosMensal)}% a.m.` : '—'}</td>
    <td style={{ whiteSpace: 'normal', fontSize: 12 }}>{c.origemAverbacao ?? '—'}</td>
  </tr>
);

const TabelaContratos = ({ contratos }: { contratos: ContratoHisconView[] }): ReactElement => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Contrato</th>
          <th>Tipo</th>
          <th>Situação</th>
          <th>Inclusão</th>
          <th>Parcelas</th>
          <th>Parcela</th>
          <th>Emprestado</th>
          <th>Juros</th>
          <th>Origem da averbação</th>
        </tr>
      </thead>
      <tbody>
        {contratos.map((c) => (
          <Contrato key={c.contrato} c={c} />
        ))}
      </tbody>
    </table>
  </div>
);

const PericiaHiscon = async ({ chatId }: { chatId: string }): Promise<ReactElement> => {
  const dossie = await getJson<DossiePericialView>(`/admin/pericia/${encodeURIComponent(chatId)}`);
  if (!dossie) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Perícia — contratos do HISCON</h3>
        <div className="empty">HISCON ainda não recebido ou não legível para este cliente.</div>
      </div>
    );
  }
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Perícia — contratos do HISCON (últimos {dossie.janelaAnos} anos)</h3>
      <dl className="kv">
        <dt>Beneficiário</dt>
        <dd>{dossie.beneficio.beneficiario ?? '—'}</dd>
        <dt>Nº Benefício</dt>
        <dd className="mono">{dossie.beneficio.numeroBeneficio ?? '—'}</dd>
        <dt>Pago em</dt>
        <dd>{dossie.beneficio.bancoPagamento ?? '—'}</dd>
        <dt>Comprometido / máximo</dt>
        <dd>
          {formatMoney(dossie.margens.totalComprometido)} /{' '}
          {formatMoney(dossie.margens.maximoComprometimento)}
        </dd>
        <dt>Contratos na janela</dt>
        <dd>
          {dossie.totalContratos} — {dossie.filaPedidoAdministrativo.length} p/ pedido
          administrativo, {dossie.migrados.length} migrado(s)
        </dd>
      </dl>

      {dossie.indicios.length > 0 ? (
        <>
          <h4 style={{ marginBottom: 4 }}>
            Indícios de estratégia (sinal para o perito — nunca conclusão)
          </h4>
          <ul style={{ marginTop: 0 }}>
            {dossie.indicios.map((i) => (
              <li key={i.estrategiaRef}>
                <span className="mono">{i.estrategiaRef}</span> — {i.titulo}
                <span style={{ color: 'var(--text-dim)' }}> · {i.fundamentoFactual}</span>
                {i.contratos.length > 0 ? (
                  <span className="mono"> · contratos: {i.contratos.join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {dossie.migrados.length > 0 ? (
        <>
          <h4 style={{ marginBottom: 4 }}>
            Contratos MIGRADOS — sem pedido administrativo (destinação direta a advogado, decisão do
            admin)
          </h4>
          {/* O MAPA da migração: DE contrato/banco de origem → PARA o atual. */}
          <ul style={{ marginTop: 0 }}>
            {dossie.migracoes.map((m) => (
              <li key={m.paraContrato}>
                <span className="mono">{m.deContrato ?? 'contrato de origem não informado'}</span>
                {m.deBancoCodigo ? (
                  <span>
                    {' '}
                    @ {m.deBancoNome ?? 'banco'} <span className="mono">({m.deBancoCodigo})</span>
                  </span>
                ) : null}{' '}
                → <span className="mono">{m.paraContrato}</span> @{' '}
                {m.paraBancoNome ?? 'banco atual'}{' '}
                {m.paraBancoCodigo ? <span className="mono">({m.paraBancoCodigo})</span> : null}
              </li>
            ))}
          </ul>
          <TabelaContratos contratos={dossie.migrados} />
        </>
      ) : null}

      {dossie.porBanco.map((b) => (
        <div key={b.bancoNome} style={{ marginTop: 12 }}>
          <h4 style={{ marginBottom: 4 }}>
            {b.bancoNome} {b.bancoCodigo ? <span className="mono">({b.bancoCodigo})</span> : null} —{' '}
            {b.contratos.length} contrato(s)
          </h4>
          <TabelaContratos contratos={b.contratos} />
        </div>
      ))}
    </div>
  );
};

export default PericiaHiscon;
