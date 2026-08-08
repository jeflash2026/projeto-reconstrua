import type { ReactElement } from 'react';
import { getJson, type PericiaJuridica } from '../../../lib/api';
import PericiasPainel from '../../../components/pericias-painel';

export const dynamic = 'force-dynamic';

export default async function PericiasPage(): Promise<ReactElement> {
  const dados = await getJson<{ pericias: PericiaJuridica[] }>('/admin/juridico/pericias');
  return (
    <>
      <h1 className="titulo">Perícias</h1>
      <p className="subtitulo">Agenda de perícias judiciais, ordenada pela data.</p>
      {dados === null ? (
        <div className="erro-box">API indisponível.</div>
      ) : (
        <PericiasPainel pericias={dados.pericias} />
      )}
    </>
  );
}
