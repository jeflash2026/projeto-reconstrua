// CONEXÃO WHATSAPP — tela do Portal Admin para gerenciar a instância Evolution de
// produção (verificar, criar, ler QR, confirmar com o número oficial). Server
// Component fino: a interação em tempo real fica no componente cliente.
import type { ReactElement } from 'react';
import WhatsAppConnection from '../../components/whatsapp-connection';

const ConexaoWhatsAppPage = (): ReactElement => (
  <>
    <h1 className="page-title">Conexão WhatsApp</h1>
    <p className="page-sub">
      Gerencie a instância Evolution de produção sem depender do painel da Evolution. A instância só
      é ativada quando o QR é lido com o número oficial <strong>+55 41 3798-9737</strong>.
    </p>
    <WhatsAppConnection />
  </>
);

export default ConexaoWhatsAppPage;
