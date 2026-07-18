import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import EntriesTable from '../../../components/entries-table';
import { getJson, type JuridicalEntry } from '../../../lib/api';

const MovimentacoesPage = async (): Promise<ReactElement> => {
  const entries = await getJson<JuridicalEntry[]>('/advogado/movimentacoes');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Movimentações</h1>
      <p className="page-sub">Movimentações registradas por você.</p>
      <EntriesTable entries={entries} emptyText="Nenhuma movimentação registrada." />
    </>
  );
};

export default MovimentacoesPage;
