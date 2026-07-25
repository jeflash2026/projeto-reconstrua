// CENTRAL DE PERÍCIA DIGITAL (Decreto 2026-07-24) — fila de casos. Atrás de
// feature flag na API (PERICIA_DIGITAL_ENABLED); desativada ⇒ aviso, sem quebrar.
import type { ReactElement } from 'react';
import PericiaDigitalCasos from '../../../components/pericia-digital-casos';
import { pdConhecimento, pdHabilitado, pdListarCasos } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

const ROTULO_CATEGORIA: Record<string, string> = {
  FRONTEIRA_LEGAL: 'Fronteiras legais',
  PROCEDIMENTO: 'Procedimentos',
  CADEIA_CUSTODIA: 'Cadeia de custódia',
  MODELO_QUESITO: 'Quesitos-modelo',
  LGPD: 'LGPD',
};

const PericiaDigitalPage = async (): Promise<ReactElement> => {
  const on = await pdHabilitado();
  const base = on ? await pdConhecimento() : { categorias: [], entradas: [] };
  return (
    <>
      <h1 className="page-title">Central de Perícia Digital</h1>
      <p className="page-sub">
        Análise técnica dos contratos consignados a partir do HISCON — com cadeia de custódia,
        minuta e revisão obrigatória de um perito. A automação nunca conclui fraude nem inventa
        dados.
      </p>
      {!on ? (
        <div className="card empty">
          Módulo desativado. Para habilitar, defina{' '}
          <span className="mono">PERICIA_DIGITAL_ENABLED=true</span> no ambiente da API e reinicie.
        </div>
      ) : (
        <>
          <PericiaDigitalCasos casos={await pdListarCasos()} />
          <details className="card" style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Base de Conhecimento Pericial ({base.entradas.length}) — material de consulta do
              perito
            </summary>
            <p className="page-sub" style={{ marginTop: 8 }}>
              Procedimentos e fronteiras legais desta Central. Não cita normas externas: é
              referência para o perito humano decidir — a automação nunca conclui a partir daqui.
            </p>
            {base.categorias.map((cat) => {
              const itens = base.entradas.filter((e) => e.categoria === cat);
              if (itens.length === 0) return null;
              return (
                <div key={cat} style={{ marginTop: 12 }}>
                  <div className="badge accent" style={{ marginBottom: 6 }}>
                    {ROTULO_CATEGORIA[cat] ?? cat}
                  </div>
                  {itens.map((e) => (
                    <div
                      key={e.id}
                      style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}
                    >
                      <strong>{e.titulo}</strong>
                      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
                        {e.corpo}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </details>
        </>
      )}
    </>
  );
};

export default PericiaDigitalPage;
