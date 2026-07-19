// DOSSIÊS JURÍDICOS (GO-LIVE 13A · seção 4) — a lista de pareceres da AHRI. Cada
// cliente tem um dossiê gerado automaticamente; abrir o cliente mostra o parecer
// no topo. Derivado de /admin/jornada/clientes (Read Model) — nada recalculado.
import type { ReactElement } from 'react';
import Link from 'next/link';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type JornadaCliente } from '../../../../lib/api';

const DossiesPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes');
  if (!data) {
    return (
      <>
        <h1 className="page-title">Dossiês Jurídicos</h1>
        <div className="error-box">API indisponível.</div>
      </>
    );
  }
  const clientes = data.clientes;
  return (
    <>
      <AutoRefresh seconds={20} />
      <h1 className="page-title">Dossiês Jurídicos</h1>
      <p className="page-sub">O parecer inicial que a AHRI produz para cada cliente. Abra um cliente para ler o dossiê completo.</p>

      {clientes.length === 0 ? (
        <div className="cc-empty">
          <div className="cc-empty-icon" aria-hidden>◷</div>
          <p>Ainda não há clientes em atendimento. Quando o primeiro chegar, a AHRI já começa o parecer.</p>
        </div>
      ) : (
        <div className="cc-entry-grid">
          {clientes.map((c) => (
            <Link key={c.chatId} href={`/clientes/${encodeURIComponent(c.chatId)}`} className="cc-entry">
              <span className="cc-entry-title">{c.quem}</span>
              <span className="cc-entry-desc mono">{c.chatId}</span>
              <span className="cc-entry-desc">
                {c.pronto ? 'Dossiê pronto para o advogado' : c.faltando.length > 0 ? `Faltando: ${c.faltando.join(', ')}` : 'Em apuração pela AHRI'}
              </span>
              <span className="cc-arrow" aria-hidden>→</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default DossiesPage;
