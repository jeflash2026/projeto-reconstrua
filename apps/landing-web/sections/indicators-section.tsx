'use client';

import { Counter } from '@/components/motion/counter';
import { indicators } from '@/lib/content';

export function IndicatorsSection() {
  return (
    <section className="indicators" aria-label="Indicadores do Projeto Reconstrua">
      <div className="shell indicators__inner">
        {indicators.map((indicator) => (
          <article className="indicator" key={indicator.label}>
            <strong>
              <Counter value={indicator.value} />
            </strong>
            <p>{indicator.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
