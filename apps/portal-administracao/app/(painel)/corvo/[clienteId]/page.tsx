// TIMELINE CORVO DE UM CLIENTE — caixa, notificações e respostas por banco.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getJson } from '../../../../lib/api';
import CorvoTimeline, { type TimelineCorvoView } from '../../../../components/corvo-timeline';

export const dynamic = 'force-dynamic';

const CorvoClientePage = async ({
  params,
}: {
  params: { clienteId: string };
}): Promise<ReactElement> => {
  const clienteId = decodeURIComponent(params.clienteId);
  const timeline = await getJson<TimelineCorvoView>(
    `/admin/corvo/cliente/${encodeURIComponent(clienteId)}`,
  );
  return (
    <>
      <p className="page-sub">
        <Link href="/corvo">← Bancos (Corvo)</Link>
      </p>
      {timeline === null ? (
        <div className="error-box">Cliente nunca enviado ao Corvo (ou API indisponível).</div>
      ) : (
        <>
          <h1 className="page-title">{timeline.importacao.nome}</h1>
          <p className="page-sub">
            Estado do envio: {timeline.importacao.estado}
            {timeline.importacao.enviadoEm !== null
              ? ` · enviado em ${new Date(timeline.importacao.enviadoEm).toLocaleString('pt-BR')}`
              : ''}
            {timeline.importacao.ultimoErro !== null
              ? ` · último erro: ${timeline.importacao.ultimoErro}`
              : ''}
          </p>
          <CorvoTimeline timeline={timeline} />
        </>
      )}
    </>
  );
};

export default CorvoClientePage;
