// PAINEL DO SÓCIO (Decreto 2026-07-23) — o sócio autenticado (CPF na sessão) vê
// APENAS o próprio rateio: participação, quanto lhe cabe hoje do potencial
// recuperável e o rateio de referência (cliente 60% · advogado sócio 20% · AHRI
// 20%). Base = a MESMA carteira do Financeiro do Admin. Nada aqui escreve.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { getJson, formatMoney, type PainelSocioView } from '../lib/api';
import { socioDaSessao, SOCIO_SESSION_COOKIE } from '../lib/session';
import { SairButton } from '../components/sair-button';

export const dynamic = 'force-dynamic';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

function formatarCpf(bruto: string): string {
  const so = bruto.replace(/\D/g, '');
  if (so.length !== 11) return bruto;
  return `${so.slice(0, 3)}.${so.slice(3, 6)}.${so.slice(6, 9)}-${so.slice(9)}`;
}

const PainelSocio = async (): Promise<ReactElement> => {
  const cookie = cookies().get(SOCIO_SESSION_COOKIE)?.value ?? '';
  const cpf = socioDaSessao(SEGREDO_SESSAO, cookie);
  if (cpf === null) redirect('/login');

  const painel = await getJson<PainelSocioView>(`/admin/socio/painel/${cpf}`);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Painel do Sócio</h1>
        <SairButton />
      </div>

      {painel === null ? (
        <div className="card">
          <div className="error-box">
            Não foi possível carregar a sua participação agora. Tente novamente em instantes ou fale
            com o administrador.
          </div>
        </div>
      ) : (
        <>
          <p className="page-sub">
            Olá, {painel.nome} — CPF {formatarCpf(painel.cpf)}. Sua participação é de{' '}
            <strong>{painel.percentual}</strong> do potencial recuperável da carteira.
          </p>

          <div className="grid stats" style={{ marginBottom: 16 }}>
            <div className="card stat">
              <div className="value">{formatMoney(painel.meuValor)}</div>
              <div className="label">O que lhe cabe hoje ({painel.percentual})</div>
            </div>
            <div className="card stat">
              <div className="value">{formatMoney(painel.potencialTotal)}</div>
              <div className="label">Potencial recuperável total (100%)</div>
            </div>
            <div className="card stat">
              <div className="value">{painel.clientes}</div>
              <div className="label">Clientes na base</div>
            </div>
          </div>

          <div className="card">
            <h3>Como o resultado é dividido</h3>
            <p className="page-sub" style={{ marginTop: 0 }}>
              Rateio de referência sobre o potencial recuperável total da carteira hoje.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parte</th>
                    <th>Percentual</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {painel.rateioReferencia.map((f) => (
                    <tr key={f.rotulo}>
                      <td style={{ fontWeight: 600 }}>{f.rotulo}</td>
                      <td>{f.percentual}</td>
                      <td>{formatMoney(f.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="page-sub" style={{ marginTop: 12 }}>
              A fatia da AHRI (empresa) é dividida entre os sócios. A sua parte é{' '}
              <strong>{painel.percentual}</strong> do total, equivalente a{' '}
              <strong>{formatMoney(painel.meuValor)}</strong> hoje. Os valores acompanham a carteira
              e mudam conforme novos HISCON entram.
            </p>
          </div>
        </>
      )}
    </main>
  );
};

export default PainelSocio;
