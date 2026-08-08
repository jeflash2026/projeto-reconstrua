import type { ReactElement } from 'react';
import { getJson, type ClienteJuridico } from '../../../../lib/api';
import ProcessoForm from '../../../../components/processo-form';

export const dynamic = 'force-dynamic';

export default async function NovoProcessoPage({
  searchParams,
}: {
  searchParams: { cliente?: string };
}): Promise<ReactElement> {
  const dados = await getJson<{ clientes: ClienteJuridico[] }>('/admin/juridico/clientes');
  const clientes = (dados?.clientes ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    cpfCnpj: c.cpfCnpj,
  }));
  return (
    <>
      <h1 className="titulo">Novo processo</h1>
      <p className="subtitulo">Nº CNJ do processo + os contratos de cada banco.</p>
      <ProcessoForm clientes={clientes} clienteInicial={searchParams.cliente ?? ''} />
    </>
  );
}
