// INTELIGÊNCIA · ESTRATÉGIAS (GO-LIVE 13A · seção 2) — a biblioteca navegável do
// catálogo. Só consulta (nunca edita a IA). Derivada de /admin/inteligencia/
// estrategias (catálogo + estatísticas de uso dos Read Models).
import type { ReactElement } from 'react';
import AutoRefresh from '../../../../components/auto-refresh';
import { getJson, type EstrategiaCard } from '../../../../lib/api';

const Chips = ({ titulo, itens }: { titulo: string; itens: string[] }): ReactElement | null =>
  itens.length === 0 ? null : (
    <div className="lab-field">
      <span className="lab-field-label">{titulo}</span>
      <div className="lab-chips">
        {itens.map((x, i) => (
          <span key={i} className="lab-chip">
            {x}
          </span>
        ))}
      </div>
    </div>
  );

const Card = ({ s }: { s: EstrategiaCard }): ReactElement => (
  <details className="lab-strat">
    <summary>
      <span className="lab-strat-ref mono">{s.ref}</span>
      <span className="lab-strat-desc">{s.descricao}</span>
      <span className="lab-strat-stat">{s.usos} uso(s)</span>
    </summary>
    <div className="lab-strat-body">
      <div className="lab-stat-row">
        <div>
          <span className="lab-stat-v">{s.usos}</span>
          <span className="lab-stat-l">usos</span>
        </div>
        <div>
          <span className="lab-stat-v">
            {s.taxaAcerto === null ? '—' : `${Math.round(s.taxaAcerto * 100)}%`}
          </span>
          <span className="lab-stat-l">acerto</span>
        </div>
        <div>
          <span className="lab-stat-v">
            {s.confiancaMedia === null ? '—' : `${Math.round(s.confiancaMedia * 100)}%`}
          </span>
          <span className="lab-stat-l">confiança média</span>
        </div>
        <div>
          <span className="lab-stat-v">{s.criterioDePrioridade}</span>
          <span className="lab-stat-l">prioridade</span>
        </div>
        <div>
          <span className="lab-stat-v">
            {s.ultimaUtilizacao ? new Date(s.ultimaUtilizacao).toLocaleDateString('pt-BR') : '—'}
          </span>
          <span className="lab-stat-l">última</span>
        </div>
      </div>
      <p className="lab-field">
        <span className="lab-field-label">Problema jurídico</span> {s.problemaJuridico}
      </p>
      <Chips titulo="Requisitos mínimos" itens={s.requisitosMinimos} />
      <Chips titulo="Fatos reforçadores" itens={s.fatosReforcadores} />
      <Chips titulo="Critérios de exclusão" itens={s.criteriosDeExclusao} />
      <Chips titulo="Documentos esperados" itens={s.documentosEsperados} />
      <Chips titulo="Documentos opcionais" itens={s.documentosOpcionais} />
      <Chips titulo="Riscos" itens={s.riscos} />
      <p className="lab-field">
        <span className="lab-field-label">Próxima ação</span> {s.proximaAcao}
      </p>
      <p className="lab-field">
        <span className="lab-field-label">Fundamento</span> {s.fundamento}
      </p>
      {s.casos.length > 0 ? (
        <Chips titulo={`Casos em que foi utilizada (${s.casos.length})`} itens={s.casos} />
      ) : null}
    </div>
  </details>
);

const EstrategiasPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ estrategias: EstrategiaCard[] }>('/admin/inteligencia/estrategias');
  if (!data) {
    return (
      <>
        <h1 className="page-title">Estratégias</h1>
        <div className="error-box">API indisponível.</div>
      </>
    );
  }
  return (
    <>
      <AutoRefresh seconds={30} />
      <h1 className="page-title">Estratégias</h1>
      <p className="page-sub">
        A biblioteca de teses jurídicas do consignado INSS. Consulta apenas — a AHRI nunca é editada
        aqui.
      </p>
      <div className="lab-strat-list">
        {data.estrategias.map((s) => (
          <Card key={s.ref} s={s} />
        ))}
      </div>
    </>
  );
};

export default EstrategiasPage;
