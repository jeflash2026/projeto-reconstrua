// DOSSIÊ DE INVESTIDOR (2026-08-12) — os números que um comprador de participação
// pede, calculados do banco real. Nenhum dado pessoal: o relatório sai da
// empresa, a base do cliente não.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import DossieInvestidor, { type Dossie } from '../../../components/dossie-investidor';

export const dynamic = 'force-dynamic';

const DossiePage = async (): Promise<ReactElement> => {
  const dossie = await getJson<Dossie>('/admin/dossie-investidor');
  return (
    <>
      <h1 className="page-title">Dossiê de Investidor</h1>
      <p className="page-sub">
        O funil real da operação, o custo de IA por cliente fechado e o potencial da carteira — tudo
        derivado do banco, sem estimativa. É o material de uma conversa com sócio-investidor ou
        comprador estratégico. Confira os números antes de mandar para alguém.
      </p>
      {dossie === null ? (
        <div className="error-box">API indisponível (ou ainda sem o deploy desta versão).</div>
      ) : (
        <DossieInvestidor dossie={dossie} />
      )}
    </>
  );
};

export default DossiePage;
