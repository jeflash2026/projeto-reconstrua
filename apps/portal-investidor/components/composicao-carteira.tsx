'use client';
// COMPOSIÇÃO DA CARTEIRA POR FASE — barra empilhada única (processos por fase),
// da fase mais nova ao desfecho, no ramp dourado validado; 2px de papel entre
// os segmentos, ponta arredondada, legenda sempre presente e dica por segmento
// (hover e foco de teclado). A tabela de processos abaixo é a visão em tabela.
import { useState, type ReactElement } from 'react';
import { COR_DA_FASE, moedaCurta, type PainelInvestidor } from '../lib/api';

const ComposicaoCarteira = ({
  porFase,
}: {
  porFase: PainelInvestidor['porFase'];
}): ReactElement => {
  const total = porFase.reduce((s, f) => s + f.processos, 0);
  const [ativo, setAtivo] = useState<{ indice: number; x: number } | null>(null);
  if (total === 0) return <></>;

  let acumulado = 0;
  const segmentos = porFase.map((f) => {
    const inicio = acumulado;
    acumulado += f.processos;
    return { ...f, centro: ((inicio + f.processos / 2) / total) * 100 };
  });
  const dica = ativo === null ? null : segmentos[ativo.indice];

  return (
    <div className="composicao">
      {dica !== undefined && dica !== null && ativo !== null ? (
        <div className="dica" style={{ left: `${String(ativo.x)}%` }} role="status">
          <strong>
            {dica.processos} {dica.processos === 1 ? 'processo' : 'processos'} ·{' '}
            {moedaCurta(dica.valor)}
          </strong>{' '}
          <span>{dica.rotulo}</span>
        </div>
      ) : null}
      <div
        className="barra-fases"
        role="img"
        aria-label={`Processos por fase: ${porFase
          .map((f) => `${f.rotulo} ${String(f.processos)}`)
          .join(', ')}`}
      >
        {segmentos.map((s, i) => (
          <div
            key={s.fase}
            className="segmento"
            tabIndex={0}
            aria-label={`${s.rotulo}: ${String(s.processos)} processo(s), ${moedaCurta(s.valor)}`}
            style={{ flexGrow: s.processos, flexBasis: 0, background: COR_DA_FASE[s.fase] }}
            onPointerEnter={() => {
              setAtivo({ indice: i, x: s.centro });
            }}
            onPointerLeave={() => {
              setAtivo(null);
            }}
            onFocus={() => {
              setAtivo({ indice: i, x: s.centro });
            }}
            onBlur={() => {
              setAtivo(null);
            }}
          />
        ))}
      </div>
      <div className="legenda">
        {porFase.map((f) => (
          <div key={f.fase} className="legenda-item">
            <i className="amostra" style={{ background: COR_DA_FASE[f.fase] }} />
            <span>
              {f.rotulo} <strong>{f.processos}</strong>
              <span className="dim"> · {moedaCurta(f.valor)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComposicaoCarteira;
