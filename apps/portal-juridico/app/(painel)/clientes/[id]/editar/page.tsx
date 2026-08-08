import type { ReactElement } from 'react';
import { getJson, type ClienteJuridico, type ContratoJuridico } from '../../../../../lib/api';
import ClienteForm from '../../../../../components/cliente-form';

export const dynamic = 'force-dynamic';

export default async function EditarClientePage({
  params,
}: {
  params: { id: string };
}): Promise<ReactElement> {
  const dados = await getJson<{ cliente: ClienteJuridico; contratos: ContratoJuridico[] }>(
    `/admin/juridico/clientes/${encodeURIComponent(params.id)}`,
  );
  if (dados === null) return <div className="erro-box">Cliente não encontrado.</div>;
  return (
    <>
      <h1 className="titulo">Editar cliente</h1>
      <p className="subtitulo">{dados.cliente.nome}</p>
      <ClienteForm cliente={dados.cliente} />
    </>
  );
}
