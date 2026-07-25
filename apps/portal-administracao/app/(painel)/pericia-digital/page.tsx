// CENTRAL DE PERÍCIA DIGITAL (Decreto 2026-07-24) — fila de casos. Atrás de
// feature flag na API (PERICIA_DIGITAL_ENABLED); desativada ⇒ aviso, sem quebrar.
import type { ReactElement } from 'react';
import PericiaDigitalCasos from '../../../components/pericia-digital-casos';
import { pdHabilitado, pdListarCasos } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

const PericiaDigitalPage = async (): Promise<ReactElement> => {
  const on = await pdHabilitado();
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
          Módulo desativado. Para habilitar, defina <span className="mono">PERICIA_DIGITAL_ENABLED=true</span>{' '}
          no ambiente da API e reinicie.
        </div>
      ) : (
        <PericiaDigitalCasos casos={await pdListarCasos()} />
      )}
    </>
  );
};

export default PericiaDigitalPage;
