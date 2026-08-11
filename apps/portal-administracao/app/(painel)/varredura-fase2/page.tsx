// VARREDURA DA FASE 2 (decreto do dono, 2026-08-11) — "ver todos que confirmou
// interesse, não só o Oracio, e já manda pra mesa humanizada".
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import VarreduraFase2, { type ResumoVarredura } from '../../../components/varredura-fase2';

export const dynamic = 'force-dynamic';

const VarreduraPage = async (): Promise<ReactElement> => {
  const resumo = await getJson<ResumoVarredura>('/admin/humanizado/varredura');
  return (
    <>
      <h1 className="page-title">Varredura da fase 2</h1>
      <p className="page-sub">
        Todo cliente que recebeu o parecer e disse SIM precisa aparecer na mesa do Atendimento
        Humanizado. Aqui você vê quem confirmou e ficou de fora — e manda todos de uma vez. Nenhuma
        mensagem é enviada ao cliente: o reparo é só de cadastro.
      </p>
      {resumo === null ? (
        <div className="error-box">API indisponível (ou ainda sem o deploy desta versão).</div>
      ) : (
        <VarreduraFase2 resumo={resumo} />
      )}
    </>
  );
};

export default VarreduraPage;
