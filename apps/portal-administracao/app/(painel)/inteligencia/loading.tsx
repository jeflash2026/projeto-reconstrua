// Estado VIVO de navegação (GO-LIVE 14A) — a AHRI "trabalhando" enquanto a rota
// carrega. Nunca um loader genérico.
import type { ReactElement } from 'react';
import AhriThinking from '../../../components/ahri-thinking';

const Loading = (): ReactElement => <AhriThinking label="AHRI abrindo o laboratório de inteligência" />;
export default Loading;
