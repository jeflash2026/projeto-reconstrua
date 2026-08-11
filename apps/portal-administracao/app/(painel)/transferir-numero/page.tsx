// TRANSFERÊNCIA DE NÚMERO (2026-08-11) — o cliente trocou de chip e quer
// continuar o MESMO atendimento pelo número novo (caso Maria da Piedade Roza).
import type { ReactElement } from 'react';
import TransferenciaNumero from '../../../components/transferencia-numero';

export const dynamic = 'force-dynamic';

const TransferirNumeroPage = (): ReactElement => (
  <>
    <h1 className="page-title">Transferir atendimento de número</h1>
    <p className="page-sub">
      Quando o cliente troca de chip ou de aparelho, o atendimento inteiro muda de número: conversa,
      CPF, HISCON, documentos, confirmação e cadastro. Sem isso a AHRI trata o número novo como uma
      pessoa nova e pede tudo de novo — e a mesa do Humanizado mostra dois cadastros da mesma
      pessoa. Nenhuma mensagem é enviada ao cliente.
    </p>
    <TransferenciaNumero />
  </>
);

export default TransferirNumeroPage;
