import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import EntriesTable from '../../../components/entries-table';
import { getJson, type JuridicalEntry } from '../../../lib/api';

const PendenciasPage = async (): Promise<ReactElement> => {
  const entries = await getJson<JuridicalEntry[]>('/advogado/pendencias');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Pendências</h1>
      <p className="page-sub">Prazos e protocolos ainda abertos — somente os seus.</p>
      <EntriesTable entries={entries} emptyText="Nenhuma pendência aberta." />
    </>
  );
};

export default PendenciasPage;
