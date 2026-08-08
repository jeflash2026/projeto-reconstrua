import type { ReactElement } from 'react';
import { getJson, type GuiaJuridica } from '../../../lib/api';
import GuiasPainel from '../../../components/guias-painel';

export const dynamic = 'force-dynamic';

export default async function GuiasPage(): Promise<ReactElement> {
  const dados = await getJson<{ guias: GuiaJuridica[]; total: number }>('/admin/juridico/guias');
  return (
    <>
      <h1 className="titulo">Guias</h1>
      <p className="subtitulo">Lançamentos financeiros por processo, com o total consolidado.</p>
      {dados === null ? (
        <div className="erro-box">API indisponível.</div>
      ) : (
        <GuiasPainel guias={dados.guias} total={dados.total} />
      )}
    </>
  );
}
