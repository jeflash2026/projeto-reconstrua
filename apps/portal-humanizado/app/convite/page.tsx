'use client';
// CONVITE do ATENDIMENTO HUMANIZADO (Onda 2) — o link emitido pelo Admin (aba
// Operadores) traz o token (?t=...); aqui a secretária cria a PRÓPRIA senha e
// segue para o login. Convite usado/expirado ⇒ pedir um novo ao escritório.
import { Suspense, useState, type ReactElement } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { definirSenhaHumanizado } from '../../lib/actions';

const SENHA_MINIMA = 8;

const ConviteForm = (): ReactElement => {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('t') ?? '';
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const criar = async (): Promise<void> => {
    if (busy) return;
    if (token === '') {
      setErro('link de convite incompleto — peça um novo ao escritório');
      return;
    }
    if (senha.length < SENHA_MINIMA) {
      setErro(`a senha precisa ter pelo menos ${String(SENHA_MINIMA)} caracteres`);
      return;
    }
    if (senha !== confirmar) {
      setErro('as senhas não conferem');
      return;
    }
    setBusy(true);
    setErro(null);
    const r = await definirSenhaHumanizado(token, senha);
    if (!r.ok) {
      setErro(r.error ?? 'falha ao criar a senha');
      setBusy(false);
      return;
    }
    router.push('/login');
  };

  return (
    <div className="card">
      <h1 className="page-title">Crie a sua senha</h1>
      <p className="page-sub">
        Você foi convidado(a) para o Atendimento Humanizado. Defina a sua senha pessoal — o login
        depois é pelo seu CPF.
      </p>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
        style={{ flexDirection: 'column', alignItems: 'stretch' }}
      >
        <input
          type="password"
          placeholder={`Nova senha (mín. ${String(SENHA_MINIMA)} caracteres)`}
          value={senha}
          autoFocus
          onChange={(e) => {
            setSenha(e.target.value);
          }}
        />
        <input
          type="password"
          placeholder="Repita a senha"
          value={confirmar}
          onChange={(e) => {
            setConfirmar(e.target.value);
          }}
        />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Criando…' : 'Criar senha e entrar'}
        </button>
        {erro !== null ? <div className="error-box">{erro}</div> : null}
      </form>
    </div>
  );
};

const ConvitePage = (): ReactElement => (
  <div style={{ maxWidth: 420, margin: '10vh auto', padding: '0 16px' }}>
    <Suspense fallback={null}>
      <ConviteForm />
    </Suspense>
  </div>
);

export default ConvitePage;
