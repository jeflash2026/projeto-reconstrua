// FINANCEIRO — Decreto 2026-07-21: POTENCIAL DE RECUPERAÇÃO = o que cada
// cliente JÁ pagou de parcelas consignadas até hoje, contrato a contrato do
// HISCON (parcelas decorridas da competência de início até a atual × valor da
// parcela). É o teto do que pode ser objeto de restituição; a procedência é
// análise do perito/advogado. Nada é inventado: sem HISCON legível, sem valor.
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { getJson } from '../../../lib/api';
import { formatMoney } from '../../../lib/format';

interface PotencialCliente {
  chatId: string;
  nomeCliente: string | null;
  valor: number;
  contratos: number;
  contratosSemValor: number;
}

interface FinanceData {
  financialUnderAdministration: number | null;
  expectedFees: number | null;
  available: boolean;
  potencialRecuperacao: { total: number; porCliente: PotencialCliente[] } | null;
}

const FinanceiroPage = async (): Promise<ReactElement> => {
  const data = await getJson<FinanceData>('/admin/finance');
  const potencial = data?.potencialRecuperacao ?? null;
  return (
    <>
      <AutoRefresh seconds={60} />
      <h1 className="page-title">Financeiro</h1>
      <p className="page-sub">
        Potencial de recuperação (o já descontado nos HISCONs), valores sob administração e
        honorários previstos.
      </p>
      {!data ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <>
          <div className="grid stats" style={{ marginBottom: 16 }}>
            <div className="card stat">
              <div className={`value${potencial === null ? ' na' : ''}`}>
                {formatMoney(potencial?.total ?? null)}
              </div>
              <div className="label">Potencial de recuperação</div>
            </div>
            <div className="card stat">
              <div className={`value${data.financialUnderAdministration === null ? ' na' : ''}`}>
                {formatMoney(data.financialUnderAdministration)}
              </div>
              <div className="label">Valor administrado</div>
            </div>
            <div className="card stat">
              <div className={`value${data.expectedFees === null ? ' na' : ''}`}>
                {formatMoney(data.expectedFees)}
              </div>
              <div className="label">Honorários previstos</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Potencial de recuperação por cliente</h3>
            <p className="page-sub">
              Soma das parcelas já descontadas (competência de início → hoje, limitada ao fim do
              contrato) × valor da parcela, de todos os contratos do HISCON do benefício.
            </p>
            {potencial === null || potencial.porCliente.length === 0 ? (
              <div className="empty">
                Nenhum HISCON legível ainda — o valor aparece quando o extrato do cliente é lido.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Potencial (já descontado)</th>
                      <th>Contratos no HISCON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {potencial.porCliente.map((c) => (
                      <tr key={c.chatId}>
                        <td>
                          <Link
                            href={`/clientes/${encodeURIComponent(c.chatId)}`}
                            style={{ color: 'var(--accent)' }}
                          >
                            {c.nomeCliente ?? c.chatId}
                          </Link>
                        </td>
                        <td className="mono">
                          <strong>{formatMoney(c.valor)}</strong>
                          {c.contratosSemValor > 0 ? (
                            <span className="page-sub">
                              {' '}
                              (+{c.contratosSemValor} contrato(s) sem valor de parcela legível)
                            </span>
                          ) : null}
                        </td>
                        <td>{c.contratos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!data.available ? (
            <div className="card empty">
              «Valor administrado» e «honorários previstos» serão preenchidos quando a fonte oficial
              (valor de causa / contrato de honorários) existir como Regra Operacional aprovada.
            </div>
          ) : null}
        </>
      )}
    </>
  );
};

export default FinanceiroPage;
