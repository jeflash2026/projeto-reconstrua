// TRANSFERIR CLIENTE DE ADVOGADO (2026-08-12) — corrige um encaminhamento que
// foi para o advogado errado. Até aqui a distribuição era mão única.
import type { ReactElement } from 'react';
import TransferirAdvogado from '../../../components/transferir-advogado';

export const dynamic = 'force-dynamic';

const TransferirAdvogadoPage = (): ReactElement => (
  <>
    <h1 className="page-title">Transferir cliente de advogado</h1>
    <p className="page-sub">
      Quando um cliente foi encaminhado para o advogado errado. A troca faz três coisas de uma vez:
      o caso muda de mãos, os créditos voltam para o advogado antigo e são debitados do novo.
      Nenhuma mensagem é enviada — avisar os dois advogados é com você.
    </p>
    <TransferirAdvogado />
  </>
);

export default TransferirAdvogadoPage;
