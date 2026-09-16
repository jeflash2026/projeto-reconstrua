'use client';
// LOGIN do Portal do INVESTIDOR — CPF + senha própria (criada pelo link do
// escritório). Tela NUA: nada abre sem autenticação.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import LadoAcesso from '../../components/lado-acesso';
import { loginInvestidor } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const entrar = async (): Promise<void> => {
    if (ocupado || cpf.trim() === '' || senha === '') return;
    setOcupado(true);
    setErro(null);
    const r = await loginInvestidor(cpf, senha);
    if (!r.ok) {
      setErro(r.error ?? 'Não foi possível entrar.');
      setOcupado(false);
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="acesso">
      <LadoAcesso />
      <main className="acesso-form">
        <form
          className="acesso-caixa"
          onSubmit={(e) => {
            e.preventDefault();
            void entrar();
          }}
        >
          <h2>Entrar</h2>
          <p>
            Use o seu CPF e a sua senha. Ainda não tem senha? Abra o link de acesso que o escritório
            enviou a você.
          </p>
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
            <span>Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
              }}
            />
          </label>
          {erro !== null ? <div className="erro">{erro}</div> : null}
          <button type="submit" className="btn-primario" disabled={ocupado}>
            {ocupado ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default LoginPage;
