// ACESSOS DO PAINEL JURÍDICO (2026-08-08) — o Admin cria e remove os logins
// do 2º painel (https://.../juridico) sem terminal: dono + sócio.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import JuridicoAcessos, { type AcessoJuridico } from '../../../components/juridico-acessos';

export const dynamic = 'force-dynamic';

const JuridicoPage = async (): Promise<ReactElement> => {
  const dados = await getJson<{ usuarios: AcessoJuridico[] }>('/admin/juridico/usuarios');
  return (
    <>
      <h1 className="page-title">Painel Jurídico — acessos</h1>
      <p className="page-sub">
        Quem pode entrar no Painel Jurídico (/juridico): crie o login de cada pessoa e entregue a
        senha a ela. Cada ação lá dentro fica assinada com o nome do usuário.
      </p>
      {dados === null ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <JuridicoAcessos acessos={dados.usuarios} />
      )}
    </>
  );
};

export default JuridicoPage;
