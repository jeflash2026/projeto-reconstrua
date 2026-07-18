'use client';
// LOGIN do Portal do Advogado — visitante → login → painel (nunca painel direto).
// Senha de acesso (BL-3.1) + ID do advogado (fornecido pelo Administrador no
// cadastro em /admin/advogados). A identidade é validada no servidor (perfil ativo).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { loginAdvogado } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [id, setId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entrar = async (): Promise<void> => {
    if (busy || senha.trim() === '' || id.trim() === '') return;
    setBusy(true);
    setErro(null);
    const result = await loginAdvogado(senha, id);
    if (!result.ok) {
      setErro(result.error ?? 'falha no login');
    } else {
      router.push('/');
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: '10vh auto', padding: '0 16px' }}>
      <div className="card">
        <h1 className="page-title">Reconstrua — Advogado</h1>
        <p className="page-sub">Entre com a senha de acesso e o seu ID (fornecido pelo Administrador).</p>
        <form
          className="form-row"
          onSubmit={(e) => { e.preventDefault(); void entrar(); }}
          style={{ flexDirection: 'column', alignItems: 'stretch' }}
        >
          <input
            type="password"
            placeholder="Senha de acesso"
            value={senha}
            autoFocus
            onChange={(e) => { setSenha(e.target.value); }}
          />
          <input
            type="text"
            placeholder="Seu ID de advogado"
            value={id}
            onChange={(e) => { setId(e.target.value); }}
          />
          <button type="submit" className="primary" disabled={busy || senha.trim() === '' || id.trim() === ''}>
            Entrar
          </button>
        </form>
        {erro ? <div className="error-box" style={{ marginTop: 12 }}>{erro}</div> : null}
      </div>
    </div>
  );
};

export default LoginPage;
