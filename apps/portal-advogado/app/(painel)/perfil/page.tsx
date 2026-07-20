// PERFIL — dados do advogado (leitura do diretório operacional). A identificação
// agora nasce no LOGIN (sessão + advogado-id httpOnly); o form provisório foi
// substituído (Regra 2) — para trocar de identidade, Sair e entrar novamente.
import type { ReactElement } from 'react';
import { getJson, advogadoId, type Perfil } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { meuCanalWhatsApp } from '../../../lib/actions';
import CanalWhatsAppForm from '../../../components/canal-whatsapp-form';

const PerfilPage = async (): Promise<ReactElement> => {
  const perfil = advogadoId() !== null ? await getJson<Perfil>('/advogado/perfil') : null;
  const canal = perfil !== null ? await meuCanalWhatsApp() : null;
  return (
    <>
      <h1 className="page-title">Perfil</h1>
      <p className="page-sub">Seus dados no diretório da equipe.</p>
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
      ) : null}
      {perfil ? (
        <CanalWhatsAppForm atual={canal} />
      ) : (
        <div className="card empty">Sessão sem identidade válida — clique em Sair e entre novamente.</div>
      )}
    </>
  );
};

export default PerfilPage;
