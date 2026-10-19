// CONSOLE DE VOZ (2026-10-19) — conversa falada com a AHRI, pelo PC ou pelo
// celular. O cérebro é o Jarvis (o mesmo do Founder Console): pergunta livre
// fundamentada nos read models, nunca invenção. Aqui só se acrescenta a voz.
import type { ReactElement } from 'react';
import ConsoleVoz from '../../../components/console-voz';

export const dynamic = 'force-dynamic';

const VozPage = (): ReactElement => (
  <>
    <h1 className="page-title">Falar com a AHRI</h1>
    <p className="page-sub">
      Toque no microfone, faça a pergunta e ela responde em voz. Funciona no celular e no computador
      — o navegador pede autorização do microfone na primeira vez. As respostas saem dos registros
      reais da operação; quando ela não souber, vai dizer que não sabe em vez de inventar.
    </p>
    <ConsoleVoz />
  </>
);

export default VozPage;
