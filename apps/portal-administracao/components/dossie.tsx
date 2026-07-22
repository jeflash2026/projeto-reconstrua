// DOSSIÊ JURÍDICO (GO-LIVE 13A · seção 4) — o parecer inicial da AHRI, renderizado
// no topo do cliente para que o advogado sinta que outro advogado já trabalhou o
// caso. Server component: busca /admin/clients/:chatId/dossie (Read Models + motor
// de raciocínio). "Como a AHRI chegou" via <details> — só dados auditáveis.
import type { ReactElement } from 'react';
import { getJson, type DossieJuridico } from '../lib/api';

const CONF: Record<string, { label: string; cls: string }> = {
  alta: { label: 'Confiança alta', cls: 'cc-tag-oportunidade' },
  media: { label: 'Confiança média', cls: 'cc-tag-alerta' },
  baixa: { label: 'Confiança baixa', cls: 'cc-tag-critico' },
};

const Lista = ({
  titulo,
  itens,
  vazio,
  tone,
}: {
  titulo: string;
  itens: string[];
  vazio: string;
  tone?: string;
}): ReactElement => (
  <div className="dossie-block">
    <div className="dossie-block-title">{titulo}</div>
    {itens.length === 0 ? (
      <p className="dossie-empty">{vazio}</p>
    ) : (
      <ul className={`dossie-list${tone ? ` ${tone}` : ''}`}>
        {itens.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    )}
  </div>
);

const Dossie = async ({ chatId }: { chatId: string }): Promise<ReactElement | null> => {
  const d = await getJson<DossieJuridico>(`/admin/clients/${encodeURIComponent(chatId)}/dossie`);
  if (!d) return null;
  const conf = d.grauConfianca ? CONF[d.grauConfianca] : null;

  return (
    <section className="dossie">
      <div className="dossie-head">
        <div>
          <div className="dossie-kicker">Parecer inicial · AHRI</div>
          <h2 className="dossie-title">Dossiê Jurídico</h2>
        </div>
        {conf ? (
          <span className={`cc-tag ${conf.cls} dossie-conf`}>{conf.label}</span>
        ) : (
          <span className="cc-tag cc-tag-informacao dossie-conf">Em apuração</span>
        )}
      </div>

      <p className="dossie-resumo">{d.resumoExecutivo}</p>

      {/* Ranking das teses */}
      <div className="dossie-block-title">Hipóteses jurídicas (ranking)</div>
      {d.hipoteses.length === 0 ? (
        <p className="dossie-empty">
          Ainda sem tese sustentável — reunir os fatos e a documentação básica.
        </p>
      ) : (
        <ol className="dossie-teses">
          {d.hipoteses.map((t) => (
            <li key={t.ref} className="dossie-tese">
              <div className="dossie-tese-top">
                <span className="dossie-pos">{t.posicao}</span>
                <span className="dossie-tese-nome">{t.hipotese}</span>
                <span className={`cc-tag ${CONF[t.confianca]?.cls ?? 'cc-tag-informacao'}`}>
                  {CONF[t.confianca]?.label ?? t.confianca}
                </span>
              </div>
              <p className="dossie-tese-just">{t.justificativa}</p>
              <p className="dossie-tese-fund">Fundamento: {t.fundamento}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="dossie-cols">
        <Lista
          titulo="Evidências encontradas"
          itens={d.evidenciasEncontradas}
          vazio="Nenhuma ainda."
          tone="ok"
        />
        <Lista
          titulo="Evidências ausentes"
          itens={d.evidenciasAusentes}
          vazio="Nada faltando."
          tone="warn"
        />
        <Lista
          titulo="Documentos reconhecidos"
          itens={d.documentosReconhecidos}
          vazio="Nenhum recebido."
          tone="ok"
        />
        <Lista
          titulo="Documentos pendentes"
          itens={d.documentosPendentes}
          vazio="Nenhum pendente."
          tone="warn"
        />
        <Lista
          titulo="Contratos encontrados"
          itens={d.contratosEncontrados}
          vazio="Nenhum identificado."
        />
        <Lista titulo="Riscos" itens={d.riscos} vazio="Nenhum risco mapeado." tone="warn" />
      </div>

      <div className="dossie-cols">
        <Lista
          titulo="Próximas ações recomendadas"
          itens={d.proximasAcoes}
          vazio="Sem ações no momento."
        />
        <Lista titulo="Observações da IA" itens={d.observacoesIA} vazio="Sem observações." />
      </div>

      {/* Timeline dos acontecimentos */}
      {d.timeline.length > 0 ? (
        <div className="dossie-block">
          <div className="dossie-block-title">Linha do tempo</div>
          <ul className="timeline">
            {d.timeline.map((e, i) => (
              <li key={i}>
                <span className="when">{e.em ? new Date(e.em).toLocaleString('pt-BR') : '—'}</span>
                <div>
                  {e.rotulo} <span className="cc-source">{e.fonte}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Como a AHRI chegou — auditável, sem chain of thought */}
      <details className="dossie-explica">
        <summary>Como a AHRI chegou nesta conclusão</summary>
        <div className="dossie-explica-body">
          <Lista titulo="Fatos utilizados" itens={d.explicacao.fatosUtilizados} vazio="—" />
          <Lista
            titulo="Documentos considerados"
            itens={d.explicacao.documentosConsiderados}
            vazio="—"
          />
          <div className="dossie-block">
            <div className="dossie-block-title">Hipóteses avaliadas</div>
            <ul className="dossie-list">
              {d.explicacao.hipotesesAvaliadas.map((h) => (
                <li key={h.ref}>
                  {h.ref} — {h.confianca}
                </li>
              ))}
            </ul>
          </div>
          <div className="dossie-block">
            <div className="dossie-block-title">Hipóteses descartadas</div>
            {d.explicacao.hipotesesDescartadas.length === 0 ? (
              <p className="dossie-empty">Nenhuma concorrente.</p>
            ) : (
              <ul className="dossie-list warn">
                {d.explicacao.hipotesesDescartadas.map((h) => (
                  <li key={h.ref}>
                    {h.ref} — {h.motivo}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="dossie-crit">
            Estratégia vencedora: <strong>{d.explicacao.estrategiaVencedora ?? '—'}</strong> ·
            Confiança: {d.explicacao.confianca ?? '—'} · Critério: {d.explicacao.criterios}
          </p>
        </div>
      </details>

      {/* Rastreabilidade */}
      <div className="dossie-meta">
        <span>
          strategyRef: <b>{d.strategyRef ?? '—'}</b>
        </span>
        <span>
          decisionId: <b>{d.decisionId ?? '—'}</b>
        </span>
        <span>
          correlationId: <b>{d.correlationId ?? '—'}</b>
        </span>
        <span>
          Mission: <b>{d.missionId ?? '—'}</b>
        </span>
        <span>
          Catálogo: <b>{d.versaoCatalogo}</b>
        </span>
        <span>
          Gerado: <b>{new Date(d.geradoEm).toLocaleString('pt-BR')}</b>
        </span>
      </div>
    </section>
  );
};

export default Dossie;
