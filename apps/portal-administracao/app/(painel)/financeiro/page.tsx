// FINANCEIRO v2 (pedido do dono, 2026-08-06) — o FUNIL do dinheiro em cards:
// potencial total → em mesa coletando assinatura → assinatura coletada →
// encaminhado aos advogados; o raio-x POR ADVOGADO (clientes, potencial,
// carteira de contratos) e o potencial por cliente. Decreto 2026-07-21 segue
// valendo: POTENCIAL = o JÁ descontado nos HISCONs — nada é inventado.
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
  potencialRecuperacao: { total: number; porCliente: PotencialCliente[] } | null;
}

interface Fatia {
  clientes: number;
  potencial: number;
}

interface AdvogadoFinanceiro {
  id: string;
  nome: string;
  clientesEncaminhados: number;
  potencialEncaminhado: number;
  marcadosNaMesa: number;
  potencialMarcado: number;
  contratosComprados: number;
  contratosAbatidos: number;
  saldoContratos: number;
}

interface PainelFinanceiro {
  emColeta: Fatia;
  assinaturaColetada: Fatia;
  encaminhado: Fatia;
  porAdvogado: AdvogadoFinanceiro[];
}

const CardFatia = ({
  rotulo,
  fatia,
  dica,
  destaque = false,
}: {
  rotulo: string;
  fatia: Fatia | null;
  dica: string;
  destaque?: boolean;
}): ReactElement => (
  <div className="card stat" title={dica}>
    <div
      className={`value${fatia === null ? ' na' : ''}`}
      style={destaque ? { color: 'var(--ok, #3fae5f)' } : undefined}
    >
      {formatMoney(fatia?.potencial ?? null)}
    </div>
    <div className="label">{rotulo}</div>
    {fatia !== null ? (
      <div className="page-sub" style={{ marginTop: 2 }}>
        {fatia.clientes} cliente(s)
      </div>
    ) : null}
  </div>
);

const FinanceiroPage = async (): Promise<ReactElement> => {
  const [data, painel] = await Promise.all([
    getJson<FinanceData>('/admin/finance'),
    getJson<PainelFinanceiro>('/admin/financeiro/painel'),
  ]);
  const potencial = data?.potencialRecuperacao ?? null;
  return (
    <>
      <AutoRefresh seconds={60} />
      <h1 className="page-title">Financeiro</h1>
      <p className="page-sub">
        O funil do dinheiro: potencial total (o já descontado nos HISCONs) → em coleta de assinatura
        na mesa → assinatura coletada → encaminhado aos advogados parceiros.
      </p>
      {!data && !painel ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <>
          {/* ── O FUNIL EM CARDS ─────────────────────────────────────────── */}
          <div className="grid stats" style={{ marginBottom: 16 }}>
            <div className="card stat">
              <div className={`value${potencial === null ? ' na' : ''}`}>
                {formatMoney(potencial?.total ?? null)}
              </div>
              <div className="label">Potencial total</div>
              {potencial !== null ? (
                <div className="page-sub" style={{ marginTop: 2 }}>
                  {potencial.porCliente.length} cliente(s) com HISCON
                </div>
              ) : null}
            </div>
            <CardFatia
              rotulo="Em mesa — coletando assinatura"
              fatia={painel?.emColeta ?? null}
              dica="Clientes confirmados na mesa do humanizado, ainda sem a documentação completa"
            />
            <CardFatia
              rotulo="Assinatura coletada"
              fatia={painel?.assinaturaColetada ?? null}
              dica="Documentação completa (procuração assinada + RG + comprovante + extrato)"
              destaque
            />
            <CardFatia
              rotulo="Encaminhado aos advogados"
              fatia={painel?.encaminhado ?? null}
              dica="Clientes já destinados a um advogado parceiro"
              destaque
            />
          </div>

          {/* ── POR ADVOGADO ─────────────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Por advogado parceiro</h3>
            <p className="page-sub">
              O que cada parceiro tem em mãos (encaminhados), o que está reservado para ele na mesa
              (marcados pela secretária) e a carteira de contratos (comprados − abatidos = saldo).
            </p>
            {painel === null || painel.porAdvogado.length === 0 ? (
              <div className="empty">Nenhum advogado parceiro ativo ainda.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Advogado</th>
                      <th>Encaminhados</th>
                      <th>Potencial encaminhado</th>
                      <th>Marcados na mesa</th>
                      <th>Potencial marcado</th>
                      <th>Contratos (comprados / abatidos / saldo)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {painel.porAdvogado.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.nome}</td>
                        <td>{a.clientesEncaminhados}</td>
                        <td className="mono">
                          <strong>{formatMoney(a.potencialEncaminhado)}</strong>
                        </td>
                        <td>{a.marcadosNaMesa}</td>
                        <td className="mono">{formatMoney(a.potencialMarcado)}</td>
                        <td className="mono">
                          {a.contratosComprados} / {a.contratosAbatidos} /{' '}
                          <strong
                            style={
                              a.saldoContratos < 0 ? { color: 'var(--bad, #d05050)' } : undefined
                            }
                          >
                            {a.saldoContratos}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── POR CLIENTE (a tabela de sempre) ─────────────────────────── */}
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
        </>
      )}
    </>
  );
};

export default FinanceiroPage;
