import type { ReactElement } from 'react';
import AutoRefresh from '../../components/auto-refresh';
import EntriesTable from '../../components/entries-table';
import { getJson, type JuridicalEntry } from '../../lib/api';

const ProtocolosPage = async (): Promise<ReactElement> => {
  const entries = await getJson<JuridicalEntry[]>('/advogado/protocolos');
  return (
    <>
      <AutoRefresh seconds={8} />
      <h1 className="page-title">Protocolos</h1>
      <p className="page-sub">Protocolos registrados por você.</p>
      <EntriesTable entries={entries} emptyText="Nenhum protocolo registrado." />
    </>
  );
};

export default ProtocolosPage;
