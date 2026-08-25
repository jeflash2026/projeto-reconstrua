// INTEGRAÇÃO CORVO (2026-08-25) — clientes completos enviados à correspondência
// que notifica os bancos; caixa e respostas voltam por webhook.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import CorvoBancos, { type VisaoCorvo } from '../../../components/corvo-bancos';

export const dynamic = 'force-dynamic';

const CorvoPage = async (): Promise<ReactElement> => {
  const visao = await getJson<VisaoCorvo>('/admin/corvo');
  return (
    <>
      <h1 className="page-title">Bancos (Corvo)</h1>
      <p className="page-sub">
        Todo cliente com documentação completa vira um ZIP (planilha de contratos + HISCON +
        procuração + RG + comprovante) enviado automaticamente ao Corvo, que cria a caixa de e-mail
        do cliente e notifica os bancos. As respostas de cada banco chegam aqui, por cliente.
      </p>
      {visao === null ? (
        <div className="error-box">API indisponível (ou ainda sem o deploy desta versão).</div>
      ) : (
        <CorvoBancos visao={visao} />
      )}
    </>
  );
};

export default CorvoPage;
