import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import EntriesTable from '../../components/entries-table';
import { getJson, type JuridicalEntry } from '../../lib/api';

const ArquivosPage = async (): Promise<ReactElement> => {
  const entries = await getJson<JuridicalEntry[]>('/advogado/arquivos');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Arquivos</h1>
      <p className="page-sub">Documentos jurídicos anexados por você (referências preservadas).</p>
      <EntriesTable entries={entries} emptyText="Nenhum arquivo anexado." />
    </>
  );
};

export default ArquivosPage;
