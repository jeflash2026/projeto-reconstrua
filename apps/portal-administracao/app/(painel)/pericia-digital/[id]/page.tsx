// CENTRAL DE PERÍCIA DIGITAL — detalhe do caso (abas + ciclo + custódia).
import type { ReactElement } from 'react';
import Link from 'next/link';
import PericiaDigitalCaso from '../../../../components/pericia-digital-caso';
import { pdObterCaso } from '../../../../lib/actions';

export const dynamic = 'force-dynamic';

const CasoPage = async ({ params }: { params: { id: string } }): Promise<ReactElement> => {
  const dados = await pdObterCaso(params.id);
  if (dados === null) {
    return (
      <>
        <Link href="/pericia-digital" className="sol-voltar">
          ← Central de Perícia Digital
        </Link>
        <div className="card empty">Caso não encontrado ou módulo desativado.</div>
      </>
    );
  }
  const { caso, custodia } = dados;
  return (
    <>
      <Link href="/pericia-digital" style={{ color: 'var(--accent)' }}>
        ← Central de Perícia Digital
      </Link>
      <h1 className="page-title" style={{ marginTop: 8 }}>
        Caso {caso.numeroCaso}
      </h1>
      <p className="page-sub">
        Cliente: {caso.dados.nomeCliente ?? caso.chatId} · Benefício:{' '}
        {caso.dados.numeroBeneficio ?? '—'} · Status: <strong>{caso.status}</strong>
      </p>
      <PericiaDigitalCaso
        caso={caso}
        trilha={custodia.trilha}
        integro={custodia.integridade?.integro ?? null}
      />
    </>
  );
};

export default CasoPage;
