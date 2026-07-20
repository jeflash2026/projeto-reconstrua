// Decreto Tráfego Pago — CLIENTES PRONTOS P/ ADVOGADO: cadastro completo +
// pedido administrativo confirmado pelo perito (prazo de 10 dias em curso ou
// resposta do banco). O administrador escolhe o advogado; a AHRI avisa o
// advogado no número cadastrado por ele e o cliente aparece no painel dele.
import type { ReactElement } from 'react';
import { listarClientesProntos } from '../../../lib/actions';
import AtribuirAdvogado from '../../../components/atribuir-advogado';

export const dynamic = 'force-dynamic';

const ClientesProntosPage = async (): Promise<ReactElement> => {
  const dados = await listarClientesProntos();
  return (
    <>
      <h1 className="page-title">Clientes prontos p/ Advogado</h1>
      <p className="page-sub">
        Cadastro completo e pedido administrativo em curso — escolha quem vai representar cada cliente.
        A AHRI avisa o advogado no WhatsApp cadastrado por ele.
      </p>
      {dados === null ? (
        <div className="card empty">Integração com o Portal do Advogado indisponível (ADVOGADO_API_URL).</div>
      ) : dados.prontos.length === 0 ? (
        <div className="card empty">Nenhum cliente aguardando advogado agora — quando o perito confirmar os pedidos administrativos, eles aparecem aqui.</div>
      ) : (
        <AtribuirAdvogado prontos={dados.prontos} advogados={dados.advogados} />
      )}
    </>
  );
};

export default ClientesProntosPage;
