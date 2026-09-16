'use client';
// CONVITE do INVESTIDOR (2026-09-16) — o link do escritório traz o token
// (?t=...); aqui o investidor confirma o PRÓPRIO CPF e cria a senha, e segue
// para o login. Convite usado/expirado ou CPF divergente ⇒ pedir novo link.
import { Suspense, useState, type ReactElement } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LadoAcesso from '../../components/lado-acesso';
import { definirSenhaInvestidor } from '../../lib/actions';

const SENHA_MINIMA = 8;

const ConviteForm = (): ReactElement => {
  const router = useRouter();
  const token = useSearchParams().get('t') ?? '';
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const criar = async (): Promise<void> => {
    if (ocupado) return;
    if (token === '') {
      setErro('Link de acesso incompleto — peça um novo ao escritório.');
      return;
    }
    if (cpf.replace(/\D/g, '').length !== 11) {
      setErro('Informe o seu CPF (11 dígitos).');
      return;
    }
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${String(SENHA_MINIMA)} caracteres.`);
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não conferem.');
      return;
    }
    setOcupado(true);
    setErro(null);
    const r = await definirSenhaInvestidor(token, cpf, senha);
    if (!r.ok) {
      setErro(r.error ?? 'Não foi possível criar a senha.');
      setOcupado(false);
      return;
    }
    router.push('/login');
  };

  return (
    <form
      className="acesso-caixa"
      onSubmit={(e) => {
        e.preventDefault();
        void criar();
      }}
    >
      <h2>Crie a sua senha</h2>
      <p>Confirme o seu CPF e defina uma senha pessoal. Depois, você entra só com CPF e senha.</p>
      <label className="campo">
        <span>CPF</span>
        <input
          inputMode="numeric"
          autoComplete="username"
          placeholder="000.000.000-00"
          value={cpf}
          autoFocus
          onChange={(e) => {
            setCpf(e.target.value);
          }}
        />
      </label>
      <label className="campo">
        <span>Nova senha (mínimo {SENHA_MINIMA} caracteres)</span>
        <input
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => {
            setSenha(e.target.value);
          }}
        />
      </label>
      <label className="campo">
        <span>Repita a senha</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => {
            setConfirmar(e.target.value);
          }}
        />
      </label>
      {erro !== null ? <div className="erro">{erro}</div> : null}
      <button type="submit" className="btn-primario" disabled={ocupado}>
        {ocupado ? 'Criando…' : 'Criar senha'}
      </button>
    </form>
  );
};

const ConvitePage = (): ReactElement => (
  <div className="acesso">
    <LadoAcesso />
    <main className="acesso-form">
      <Suspense fallback={null}>
        <ConviteForm />
      </Suspense>
    </main>
  </div>
);

export default ConvitePage;
