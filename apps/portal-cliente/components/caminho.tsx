// O CAMINHO — timeline vertical de 4 momentos (UX §6): um caminho, não um Gantt.
// Frases fixas do passado/futuro vêm do UX congelado; a frase da etapa ATUAL é o
// `agora` da projeção (a mesma voz, sem duplicação de conteúdo).
import type { ReactElement } from 'react';
import type { EtapaTimeline } from '../lib/api';

const FRASES: Record<string, { concluida: string; futura: string }> = {
  Documentação: {
    concluida: 'Recebi e organizei toda a sua documentação.',
    futura: 'Vamos organizar a sua documentação juntos.',
  },
  'Análise técnica': {
    concluida: 'Nossa equipe concluiu a análise técnica do seu caso.',
    futura: 'Depois, nossa equipe técnica analisa o seu caso.',
  },
  Processo: {
    concluida: 'Seu processo foi conduzido até a conclusão.',
    futura: 'Depois, um advogado assume a condução do seu processo.',
  },
  Conclusão: {
    concluida: 'Chegamos à conclusão desta etapa.',
    futura: 'E por fim, a conclusão — eu te aviso em cada passo até lá.',
  },
};

const Caminho = ({
  etapas,
  agora,
}: {
  etapas: readonly EtapaTimeline[];
  agora: string;
}): ReactElement => (
  <ol className="caminho">
    {etapas.map((e) => (
      <li key={e.titulo} className={e.situacao}>
        <span className="caminho__ponto" aria-hidden />
        <div>
          <span className="caminho__titulo">{e.titulo}</span>
          {e.situacao === 'atual' ? <span className="caminho__aqui">você está aqui</span> : null}
          <p className="caminho__frase">
            {e.situacao === 'atual'
              ? agora
              : (FRASES[e.titulo]?.[e.situacao === 'concluida' ? 'concluida' : 'futura'] ?? '')}
          </p>
        </div>
      </li>
    ))}
  </ol>
);

export default Caminho;
