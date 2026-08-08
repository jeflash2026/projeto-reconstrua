// MOVIMENTAÇÕES (2026-08-08) — a caixa de entrada judicial: todo processo que
// se mexeu (qualquer ato) espera o visto do advogado; o DataJud alimenta a
// fila sozinho a cada 6 horas.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import MovimentacoesFila, { type ItemFila } from '../../../components/movimentacoes-fila';

export const dynamic = 'force-dynamic';

export default async function MovimentacoesPage(): Promise<ReactElement> {
  const dados = await getJson<{ fila: ItemFila[] }>('/admin/juridico/movimentacoes');
  return (
    <>
      <h1 className="titulo">Movimentações</h1>
      <p className="subtitulo">
        Todo processo que se movimentou entra aqui e espera o seu visto — qualquer ato conta. O
        acompanhamento é automático (DataJud, a cada 6 horas).
      </p>
      {dados === null ? (
        <div className="erro-box">API indisponível.</div>
      ) : (
        <MovimentacoesFila fila={dados.fila} />
      )}
    </>
  );
}
