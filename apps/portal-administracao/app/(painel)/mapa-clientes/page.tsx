// MAPA DE CLIENTES (Decreto 2026-07-24) — a distribuição geográfica da carteira:
// quantidade de clientes por ESTADO (derivada do DDD do WhatsApp) e as principais
// CIDADES (da localidade capturada na conversa). Barras proporcionais, sem lib.
import type { ReactElement } from 'react';
import { fetchMapaClientes } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

function Barra({
  rotulo,
  detalhe,
  total,
  max,
}: {
  rotulo: string;
  detalhe?: string;
  total: number;
  max: number;
}): ReactElement {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
      <div style={{ width: 190, fontSize: 13 }}>
        <strong>{rotulo}</strong>
        {detalhe ? <span style={{ color: 'var(--text-dim)' }}> · {detalhe}</span> : null}
      </div>
      <div
        style={{
          flex: 1,
          background: 'var(--bg-hover)',
          borderRadius: 6,
          height: 18,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${String(Math.max(pct, 2))}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: 6,
          }}
        />
      </div>
      <div style={{ width: 44, textAlign: 'right', fontWeight: 600 }}>{total}</div>
    </div>
  );
}

const MapaClientesPage = async (): Promise<ReactElement> => {
  const mapa = await fetchMapaClientes();

  if (mapa === null) {
    return (
      <>
        <h1 className="page-title">Mapa de Clientes</h1>
        <div className="card empty">Mapa indisponível no momento.</div>
      </>
    );
  }

  const maxEstado = mapa.porEstado[0]?.total ?? 0;
  const maxCidade = mapa.cidades[0]?.total ?? 0;

  return (
    <>
      <h1 className="page-title">Mapa de Clientes</h1>
      <p className="page-sub">
        Distribuição da carteira por estado (pelo DDD do WhatsApp) e as principais cidades (pela
        localidade capturada na conversa).
      </p>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="value">{mapa.total}</div>
          <div className="label">Clientes no total</div>
        </div>
        <div className="card stat">
          <div className="value">{mapa.porEstado.length}</div>
          <div className="label">Estados alcançados</div>
        </div>
        <div className="card stat">
          <div className="value">{mapa.comCidade}</div>
          <div className="label">Com cidade informada</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Clientes por estado ({mapa.comEstado})</h3>
        {mapa.porEstado.length === 0 ? (
          <div className="empty">Sem estados identificados ainda.</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {mapa.porEstado.map((e) => (
              <Barra key={e.uf} rotulo={e.uf} detalhe={e.nome} total={e.total} max={maxEstado} />
            ))}
          </div>
        )}
        {mapa.semEstado > 0 ? (
          <p className="page-sub" style={{ marginTop: 10 }}>
            {mapa.semEstado} cliente(s) sem estado identificável (número não-brasileiro ou DDD
            desconhecido).
          </p>
        ) : null}
      </div>

      <div className="card">
        <h3>Principais cidades ({mapa.cidades.length})</h3>
        {mapa.cidades.length === 0 ? (
          <div className="empty">Nenhuma cidade capturada ainda na conversa.</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {mapa.cidades.map((c) => (
              <Barra key={c.cidade} rotulo={c.cidade} total={c.total} max={maxCidade} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default MapaClientesPage;
