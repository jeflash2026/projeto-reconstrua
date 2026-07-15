// PERFIL — identificação e dados do advogado (leitura do diretório operacional).
import type { ReactElement } from 'react';
import IdentityForm from '../../components/identity-form';
import { getJson, advogadoId, type Perfil } from '../../lib/api';
import { formatDate } from '../../lib/format';

const PerfilPage = async (): Promise<ReactElement> => {
  const perfil = advogadoId() !== null ? await getJson<Perfil>('/advogado/perfil') : null;
  return (
    <>
      <h1 className="page-title">Perfil</h1>
      <p className="page-sub">Sua identificação e seus dados no diretório da equipe.</p>
      <IdentityForm />
      {perfil ? (
        <div className="card">
          <h3>Meus dados</h3>
          <dl className="kv">
            <dt>Nome</dt>
            <dd>{perfil.name}</dd>
            <dt>E-mail</dt>
            <dd>{perfil.email ?? '—'}</dd>
            <dt>Papel</dt>
            <dd>
              <span className="badge accent">{perfil.role}</span>
            </dd>
            <dt>Status</dt>
            <dd>{perfil.active ? <span className="badge ok">ativo</span> : <span className="badge bad">inativo</span>}</dd>
            <dt>Cadastro</dt>
            <dd>{formatDate(perfil.createdAt)}</dd>
            <dt>ID</dt>
            <dd className="mono">{perfil.id}</dd>
          </dl>
        </div>
      ) : (
        <div className="card empty">Identifique-se acima para carregar seus dados.</div>
      )}
    </>
  );
};

export default PerfilPage;
