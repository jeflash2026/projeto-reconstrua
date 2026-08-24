// AUDITORIA DE ABATES (2026-08-24) — todos os clientes já entregues, conferidos
// contra a régua ATUAL do guia (pós-correções de migração e RMC/RCC).
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import AuditoriaAbates, { type Auditoria } from '../../../components/auditoria-abates';

export const dynamic = 'force-dynamic';

const AuditoriaPage = async (): Promise<ReactElement> => {
  // Relê o HISCON de cada cliente abatido — pode demorar; a página espera.
  const auditoria = await getJson<Auditoria>('/admin/creditos-advogado/auditoria');
  return (
    <>
      <h1 className="page-title">Auditoria de abates</h1>
      <p className="page-sub">
        Cada cliente já entregue a um advogado, com o que foi abatido × o que a régua atual do guia
        diz (o HISCON é relido na hora, já com migração e RMC/RCC). O ajuste lança só a diferença —
        complemento ou estorno parcial — com o motivo gravado no extrato do advogado.
      </p>
      {auditoria === null ? (
        <div className="error-box">API indisponível (ou ainda sem o deploy desta versão).</div>
      ) : (
        <AuditoriaAbates auditoria={auditoria} />
      )}
    </>
  );
};

export default AuditoriaPage;
