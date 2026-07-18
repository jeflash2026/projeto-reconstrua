import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import EntriesTable from '../../../components/entries-table';
import { getJson, type JuridicalEntry } from '../../../lib/api';

const AgendaPage = async (): Promise<ReactElement> => {
  const entries = await getJson<JuridicalEntry[]>('/advogado/agenda');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Agenda</h1>
      <p className="page-sub">Seus prazos, em ordem de vencimento.</p>
      <EntriesTable entries={entries} emptyText="Nenhum prazo agendado." />
    </>
  );
};

export default AgendaPage;
