// FINANCEIRO — valor administrado e honorários previstos (read models). Ausência
// de fonte é declarada; nada é inventado.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import { formatMoney } from '../../../lib/format';

interface FinanceData {
  financialUnderAdministration: number | null;
  expectedFees: number | null;
  available: boolean;
}

const FinanceiroPage = async (): Promise<ReactElement> => {
  const data = await getJson<FinanceData>('/admin/finance');
  return (
    <>
      <h1 className="page-title">Financeiro</h1>
      <p className="page-sub">Valores sob administração e honorários previstos.</p>
      {!data ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <>
          <div className="grid stats" style={{ marginBottom: 16 }}>
            <div className="card stat">
              <div className={`value${data.financialUnderAdministration === null ? ' na' : ''}`}>
                {formatMoney(data.financialUnderAdministration)}
              </div>
              <div className="label">Valor administrado</div>
            </div>
            <div className="card stat">
              <div className={`value${data.expectedFees === null ? ' na' : ''}`}>{formatMoney(data.expectedFees)}</div>
              <div className="label">Honorários previstos</div>
            </div>
          </div>
          {!data.available ? (
            <div className="card empty">
              O domínio congelado ainda não captura valores financeiros — os campos acima serão preenchidos quando a
              fonte oficial (valor de causa / contrato de honorários) existir como Regra Operacional aprovada.
            </div>
          ) : null}
        </>
      )}
    </>
  );
};

export default FinanceiroPage;
