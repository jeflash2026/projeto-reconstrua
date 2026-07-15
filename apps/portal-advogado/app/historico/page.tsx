import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import EntriesTable from '../../components/entries-table';
import { getJson, type JuridicalEntry } from '../../lib/api';

const HistoricoPage = async (): Promise<ReactElement> => {
  const entries = await getJson<JuridicalEntry[]>('/advogado/historico');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Histórico</h1>
      <p className="page-sub">Todo o seu trabalho jurídico, em ordem.</p>
      <EntriesTable entries={entries} emptyText="Nenhum registro ainda." />
    </>
  );
};

export default HistoricoPage;
