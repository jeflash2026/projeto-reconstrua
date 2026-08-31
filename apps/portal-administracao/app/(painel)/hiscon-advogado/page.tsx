// HISCON EM LOTE por advogado (2026-08-31) — o ZIP com o HISCON de todos os
// clientes já atribuídos a um advogado + link tokenizado (7 dias) para repassar.
import type { ReactElement } from 'react';
import HisconLote from '../../../components/hiscon-lote';

export const dynamic = 'force-dynamic';

const HisconAdvogadoPage = (): ReactElement => (
  <>
    <h1 className="page-title">HISCONs por advogado</h1>
    <p className="page-sub">
      Escolha o advogado e baixe num ZIP só o HISCON de todos os clientes que você já destinou a ele
      — ou gere um link (válido por 7 dias) para repassar direto ao advogado. O pacote é montado na
      hora do download com os clientes atribuídos naquele momento; clientes sem o PDF legível
      aparecem listados no LEIA-ME dentro do ZIP.
    </p>
    <HisconLote />
  </>
);

export default HisconAdvogadoPage;
